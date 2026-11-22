import { getSupabaseClient } from '@/storage/database/supabase-client';
import type { SessionUser } from '@/lib/auth';
import type { RiskLevel } from '@/server/ai/agents/registry';

export type ToolCategory =
  | 'SEARCH'
  | 'KNOWLEDGE'
  | 'TASK'
  | 'DOCUMENT'
  | 'FILE'
  | 'ENTERPRISE'
  | 'CUSTOMER'
  | 'ANALYTICS'
  | 'WORKFLOW'
  | 'NOTIFICATION'
  | 'CALENDAR'
  | 'EXTERNAL_API'
  | 'MCP';

export type ToolExecutionStatus =
  | 'CREATED'
  | 'VALIDATING'
  | 'READY'
  | 'PENDING_APPROVAL'
  | 'APPROVED'
  | 'RUNNING'
  | 'COMPLETED'
  | 'FAILED'
  | 'REJECTED'
  | 'TIMEOUT'
  | 'CANCELLED';

export type ApprovalPolicy = 'none' | 'auto' | 'manual' | 'dual';

export type RateLimit = {
  callsPerMinute?: number;
  dailyQuota?: number;
  concurrentLimit?: number;
};

export type ToolDefinition = {
  code: string;
  module: string;
  description: string;
  paramsSchema: Record<string, unknown>;
  requiredPermission: string;
  dataDomain: string;
  riskLevel: RiskLevel;
  sideEffect: boolean;
  idempotent: boolean;
  timeoutMs: number;
  category?: ToolCategory;
  executionType?: 'sync' | 'async';
  inputSchema?: Record<string, unknown>;
  outputSchema?: Record<string, unknown>;
  endpoint?: string;
  approvalPolicy?: ApprovalPolicy;
  rateLimit?: RateLimit;
  retryPolicy?: { maxRetries: number; backoffMs: number };
};

type ToolExecutor = (
  params: Record<string, unknown>,
  userContext: SessionUser,
) => Promise<Record<string, unknown>>;

type ToolEntry = {
  definition: ToolDefinition;
  executor: ToolExecutor;
};

type ToolFilter = {
  module?: string;
  dataDomain?: string;
  riskLevel?: RiskLevel;
  sideEffect?: boolean;
  category?: ToolCategory;
  approvalPolicy?: ApprovalPolicy;
};

type ToolCallRecord = {
  id: string;
  tenantId: string;
  runId: string;
  stepId: string | null;
  toolCode: string;
  args: Record<string, unknown>;
  result: Record<string, unknown>;
  permissionChecked: boolean;
  riskLevel: RiskLevel;
  status: string;
  latencyMs: number;
};

const toolRegistry = new Map<string, ToolEntry>();

function validateParams(
  params: Record<string, unknown>,
  schema: Record<string, unknown>,
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  const properties = schema.properties as Record<string, Record<string, unknown>> | undefined;
  const required = (schema.required as string[]) ?? [];

  if (!properties) {
    return { valid: true, errors: [] };
  }

  for (const reqField of required) {
    if (!(reqField in params)) {
      errors.push(`缺少必填参数: ${reqField}`);
    }
  }

  for (const [key, value] of Object.entries(params)) {
    const fieldSchema = properties[key];
    if (!fieldSchema) {
      errors.push(`未知参数: ${key}`);
      continue;
    }

    const expectedType = fieldSchema.type as string;
    if (expectedType && typeof value !== expectedType) {
      errors.push(`参数 ${key} 类型应为 ${expectedType}，实际为 ${typeof value}`);
    }
  }

  return { valid: errors.length === 0, errors };
}

function checkPermission(user: SessionUser, requiredPermission: string): boolean {
  return user.permissions.includes('*') || user.permissions.includes(requiredPermission);
}

function maskSensitiveData(
  data: Record<string, unknown>,
  dataDomain: string,
): Record<string, unknown> {
  const masked = { ...data };
  const sensitiveFields: Record<string, string[]> = {
    customer: ['mobile', 'phone', 'email', 'id_card', 'bank_account'],
    enterprise: ['unified_code', 'legal_person_id', 'bank_account'],
    risk: ['detail', 'evidence'],
  };

  const fieldsToMask = sensitiveFields[dataDomain];
  if (!fieldsToMask) return masked;

  for (const field of fieldsToMask) {
    if (field in masked) {
      const value = masked[field];
      if (typeof value === 'string' && value.length > 4) {
        masked[field] = value.slice(0, 2) + '****' + value.slice(-2);
      } else {
        masked[field] = '****';
      }
    }
  }

  return masked;
}

function trimOutput(
  data: Record<string, unknown>,
  riskLevel: RiskLevel,
): Record<string, unknown> {
  if (riskLevel === 'L0') return data;

  const trimmed = { ...data };
  const maxItems = riskLevel === 'L1' ? 50 : riskLevel === 'L2' ? 20 : 5;

  for (const [key, value] of Object.entries(trimmed)) {
    if (Array.isArray(value) && value.length > maxItems) {
      trimmed[key] = value.slice(0, maxItems);
      trimmed[`${key}_truncated`] = true;
      trimmed[`${key}_total`] = value.length;
    }
  }

  return trimmed;
}

async function writeToolCallRecord(record: ToolCallRecord): Promise<void> {
  const db = await getSupabaseClient();
  await db.from('ai_tool_call').insert({
    id: record.id,
    tenant_id: record.tenantId,
    run_id: record.runId,
    step_id: record.stepId,
    tool_code: record.toolCode,
    args: record.args,
    result: record.result,
    permission_checked: record.permissionChecked,
    risk_level: record.riskLevel,
    status: record.status,
    latency_ms: record.latencyMs,
  });
}

async function writeAuditLog(
  user: SessionUser,
  toolCode: string,
  args: Record<string, unknown>,
  result: Record<string, unknown>,
  status: string,
): Promise<void> {
  const db = await getSupabaseClient();
  await db.from('audit_log').insert({
    tenant_id: user.tenantId,
    user_id: user.id,
    username: user.username,
    action: `tool.execute:${toolCode}`,
    resource_type: 'ai_tool_call',
    resource_id: toolCode,
    detail: { args, result_summary: status === 'success' ? 'ok' : 'failed' },
    result: status,
  });
}

export function registerTool(definition: ToolDefinition, executor: ToolExecutor): void {
  toolRegistry.set(definition.code, { definition, executor });
}

export function getTool(code: string): ToolDefinition | null {
  return toolRegistry.get(code)?.definition ?? null;
}

export function listTools(filter?: ToolFilter): ToolDefinition[] {
  const tools: ToolDefinition[] = [];
  for (const entry of toolRegistry.values()) {
    const def = entry.definition;
    if (filter?.module && def.module !== filter.module) continue;
    if (filter?.dataDomain && def.dataDomain !== filter.dataDomain) continue;
    if (filter?.riskLevel && def.riskLevel !== filter.riskLevel) continue;
    if (filter?.sideEffect !== undefined && def.sideEffect !== filter.sideEffect) continue;
    if (filter?.category && def.category !== filter.category) continue;
    if (filter?.approvalPolicy && def.approvalPolicy !== filter.approvalPolicy) continue;
    tools.push(def);
  }
  return tools;
}

export function listToolsByCategory(category: ToolCategory): ToolDefinition[] {
  return listTools({ category });
}

export function getToolExecutionStatus(code: string): ToolExecutionStatus | null {
  const entry = toolRegistry.get(code);
  if (!entry) return null;
  if (entry.definition.approvalPolicy && entry.definition.approvalPolicy !== 'none') {
    return 'PENDING_APPROVAL';
  }
  return 'READY';
}

export function requiresApproval(tool: ToolDefinition): boolean {
  return tool.approvalPolicy !== undefined && tool.approvalPolicy !== 'none';
}

export function checkRateLimit(
  tool: ToolDefinition,
  callCount: number,
  concurrentCount: number,
): { allowed: boolean; reason?: string } {
  if (!tool.rateLimit) return { allowed: true };

  if (tool.rateLimit.callsPerMinute && callCount >= tool.rateLimit.callsPerMinute) {
    return { allowed: false, reason: '超出每分钟调用限制' };
  }
  if (tool.rateLimit.concurrentLimit && concurrentCount >= tool.rateLimit.concurrentLimit) {
    return { allowed: false, reason: '超出并发限制' };
  }
  if (tool.rateLimit.dailyQuota && callCount >= tool.rateLimit.dailyQuota) {
    return { allowed: false, reason: '超出每日配额' };
  }

  return { allowed: true };
}

export async function executeTool(
  code: string,
  params: Record<string, unknown>,
  userContext: SessionUser,
  runContext?: { runId: string; stepId?: string },
): Promise<{ success: boolean; result: Record<string, unknown>; error?: string }> {
  const entry = toolRegistry.get(code);
  if (!entry) {
    return { success: false, result: {}, error: `工具 ${code} 未注册` };
  }

  const { definition, executor } = entry;
  const startTime = Date.now();

  const validation = validateParams(params, definition.paramsSchema);
  if (!validation.valid) {
    return { success: false, result: {}, error: `参数校验失败: ${validation.errors.join('; ')}` };
  }

  if (!checkPermission(userContext, definition.requiredPermission)) {
    return {
      success: false,
      result: {},
      error: `权限不足: 需要 ${definition.requiredPermission}`,
    };
  }

  const maskedParams = maskSensitiveData(params, definition.dataDomain);

  let rawResult: Record<string, unknown>;
  try {
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error(`工具执行超时: ${definition.timeoutMs}ms`)), definition.timeoutMs);
    });
    rawResult = await Promise.race([executor(maskedParams, userContext), timeoutPromise]);
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    const latencyMs = Date.now() - startTime;

    if (runContext) {
      await writeToolCallRecord({
        id: crypto.randomUUID(),
        tenantId: userContext.tenantId,
        runId: runContext.runId,
        stepId: runContext.stepId ?? null,
        toolCode: code,
        args: maskedParams,
        result: {},
        permissionChecked: true,
        riskLevel: definition.riskLevel,
        status: 'failed',
        latencyMs,
      });
    }

    await writeAuditLog(userContext, code, maskedParams, {}, 'failed');

    return { success: false, result: {}, error: errorMsg };
  }

  const trimmedResult = trimOutput(rawResult, definition.riskLevel);
  const latencyMs = Date.now() - startTime;

  if (runContext) {
    await writeToolCallRecord({
      id: crypto.randomUUID(),
      tenantId: userContext.tenantId,
      runId: runContext.runId,
      stepId: runContext.stepId ?? null,
      toolCode: code,
      args: maskedParams,
      result: trimmedResult,
      permissionChecked: true,
      riskLevel: definition.riskLevel,
      status: 'success',
      latencyMs,
    });
  }

  await writeAuditLog(userContext, code, maskedParams, trimmedResult, 'success');

  return { success: true, result: trimmedResult };
}

function initBuiltinTools(): void {
  registerTool(
    {
      code: 'knowledge.search',
      module: 'knowledge',
      description: '在知识库中检索相关内容',
      paramsSchema: {
        type: 'object',
        properties: {
          query: { type: 'string', description: '检索关键词' },
          kbId: { type: 'string', description: '知识库ID' },
          topK: { type: 'number', description: '返回结果数量' },
        },
        required: ['query'],
      },
      requiredPermission: 'knowledge.view',
      dataDomain: 'knowledge',
      riskLevel: 'L0',
      sideEffect: false,
      idempotent: true,
      timeoutMs: 15000,
    },
    async (params) => {
      const db = await getSupabaseClient();
      const query = params.query as string;
      const kbId = params.kbId as string | undefined;
      const topK = (params.topK as number) ?? 5;

      let q = db
        .from('knowledge_chunk')
        .select('id,content,heading,doc_id,kb_id,metadata')
        .textSearch('content', query);

      if (kbId) {
        q = q.eq('kb_id', kbId);
      }

      const { data, error } = await q.limit(topK);
      if (error) throw new Error(error.message);

      return {
        results: (data ?? []).map((chunk) => ({
          id: chunk.id,
          content: chunk.content,
          heading: chunk.heading,
          docId: chunk.doc_id,
          kbId: chunk.kb_id,
        })),
        total: data?.length ?? 0,
      };
    },
  );

  registerTool(
    {
      code: 'task.create_draft',
      module: 'task',
      description: '创建任务草稿',
      paramsSchema: {
        type: 'object',
        properties: {
          title: { type: 'string', description: '任务标题' },
          description: { type: 'string', description: '任务描述' },
          priority: { type: 'string', description: '优先级 P0-P3' },
          assigneeId: { type: 'string', description: '建议责任人ID' },
          dueAt: { type: 'string', description: '截止时间' },
        },
        required: ['title'],
      },
      requiredPermission: 'task.create',
      dataDomain: 'task',
      riskLevel: 'L1',
      sideEffect: true,
      idempotent: false,
      timeoutMs: 10000,
    },
    async (params, user) => {
      const db = await getSupabaseClient();
      const { data, error } = await db.from('task').insert({
        id: crypto.randomUUID(),
        tenant_id: user.tenantId,
        code: `AI-${Date.now()}`,
        title: params.title as string,
        description: (params.description as string) ?? null,
        priority: (params.priority as string) ?? 'P2',
        assignee_id: (params.assigneeId as string) ?? null,
        due_at: (params.dueAt as string) ?? null,
        owner_id: user.id,
        source: 'ai',
        status: 'draft',
      }).select('id,code,title,status').single();

      if (error) throw new Error(error.message);
      return { task: data };
    },
  );

  registerTool(
    {
      code: 'task.list',
      module: 'task',
      description: '查询任务列表',
      paramsSchema: {
        type: 'object',
        properties: {
          status: { type: 'string', description: '任务状态' },
          assigneeId: { type: 'string', description: '责任人ID' },
          limit: { type: 'number', description: '返回数量' },
        },
        required: [],
      },
      requiredPermission: 'task.view',
      dataDomain: 'task',
      riskLevel: 'L0',
      sideEffect: false,
      idempotent: true,
      timeoutMs: 10000,
    },
    async (params, user) => {
      const db = await getSupabaseClient();
      let q = db.from('task').select('id,code,title,status,priority,assignee_id,due_at').eq('tenant_id', user.tenantId);

      if (params.status) q = q.eq('status', params.status as string);
      if (params.assigneeId) q = q.eq('assignee_id', params.assigneeId as string);

      const limit = (params.limit as number) ?? 20;
      const { data, error } = await q.limit(limit);
      if (error) throw new Error(error.message);

      return { tasks: data ?? [], total: data?.length ?? 0 };
    },
  );

  registerTool(
    {
      code: 'task.link',
      module: 'task',
      description: '建立任务依赖关系',
      paramsSchema: {
        type: 'object',
        properties: {
          taskId: { type: 'string', description: '任务ID' },
          dependsOnId: { type: 'string', description: '依赖任务ID' },
          type: { type: 'string', description: '依赖类型' },
        },
        required: ['taskId', 'dependsOnId'],
      },
      requiredPermission: 'task.edit',
      dataDomain: 'task',
      riskLevel: 'L1',
      sideEffect: true,
      idempotent: true,
      timeoutMs: 10000,
    },
    async (params, user) => {
      const db = await getSupabaseClient();
      const { data, error } = await db.from('task_dependency').insert({
        id: crypto.randomUUID(),
        tenant_id: user.tenantId,
        task_id: params.taskId as string,
        depends_on_id: params.dependsOnId as string,
        type: (params.type as string) ?? 'finish_to_start',
      }).select('id,task_id,depends_on_id,type').single();

      if (error) throw new Error(error.message);
      return { dependency: data };
    },
  );

  registerTool(
    {
      code: 'task.update',
      module: 'task',
      description: '更新任务信息',
      paramsSchema: {
        type: 'object',
        properties: {
          taskId: { type: 'string', description: '任务ID' },
          status: { type: 'string', description: '新状态' },
          priority: { type: 'string', description: '新优先级' },
          progress: { type: 'number', description: '进度百分比' },
        },
        required: ['taskId'],
      },
      requiredPermission: 'task.edit',
      dataDomain: 'task',
      riskLevel: 'L1',
      sideEffect: true,
      idempotent: true,
      timeoutMs: 10000,
    },
    async (params, user) => {
      const db = await getSupabaseClient();
      const updates: Record<string, unknown> = {};
      if (params.status) updates.status = params.status;
      if (params.priority) updates.priority = params.priority;
      if (params.progress !== undefined) updates.progress = params.progress;

      const { data, error } = await db.from('task')
        .update(updates)
        .eq('id', params.taskId as string)
        .eq('tenant_id', user.tenantId)
        .select('id,code,title,status,priority,progress')
        .single();

      if (error) throw new Error(error.message);
      return { task: data };
    },
  );

  registerTool(
    {
      code: 'task.aggregate',
      module: 'task',
      description: '汇总任务统计',
      paramsSchema: {
        type: 'object',
        properties: {
          groupBy: { type: 'string', description: '分组字段' },
          status: { type: 'string', description: '状态过滤' },
        },
        required: [],
      },
      requiredPermission: 'task.view',
      dataDomain: 'task',
      riskLevel: 'L0',
      sideEffect: false,
      idempotent: true,
      timeoutMs: 10000,
    },
    async (params, user) => {
      const db = await getSupabaseClient();
      let q = db.from('task').select('id,status,priority,assignee_id,module').eq('tenant_id', user.tenantId);
      if (params.status) q = q.eq('status', params.status as string);

      const { data, error } = await q;
      if (error) throw new Error(error.message);

      const groupBy = (params.groupBy as string) ?? 'status';
      const groups: Record<string, number> = {};
      for (const task of data ?? []) {
        const key = (task as Record<string, unknown>)[groupBy] as string;
        groups[key] = (groups[key] ?? 0) + 1;
      }

      return { groups, total: data?.length ?? 0 };
    },
  );

  registerTool(
    {
      code: 'document.create',
      module: 'office',
      description: '创建文档',
      paramsSchema: {
        type: 'object',
        properties: {
          title: { type: 'string', description: '文档标题' },
          docType: { type: 'string', description: '文档类型' },
          content: { type: 'string', description: '文档内容' },
          templateId: { type: 'string', description: '模板ID' },
        },
        required: ['title'],
      },
      requiredPermission: 'document.create',
      dataDomain: 'office',
      riskLevel: 'L1',
      sideEffect: true,
      idempotent: false,
      timeoutMs: 15000,
    },
    async (params, user) => {
      const db = await getSupabaseClient();
      const docId = crypto.randomUUID();
      const versionId = crypto.randomUUID();

      const { error: docError } = await db.from('document').insert({
        id: docId,
        tenant_id: user.tenantId,
        code: `DOC-${Date.now()}`,
        title: params.title as string,
        doc_type: (params.docType as string) ?? 'report',
        module: 'office',
        owner_id: user.id,
        status: 'draft',
        template_id: (params.templateId as string) ?? null,
      });
      if (docError) throw new Error(docError.message);

      const { error: versionError } = await db.from('document_version').insert({
        id: versionId,
        tenant_id: user.tenantId,
        document_id: docId,
        version_no: 1,
        title: params.title as string,
        editor_id: user.id,
      });
      if (versionError) throw new Error(versionError.message);

      const { error: contentError } = await db.from('document_content').insert({
        id: crypto.randomUUID(),
        tenant_id: user.tenantId,
        document_id: docId,
        version_id: versionId,
        blocks: [],
        plain_text: (params.content as string) ?? '',
      });
      if (contentError) throw new Error(contentError.message);

      await db.from('document').update({ current_version_id: versionId }).eq('id', docId);

      return { documentId: docId, versionId, status: 'draft' };
    },
  );

  registerTool(
    {
      code: 'document.update',
      module: 'office',
      description: '更新文档内容',
      paramsSchema: {
        type: 'object',
        properties: {
          documentId: { type: 'string', description: '文档ID' },
          content: { type: 'string', description: '新内容' },
          changeNote: { type: 'string', description: '变更说明' },
        },
        required: ['documentId', 'content'],
      },
      requiredPermission: 'document.edit',
      dataDomain: 'office',
      riskLevel: 'L1',
      sideEffect: true,
      idempotent: false,
      timeoutMs: 15000,
    },
    async (params, user) => {
      const db = await getSupabaseClient();
      const { data: doc } = await db.from('document')
        .select('id,current_version_id')
        .eq('id', params.documentId as string)
        .eq('tenant_id', user.tenantId)
        .single();
      if (!doc) throw new Error('文档不存在');

      const newVersionId = crypto.randomUUID();
      const currentVersionNo = await db.from('document_version')
        .select('version_no')
        .eq('id', doc.current_version_id as string)
        .single();

      const newVersionNo = ((currentVersionNo.data?.version_no as number) ?? 0) + 1;

      const { error: versionError } = await db.from('document_version').insert({
        id: newVersionId,
        tenant_id: user.tenantId,
        document_id: params.documentId as string,
        version_no: newVersionNo,
        title: '',
        editor_id: user.id,
        change_note: (params.changeNote as string) ?? null,
      });
      if (versionError) throw new Error(versionError.message);

      const { error: contentError } = await db.from('document_content').insert({
        id: crypto.randomUUID(),
        tenant_id: user.tenantId,
        document_id: params.documentId as string,
        version_id: newVersionId,
        blocks: [],
        plain_text: params.content as string,
      });
      if (contentError) throw new Error(contentError.message);

      await db.from('document').update({ current_version_id: newVersionId }).eq('id', params.documentId as string);

      return { documentId: params.documentId, versionId: newVersionId, versionNo: newVersionNo };
    },
  );

  registerTool(
    {
      code: 'document.template.list',
      module: 'office',
      description: '列出文档模板',
      paramsSchema: {
        type: 'object',
        properties: {
          docType: { type: 'string', description: '文档类型过滤' },
        },
        required: [],
      },
      requiredPermission: 'office.view',
      dataDomain: 'office',
      riskLevel: 'L0',
      sideEffect: false,
      idempotent: true,
      timeoutMs: 10000,
    },
    async (params, user) => {
      const db = await getSupabaseClient();
      let q = db.from('document_template')
        .select('id,code,name,doc_type,scope,status')
        .eq('tenant_id', user.tenantId)
        .eq('status', 'active');

      if (params.docType) q = q.eq('doc_type', params.docType as string);

      const { data, error } = await q;
      if (error) throw new Error(error.message);

      return { templates: data ?? [] };
    },
  );

  registerTool(
    {
      code: 'enterprise.get_profile',
      module: 'enterprise',
      description: '获取企业全景画像',
      paramsSchema: {
        type: 'object',
        properties: {
          enterpriseId: { type: 'string', description: '企业ID' },
        },
        required: ['enterpriseId'],
      },
      requiredPermission: 'enterprise.view',
      dataDomain: 'enterprise',
      riskLevel: 'L1',
      sideEffect: false,
      idempotent: true,
      timeoutMs: 15000,
    },
    async (params, user) => {
      const db = await getSupabaseClient();
      const { data, error } = await db.from('enterprise')
        .select('id,name,unified_code,industry,scale,region,level,risk_level,profile,tags')
        .eq('id', params.enterpriseId as string)
        .eq('tenant_id', user.tenantId)
        .single();

      if (error) throw new Error(error.message);
      return { enterprise: data };
    },
  );

  registerTool(
    {
      code: 'customer.get_360',
      module: 'customer',
      description: '获取客户360度视图',
      paramsSchema: {
        type: 'object',
        properties: {
          customerId: { type: 'string', description: '客户ID' },
        },
        required: ['customerId'],
      },
      requiredPermission: 'customer.view',
      dataDomain: 'customer',
      riskLevel: 'L1',
      sideEffect: false,
      idempotent: true,
      timeoutMs: 15000,
    },
    async (params, user) => {
      const db = await getSupabaseClient();

      const [customerResult, opportunitiesResult, visitsResult] = await Promise.all([
        db.from('customer').select('*').eq('id', params.customerId as string).eq('tenant_id', user.tenantId).single(),
        db.from('opportunity').select('id,title,stage,amount,probability').eq('customer_id', params.customerId as string).eq('tenant_id', user.tenantId),
        db.from('visit_record').select('id,visited_at,purpose,summary').eq('customer_id', params.customerId as string).eq('tenant_id', user.tenantId).order('visited_at', { ascending: false }).limit(5),
      ]);

      if (customerResult.error) throw new Error(customerResult.error.message);

      return {
        customer: customerResult.data,
        opportunities: opportunitiesResult.data ?? [],
        recentVisits: visitsResult.data ?? [],
      };
    },
  );

  registerTool(
    {
      code: 'opportunity.list',
      module: 'customer',
      description: '查询商机列表',
      paramsSchema: {
        type: 'object',
        properties: {
          customerId: { type: 'string', description: '客户ID' },
          stage: { type: 'string', description: '商机阶段' },
          limit: { type: 'number', description: '返回数量' },
        },
        required: [],
      },
      requiredPermission: 'customer.view',
      dataDomain: 'customer',
      riskLevel: 'L0',
      sideEffect: false,
      idempotent: true,
      timeoutMs: 10000,
    },
    async (params, user) => {
      const db = await getSupabaseClient();
      let q = db.from('opportunity')
        .select('id,title,stage,amount,probability,expected_close_at,owner_id')
        .eq('tenant_id', user.tenantId);

      if (params.customerId) q = q.eq('customer_id', params.customerId as string);
      if (params.stage) q = q.eq('stage', params.stage as string);

      const limit = (params.limit as number) ?? 20;
      const { data, error } = await q.limit(limit);
      if (error) throw new Error(error.message);

      return { opportunities: data ?? [], total: data?.length ?? 0 };
    },
  );

  registerTool(
    {
      code: 'visit_record.list',
      module: 'customer',
      description: '查询拜访记录',
      paramsSchema: {
        type: 'object',
        properties: {
          customerId: { type: 'string', description: '客户ID' },
          limit: { type: 'number', description: '返回数量' },
        },
        required: ['customerId'],
      },
      requiredPermission: 'customer.view',
      dataDomain: 'customer',
      riskLevel: 'L0',
      sideEffect: false,
      idempotent: true,
      timeoutMs: 10000,
    },
    async (params, user) => {
      const db = await getSupabaseClient();
      const limit = (params.limit as number) ?? 10;
      const { data, error } = await db.from('visit_record')
        .select('id,visited_at,purpose,summary,next_action')
        .eq('customer_id', params.customerId as string)
        .eq('tenant_id', user.tenantId)
        .order('visited_at', { ascending: false })
        .limit(limit);

      if (error) throw new Error(error.message);
      return { visits: data ?? [], total: data?.length ?? 0 };
    },
  );

  registerTool(
    {
      code: 'risk.list_alerts',
      module: 'risk',
      description: '查询风险预警列表',
      paramsSchema: {
        type: 'object',
        properties: {
          status: { type: 'string', description: '预警状态' },
          severity: { type: 'string', description: '严重程度' },
          limit: { type: 'number', description: '返回数量' },
        },
        required: [],
      },
      requiredPermission: 'risk.view',
      dataDomain: 'risk',
      riskLevel: 'L1',
      sideEffect: false,
      idempotent: true,
      timeoutMs: 10000,
    },
    async (params, user) => {
      const db = await getSupabaseClient();
      let q = db.from('risk_alert')
        .select('id,title,severity,status,resource_type,resource_id,created_at')
        .eq('tenant_id', user.tenantId);

      if (params.status) q = q.eq('status', params.status as string);
      if (params.severity) q = q.eq('severity', params.severity as string);

      const limit = (params.limit as number) ?? 20;
      const { data, error } = await q.order('created_at', { ascending: false }).limit(limit);
      if (error) throw new Error(error.message);

      return { alerts: data ?? [], total: data?.length ?? 0 };
    },
  );

  registerTool(
    {
      code: 'risk.create_action',
      module: 'risk',
      description: '创建风险处置方案（草稿）',
      paramsSchema: {
        type: 'object',
        properties: {
          alertId: { type: 'string', description: '预警ID' },
          action: { type: 'string', description: '处置动作' },
          comment: { type: 'string', description: '处置说明' },
        },
        required: ['alertId', 'action'],
      },
      requiredPermission: 'risk.execute',
      dataDomain: 'risk',
      riskLevel: 'L2',
      sideEffect: true,
      idempotent: false,
      timeoutMs: 10000,
    },
    async (params, user) => {
      const db = await getSupabaseClient();
      const { data, error } = await db.from('audit_log').insert({
        tenant_id: user.tenantId,
        user_id: user.id,
        username: user.username,
        action: 'risk.action_draft',
        resource_type: 'risk_alert',
        resource_id: params.alertId as string,
        detail: { action: params.action, comment: params.comment },
        result: 'success',
      }).select('id').single();

      if (error) throw new Error(error.message);
      return { actionId: data?.id, status: 'draft', alertId: params.alertId };
    },
  );

  registerTool(
    {
      code: 'analytics.query',
      module: 'analytics',
      description: '执行分析查询',
      paramsSchema: {
        type: 'object',
        properties: {
          metricCode: { type: 'string', description: '指标编码' },
          period: { type: 'string', description: '时间周期' },
          dimensions: { type: 'object', description: '维度筛选' },
        },
        required: ['metricCode'],
      },
      requiredPermission: 'analytics.view',
      dataDomain: 'analytics',
      riskLevel: 'L0',
      sideEffect: false,
      idempotent: true,
      timeoutMs: 15000,
    },
    async (params, user) => {
      const db = await getSupabaseClient();
      let q = db.from('metric_snapshot')
        .select('id,metric_code,period,dimension_values,value,captured_at')
        .eq('tenant_id', user.tenantId)
        .eq('metric_code', params.metricCode as string);

      if (params.period) q = q.eq('period', params.period as string);

      const { data, error } = await q.order('captured_at', { ascending: false }).limit(100);
      if (error) throw new Error(error.message);

      return { snapshots: data ?? [], total: data?.length ?? 0 };
    },
  );

  registerTool(
    {
      code: 'metric.list',
      module: 'analytics',
      description: '列出指标定义',
      paramsSchema: {
        type: 'object',
        properties: {
          domain: { type: 'string', description: '指标域' },
        },
        required: [],
      },
      requiredPermission: 'analytics.view',
      dataDomain: 'analytics',
      riskLevel: 'L0',
      sideEffect: false,
      idempotent: true,
      timeoutMs: 10000,
    },
    async (params, user) => {
      const db = await getSupabaseClient();
      let q = db.from('metric_definition')
        .select('id,code,name,domain,unit,formula,source')
        .eq('tenant_id', user.tenantId);

      if (params.domain) q = q.eq('domain', params.domain as string);

      const { data, error } = await q;
      if (error) throw new Error(error.message);

      return { metrics: data ?? [] };
    },
  );

  registerTool(
    {
      code: 'dashboard.get',
      module: 'analytics',
      description: '获取看板数据',
      paramsSchema: {
        type: 'object',
        properties: {
          dashboardId: { type: 'string', description: '看板ID' },
        },
        required: ['dashboardId'],
      },
      requiredPermission: 'analytics.view',
      dataDomain: 'analytics',
      riskLevel: 'L0',
      sideEffect: false,
      idempotent: true,
      timeoutMs: 10000,
    },
    async (params, user) => {
      const db = await getSupabaseClient();

      const [dashResult, widgetResult] = await Promise.all([
        db.from('dashboard').select('id,code,name,type,layout,visibility').eq('id', params.dashboardId as string).eq('tenant_id', user.tenantId).single(),
        db.from('dashboard_widget').select('id,widget_type,title,config,sort').eq('dashboard_id', params.dashboardId as string).eq('tenant_id', user.tenantId).order('sort'),
      ]);

      if (dashResult.error) throw new Error(dashResult.error.message);

      return {
        dashboard: dashResult.data,
        widgets: widgetResult.data ?? [],
      };
    },
  );

  registerTool(
    {
      code: 'collaboration.summary',
      module: 'collab',
      description: '汇总协作进展',
      paramsSchema: {
        type: 'object',
        properties: {
          collaborationId: { type: 'string', description: '协作ID' },
        },
        required: ['collaborationId'],
      },
      requiredPermission: 'collab.view',
      dataDomain: 'collab',
      riskLevel: 'L0',
      sideEffect: false,
      idempotent: true,
      timeoutMs: 10000,
    },
    async (params, user) => {
      const db = await getSupabaseClient();

      const [collabResult, membersResult, tasksResult] = await Promise.all([
        db.from('collaboration').select('*').eq('id', params.collaborationId as string).eq('tenant_id', user.tenantId).single(),
        db.from('collaboration_member').select('user_id,role,joined_at').eq('collaboration_id', params.collaborationId as string).eq('tenant_id', user.tenantId),
        db.from('task').select('id,title,status,assignee_id').eq('tenant_id', user.tenantId).limit(20),
      ]);

      if (collabResult.error) throw new Error(collabResult.error.message);

      return {
        collaboration: collabResult.data,
        members: membersResult.data ?? [],
        relatedTasks: tasksResult.data ?? [],
      };
    },
  );

  registerTool(
    {
      code: 'collaboration.list',
      module: 'collab',
      description: '查询协作列表',
      paramsSchema: {
        type: 'object',
        properties: {
          status: { type: 'string', description: '协作状态' },
          limit: { type: 'number', description: '返回数量' },
        },
        required: [],
      },
      requiredPermission: 'collab.view',
      dataDomain: 'collab',
      riskLevel: 'L0',
      sideEffect: false,
      idempotent: true,
      timeoutMs: 10000,
    },
    async (params, user) => {
      const db = await getSupabaseClient();
      let q = db.from('collaboration')
        .select('id,code,title,type,status,owner_id')
        .eq('tenant_id', user.tenantId);

      if (params.status) q = q.eq('status', params.status as string);

      const limit = (params.limit as number) ?? 20;
      const { data, error } = await q.limit(limit);
      if (error) throw new Error(error.message);

      return { collaborations: data ?? [], total: data?.length ?? 0 };
    },
  );

  registerTool(
    {
      code: 'research.create',
      module: 'research',
      description: '创建研究报告',
      paramsSchema: {
        type: 'object',
        properties: {
          title: { type: 'string', description: '报告标题' },
          industryId: { type: 'string', description: '行业ID' },
          period: { type: 'string', description: '研究周期' },
          keyFindings: { type: 'object', description: '关键发现' },
        },
        required: ['title'],
      },
      requiredPermission: 'research.create',
      dataDomain: 'research',
      riskLevel: 'L1',
      sideEffect: true,
      idempotent: false,
      timeoutMs: 15000,
    },
    async (params, user) => {
      const db = await getSupabaseClient();
      const { data, error } = await db.from('industry_research').insert({
        id: crypto.randomUUID(),
        tenant_id: user.tenantId,
        industry_id: (params.industryId as string) ?? null,
        title: params.title as string,
        period: (params.period as string) ?? null,
        key_findings: (params.keyFindings as unknown[]) ?? [],
        created_by: user.id,
      }).select('id,title,status').single();

      if (error) throw new Error(error.message);
      return { research: data };
    },
  );

  registerTool(
    {
      code: 'knowledge.qa_log',
      module: 'knowledge',
      description: '记录知识问答日志',
      paramsSchema: {
        type: 'object',
        properties: {
          kbId: { type: 'string', description: '知识库ID' },
          question: { type: 'string', description: '问题' },
          answer: { type: 'string', description: '回答' },
          refs: { type: 'object', description: '引用来源' },
        },
        required: ['kbId', 'question'],
      },
      requiredPermission: 'knowledge.view',
      dataDomain: 'knowledge',
      riskLevel: 'L0',
      sideEffect: true,
      idempotent: true,
      timeoutMs: 5000,
    },
    async (params, user) => {
      const db = await getSupabaseClient();
      const { data, error } = await db.from('knowledge_qa_log').insert({
        id: crypto.randomUUID(),
        tenant_id: user.tenantId,
        kb_id: params.kbId as string,
        user_id: user.id,
        question: params.question as string,
        answer: (params.answer as string) ?? null,
        refs: (params.refs as unknown[]) ?? [],
      }).select('id').single();

      if (error) throw new Error(error.message);
      return { qaLogId: data?.id };
    },
  );
}

initBuiltinTools();
const dbOverrideCache = new Map<string, ToolDefinition>();

export async function loadToolsFromDB(tenantId: string): Promise<void> {
  const db = await getSupabaseClient();

  const { data } = await db.from('tool_registry')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('status', 'active');

  if (!data) return;

  for (const row of data) {
    const r = row as Record<string, unknown>;
    const code = r.code as string;
    const existing = toolRegistry.get(code);

    const dbDefinition: ToolDefinition = {
      code,
      module: existing?.definition.module ?? 'external',
      description: (r.description as string) ?? existing?.definition.description ?? '',
      paramsSchema: existing?.definition.paramsSchema ?? (r.input_schema as Record<string, unknown>) ?? {},
      requiredPermission: existing?.definition.requiredPermission ?? 'tool.execute',
      dataDomain: existing?.definition.dataDomain ?? 'general',
      riskLevel: existing?.definition.riskLevel ?? 'L1',
      sideEffect: existing?.definition.sideEffect ?? true,
      idempotent: existing?.definition.idempotent ?? false,
      timeoutMs: (r.timeout_ms as number) ?? existing?.definition.timeoutMs ?? 30000,
      category: (r.category as ToolCategory) ?? existing?.definition.category,
      executionType: (r.execution_type as 'sync' | 'async') ?? existing?.definition.executionType,
      inputSchema: (r.input_schema as Record<string, unknown>) ?? existing?.definition.inputSchema,
      outputSchema: (r.output_schema as Record<string, unknown>) ?? existing?.definition.outputSchema,
      endpoint: (r.endpoint as string) ?? existing?.definition.endpoint,
      approvalPolicy: (r.approval_policy as ApprovalPolicy) ?? existing?.definition.approvalPolicy,
      rateLimit: (r.rate_limit as RateLimit) ?? existing?.definition.rateLimit,
      retryPolicy: (r.retry_policy as { maxRetries: number; backoffMs: number }) ?? existing?.definition.retryPolicy,
    };

    dbOverrideCache.set(code, dbDefinition);

    if (existing) {
      toolRegistry.set(code, { definition: dbDefinition, executor: existing.executor });
    }
  }
}

export async function registerToolToDB(
  tenantId: string,
  definition: Omit<ToolDefinition, 'code'> & { code: string; name: string },
): Promise<void> {
  const db = await getSupabaseClient();

  const id = crypto.randomUUID();

  await db.from('tool_registry').insert({
    id,
    tenant_id: tenantId,
    code: definition.code,
    name: definition.name,
    category: definition.category ?? 'EXTERNAL_API',
    description: definition.description,
    input_schema: definition.inputSchema ?? definition.paramsSchema,
    output_schema: definition.outputSchema ?? {},
    execution_type: definition.executionType ?? 'local',
    endpoint: definition.endpoint ?? null,
    approval_policy: definition.approvalPolicy ?? 'none',
    rate_limit: definition.rateLimit ?? {},
    retry_policy: definition.retryPolicy ?? { maxRetries: 0, backoffMs: 0 },
    timeout_ms: definition.timeoutMs ?? 30000,
    status: 'active',
  });
}

export function getEffectiveToolDefinition(code: string): ToolDefinition | null {
  if (dbOverrideCache.has(code)) {
    return dbOverrideCache.get(code)!;
  }
  return toolRegistry.get(code)?.definition ?? null;
}

export function isToolRegistered(code: string): boolean {
  return toolRegistry.has(code) || dbOverrideCache.has(code);
}

export function clearDbOverrideCache(): void {
  dbOverrideCache.clear();
}