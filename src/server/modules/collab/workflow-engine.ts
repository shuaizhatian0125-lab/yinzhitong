import { getSupabaseClient } from '@/storage/database/supabase-client';
import { createNotification } from '@/server/platform/notification/service';

export type WorkflowType =
  | 'SEQUENTIAL'
  | 'PARALLEL'
  | 'CONDITIONAL'
  | 'HUMAN_APPROVAL'
  | 'AI_PIPELINE'
  | 'EVENT_DRIVEN'
  | 'HYBRID';

export type NodeType =
  | 'START'
  | 'END'
  | 'TASK'
  | 'AI_AGENT'
  | 'HUMAN'
  | 'APPROVAL'
  | 'CONDITION'
  | 'PARALLEL'
  | 'JOIN'
  | 'DATA'
  | 'API'
  | 'NOTIFICATION'
  | 'DELAY'
  | 'SUBWORKFLOW'
  | 'ARTIFACT'
  | 'ai_task'
  | 'human_task'
  | 'approval'
  | 'condition'
  | 'notify'
  | 'integration';

export type WorkflowControlAction =
  | 'PAUSE'
  | 'RESUME'
  | 'RETRY'
  | 'RE_EXECUTE_NODE'
  | 'CANCEL';

export type WorkflowDefinition = {
  type?: WorkflowType;
  startNodeKey: string;
  endNodeKey?: string;
  nodes: WorkflowNode[];
  collaborationId?: string;
};

export type WorkflowNode = {
  key: string;
  type: NodeType;
  name: string;
  assigneeId?: string;
  approverIds?: string[];
  approvalMode?: 'or' | 'and' | 'add';
  condition?: string;
  nextNodeKey?: string;
  parallelBranches?: string[];
  joinKeys?: string[];
  config?: Record<string, unknown>;
  idempotentKey?: string;
};

export type WorkflowDefRow = {
  id: string;
  tenant_id: string;
  code: string;
  name: string;
  version: number;
  definition: Record<string, unknown>;
  status: string;
  collaboration_id: string | null;
  created_by: string | null;
  created_at: string;
};

export type WorkflowInstanceRow = {
  id: string;
  tenant_id: string;
  def_id: string;
  def_version: number;
  business_type: string | null;
  business_id: string | null;
  collaboration_id: string | null;
  trigger_event: string | null;
  status: string;
  context: Record<string, unknown>;
  current_node_key: string | null;
  started_by: string | null;
  started_at: string;
  finished_at: string | null;
};

export type WorkflowNodeInstanceRow = {
  id: string;
  tenant_id: string;
  instance_id: string;
  node_key: string;
  node_type: string;
  status: string;
  assignee_id: string | null;
  input: Record<string, unknown> | null;
  output: Record<string, unknown> | null;
  due_at: string | null;
  retry_count: number;
  error: string | null;
  idempotent_key: string | null;
  started_at: string | null;
  finished_at: string | null;
};

export type CreateWorkflowDefInput = {
  code: string;
  name: string;
  definition: WorkflowDefinition;
  collaborationId?: string;
};

export type StartWorkflowInput = {
  variables: Record<string, unknown>;
  businessType?: string;
  businessId?: string;
  collaborationId?: string;
  triggerEvent?: string;
};

export type CompleteNodeInput = {
  result: Record<string, unknown>;
};

const NODE_AUTO_COMPLETE_TYPES: Set<NodeType> = new Set([
  'START',
  'END',
  'AI_AGENT',
  'DATA',
  'API',
  'NOTIFICATION',
  'DELAY',
  'SUBWORKFLOW',
  'ARTIFACT',
  'ai_task',
  'integration',
  'notify',
]);

function normalizeNodeType(type: NodeType): NodeType {
  const legacyMap: Record<string, NodeType> = {
    'ai_task': 'AI_AGENT',
    'human_task': 'HUMAN',
    'approval': 'APPROVAL',
    'condition': 'CONDITION',
    'notify': 'NOTIFICATION',
    'integration': 'API',
  };
  return legacyMap[type] ?? type;
}

export async function createWorkflowDef(
  tenantId: string,
  createdBy: string,
  input: CreateWorkflowDefInput,
): Promise<WorkflowDefRow> {
  const db = getSupabaseClient();

  const { data: existing } = await db
    .from('workflow_def')
    .select('version')
    .eq('tenant_id', tenantId)
    .eq('code', input.code)
    .order('version', { ascending: false })
    .limit(1);

  const nextVersion = (existing?.[0]?.version ?? 0) + 1;
  const id = crypto.randomUUID();
  const now = new Date().toISOString();

  const { data, error } = await db
    .from('workflow_def')
    .insert({
      id,
      tenant_id: tenantId,
      code: input.code,
      name: input.name,
      version: nextVersion,
      definition: input.definition as unknown as Record<string, unknown>,
      status: 'active',
      collaboration_id: input.collaborationId ?? null,
      created_by: createdBy,
      created_at: now,
    })
    .select('*')
    .limit(1);

  if (error || !data?.[0]) {
    throw new Error(`创建流程定义失败: ${error?.message ?? '未知错误'}`);
  }

  return data[0] as WorkflowDefRow;
}

export async function listWorkflowDefs(
  tenantId: string,
  filter?: { status?: string; keyword?: string; collaborationId?: string },
): Promise<WorkflowDefRow[]> {
  const db = getSupabaseClient();

  let query = db
    .from('workflow_def')
    .select('*')
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false });

  if (filter?.status) {
    query = query.eq('status', filter.status);
  }
  if (filter?.keyword) {
    query = query.or(`name.ilike.%${filter.keyword}%,code.ilike.%${filter.keyword}%`);
  }
  if (filter?.collaborationId) {
    query = query.eq('collaboration_id', filter.collaborationId);
  }

  const { data } = await query;
  return (data ?? []) as WorkflowDefRow[];
}

export async function getLatestWorkflowDef(
  tenantId: string,
  code: string,
): Promise<WorkflowDefRow | null> {
  const db = getSupabaseClient();

  const { data } = await db
    .from('workflow_def')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('code', code)
    .eq('status', 'active')
    .order('version', { ascending: false })
    .limit(1);

  return (data?.[0] as WorkflowDefRow | undefined) ?? null;
}

export async function startWorkflowInstance(
  tenantId: string,
  startedBy: string,
  code: string,
  input: StartWorkflowInput,
): Promise<WorkflowInstanceRow> {
  const db = getSupabaseClient();

  const def = await getLatestWorkflowDef(tenantId, code);
  if (!def) {
    throw new Error(`流程定义 ${code} 不存在`);
  }

  const definition = def.definition as unknown as WorkflowDefinition;
  const instanceId = crypto.randomUUID();
  const now = new Date().toISOString();

  const context: Record<string, unknown> = { ...input.variables };
  const collaborationId = input.collaborationId ?? def.collaboration_id ?? null;

  const { data, error } = await db
    .from('workflow_instance')
    .insert({
      id: instanceId,
      tenant_id: tenantId,
      def_id: def.id,
      def_version: def.version,
      business_type: input.businessType ?? null,
      business_id: input.businessId ?? null,
      collaboration_id: collaborationId,
      trigger_event: input.triggerEvent ?? null,
      status: 'running',
      context,
      current_node_key: definition.startNodeKey,
      started_by: startedBy,
      started_at: now,
    })
    .select('*')
    .limit(1);

  if (error || !data?.[0]) {
    throw new Error(`启动流程实例失败: ${error?.message ?? '未知错误'}`);
  }

  const instance = data[0] as WorkflowInstanceRow;

  await activateNode(tenantId, instanceId, definition.startNodeKey, definition, context, startedBy);

  return instance;
}

async function activateNode(
  tenantId: string,
  instanceId: string,
  nodeKey: string,
  definition: WorkflowDefinition,
  context: Record<string, unknown>,
  startedBy: string,
): Promise<void> {
  const db = getSupabaseClient();
  const node = definition.nodes.find((n) => n.key === nodeKey);
  if (!node) return;

  const now = new Date().toISOString();
  const nodeInstanceId = crypto.randomUUID();

  await db.from('workflow_instance').update({
    current_node_key: nodeKey,
  }).eq('id', instanceId).eq('tenant_id', tenantId);

  const { error } = await db.from('workflow_node_instance').insert({
    id: nodeInstanceId,
    tenant_id: tenantId,
    instance_id: instanceId,
    node_key: node.key,
    node_type: node.type,
    status: 'pending',
    assignee_id: node.assigneeId ?? null,
    input: context,
    idempotent_key: node.idempotentKey ?? null,
    started_at: now,
  });

  if (error) return;

  const normalizedType = normalizeNodeType(node.type);

  if (NODE_AUTO_COMPLETE_TYPES.has(normalizedType)) {
    await executeAutoNode(tenantId, instanceId, nodeInstanceId, node, definition, context, startedBy);
  } else if (normalizedType === 'CONDITION') {
    await executeConditionNode(tenantId, instanceId, nodeInstanceId, node, definition, context, startedBy);
  } else if (normalizedType === 'PARALLEL') {
    await executeParallelNode(tenantId, instanceId, nodeInstanceId, node, definition, context, startedBy);
  } else if (normalizedType === 'JOIN') {
    await executeJoinNode(tenantId, instanceId, nodeInstanceId, node, definition, context, startedBy);
  } else if (normalizedType === 'HUMAN' || normalizedType === 'APPROVAL') {
    await executeHumanOrApprovalNode(tenantId, instanceId, nodeInstanceId, node, definition, context);
  } else if (normalizedType === 'TASK') {
    await executeTaskNode(tenantId, instanceId, nodeInstanceId, node, definition, context, startedBy);
  }
}

async function executeAutoNode(
  tenantId: string,
  instanceId: string,
  nodeInstanceId: string,
  node: WorkflowNode,
  definition: WorkflowDefinition,
  context: Record<string, unknown>,
  startedBy: string,
): Promise<void> {
  const db = getSupabaseClient();

  await db.from('workflow_node_instance')
    .update({ status: 'in_progress' })
    .eq('id', nodeInstanceId);

  let output: Record<string, unknown> = {};

  const execType = normalizeNodeType(node.type);

  switch (execType) {
    case 'START':
      output = { started: true };
      break;
    case 'END':
      output = { ended: true };
      break;
    case 'AI_AGENT':
      output = { result: 'AI Agent 执行完成', agentConfig: node.config ?? {} };
      break;
    case 'DATA':
      output = { dataProcessed: true, config: node.config ?? {} };
      break;
    case 'API':
      output = { apiCalled: true, endpoint: node.config?.['endpoint'] ?? 'unknown' };
      break;
    case 'NOTIFICATION':
      if (node.assigneeId) {
        await createNotification(
          tenantId,
          node.assigneeId,
          'system_notice',
          node.name,
          `流程节点「${node.name}」通知`,
          instanceId,
        );
      }
      output = { notified: true };
      break;
    case 'DELAY':
      output = { delayed: true, duration: node.config?.['duration'] ?? 0 };
      break;
    case 'SUBWORKFLOW':
      output = { subWorkflowTriggered: true, subCode: node.config?.['workflowCode'] ?? '' };
      break;
    case 'ARTIFACT':
      output = { artifactProduced: true, artifactType: node.config?.['artifactType'] ?? 'document' };
      break;
    default:
      output = { result: `${node.type} 节点自动完成` };
  }

  await db.from('workflow_node_instance')
    .update({
      status: 'completed',
      output,
      finished_at: new Date().toISOString(),
    })
    .eq('id', nodeInstanceId);

  await proceedToNext(tenantId, instanceId, node, definition, context, startedBy);
}

async function executeConditionNode(
  tenantId: string,
  instanceId: string,
  nodeInstanceId: string,
  node: WorkflowNode,
  definition: WorkflowDefinition,
  context: Record<string, unknown>,
  startedBy: string,
): Promise<void> {
  const db = getSupabaseClient();

  const conditionResult = evaluateCondition(node.condition ?? '', context);
  const nextKey = conditionResult
    ? node.nextNodeKey
    : (node.config?.['elseNodeKey'] as string | undefined) ?? node.nextNodeKey;

  await db.from('workflow_node_instance')
    .update({
      status: 'completed',
      output: { conditionResult },
      finished_at: new Date().toISOString(),
    })
    .eq('id', nodeInstanceId);

  if (nextKey) {
    await activateNode(tenantId, instanceId, nextKey, definition, context, startedBy);
  } else {
    await finishInstance(tenantId, instanceId);
  }
}

async function executeParallelNode(
  tenantId: string,
  instanceId: string,
  nodeInstanceId: string,
  node: WorkflowNode,
  definition: WorkflowDefinition,
  context: Record<string, unknown>,
  startedBy: string,
): Promise<void> {
  const db = getSupabaseClient();

  await db.from('workflow_node_instance')
    .update({
      status: 'completed',
      output: { parallelBranches: node.parallelBranches ?? [] },
      finished_at: new Date().toISOString(),
    })
    .eq('id', nodeInstanceId);

  const branches = node.parallelBranches ?? [];
  for (const branchKey of branches) {
    await activateNode(tenantId, instanceId, branchKey, definition, context, startedBy);
  }
}

async function executeJoinNode(
  tenantId: string,
  instanceId: string,
  nodeInstanceId: string,
  node: WorkflowNode,
  definition: WorkflowDefinition,
  context: Record<string, unknown>,
  startedBy: string,
): Promise<void> {
  const db = getSupabaseClient();

  const joinKeys = node.joinKeys ?? [];
  const { data: joinNodes } = await db.from('workflow_node_instance')
    .select('id,node_key,status')
    .eq('instance_id', instanceId)
    .eq('tenant_id', tenantId)
    .in('node_key', joinKeys);

  const allCompleted = (joinNodes ?? []).every(
    (n: Record<string, unknown>) => n.status === 'completed' || n.status === 'skipped'
  );

  if (allCompleted) {
    await db.from('workflow_node_instance')
      .update({
        status: 'completed',
        output: { joined: true, branches: joinKeys },
        finished_at: new Date().toISOString(),
      })
      .eq('id', nodeInstanceId);

    await proceedToNext(tenantId, instanceId, node, definition, context, startedBy);
  } else {
    await db.from('workflow_node_instance')
      .update({
        status: 'pending',
        output: { waitingFor: joinKeys.filter(k =>
          !(joinNodes ?? []).some((n: Record<string, unknown>) => n.node_key === k && (n.status === 'completed' || n.status === 'skipped'))
        ) },
      })
      .eq('id', nodeInstanceId);
  }
}

async function executeHumanOrApprovalNode(
  tenantId: string,
  instanceId: string,
  nodeInstanceId: string,
  node: WorkflowNode,
  definition: WorkflowDefinition,
  context: Record<string, unknown>,
): Promise<void> {
  const db = getSupabaseClient();
  const now = new Date().toISOString();

  if (node.type === 'APPROVAL' && node.approverIds && node.approverIds.length > 0) {
    const approvalRows = node.approverIds.map((approverId) => ({
      id: crypto.randomUUID(),
      tenant_id: tenantId,
      instance_id: instanceId,
      node_key: node.key,
      business_type: 'workflow',
      business_id: instanceId,
      approver_id: approverId,
      decision: 'pending',
      created_at: now,
    }));

    await db.from('approval').insert(approvalRows);

    for (const approverId of node.approverIds) {
      await createNotification(
        tenantId,
        approverId,
        'approval_pending',
        `审批待办: ${node.name}`,
        `您有新的审批待办事项「${node.name}」`,
        instanceId,
      );
    }
  }
}

async function executeTaskNode(
  tenantId: string,
  instanceId: string,
  nodeInstanceId: string,
  node: WorkflowNode,
  definition: WorkflowDefinition,
  context: Record<string, unknown>,
  startedBy: string,
): Promise<void> {
  const db = getSupabaseClient();

  await db.from('workflow_node_instance')
    .update({ status: 'in_progress' })
    .eq('id', nodeInstanceId);

  await db.from('workflow_node_instance')
    .update({
      status: 'completed',
      output: { result: '任务节点自动完成' },
      finished_at: new Date().toISOString(),
    })
    .eq('id', nodeInstanceId);

  await proceedToNext(tenantId, instanceId, node, definition, context, startedBy);
}

async function proceedToNext(
  tenantId: string,
  instanceId: string,
  node: WorkflowNode,
  definition: WorkflowDefinition,
  context: Record<string, unknown>,
  startedBy: string,
): Promise<void> {
  if (normalizeNodeType(node.type) === 'END' || !node.nextNodeKey) {
    await finishInstance(tenantId, instanceId);
  } else {
    await activateNode(tenantId, instanceId, node.nextNodeKey, definition, context, startedBy);
  }
}

function evaluateCondition(condition: string, context: Record<string, unknown>): boolean {
  try {
    const keys = Object.keys(context);
    const values = Object.values(context);
    const fn = new Function(...keys, `return ${condition}`);
    return fn(...values) as boolean;
  } catch {
    return false;
  }
}

async function finishInstance(tenantId: string, instanceId: string): Promise<void> {
  const db = getSupabaseClient();
  await db
    .from('workflow_instance')
    .update({
      status: 'completed',
      current_node_key: null,
      finished_at: new Date().toISOString(),
    })
    .eq('id', instanceId)
    .eq('tenant_id', tenantId);
}

export async function completeNode(
  tenantId: string,
  instanceId: string,
  nodeKey: string,
  result: Record<string, unknown>,
): Promise<WorkflowNodeInstanceRow | null> {
  const db = getSupabaseClient();

  const { data: instanceData } = await db
    .from('workflow_instance')
    .select('*')
    .eq('id', instanceId)
    .eq('tenant_id', tenantId)
    .limit(1);

  const instance = instanceData?.[0] as WorkflowInstanceRow | undefined;
  if (!instance || instance.status !== 'running') {
    throw new Error('流程实例不存在或已结束');
  }

  const { data: defData } = await db
    .from('workflow_def')
    .select('*')
    .eq('id', instance.def_id)
    .limit(1);

  const def = defData?.[0] as WorkflowDefRow | undefined;
  if (!def) {
    throw new Error('流程定义不存在');
  }

  const definition = def.definition as unknown as WorkflowDefinition;
  const node = definition.nodes.find((n) => n.key === nodeKey);
  if (!node) {
    throw new Error(`节点 ${nodeKey} 不存在`);
  }

  const { data: nodeInstanceData } = await db
    .from('workflow_node_instance')
    .select('*')
    .eq('instance_id', instanceId)
    .eq('node_key', nodeKey)
    .eq('tenant_id', tenantId)
    .order('started_at', { ascending: false })
    .limit(1);

  const nodeInstance = nodeInstanceData?.[0] as WorkflowNodeInstanceRow | undefined;
  if (!nodeInstance || nodeInstance.status !== 'pending') {
    throw new Error('节点不存在或已完成');
  }

  const now = new Date().toISOString();
  const updatedContext = { ...instance.context, ...result };

  await db
    .from('workflow_instance')
    .update({ context: updatedContext })
    .eq('id', instanceId)
    .eq('tenant_id', tenantId);

  await db
    .from('workflow_node_instance')
    .update({
      status: 'completed',
      output: result,
      finished_at: now,
    })
    .eq('id', nodeInstance.id);

  await proceedToNext(tenantId, instanceId, node, definition, updatedContext, instance.started_by ?? '');

  return { ...nodeInstance, status: 'completed', output: result, finished_at: now };
}

export async function pauseWorkflow(
  tenantId: string,
  instanceId: string,
): Promise<WorkflowInstanceRow> {
  const db = getSupabaseClient();

  const { data: instance } = await db.from('workflow_instance')
    .select('*')
    .eq('id', instanceId)
    .eq('tenant_id', tenantId)
    .single();

  if (!instance) {
    throw new Error('流程实例不存在');
  }

  if (instance.status !== 'running') {
    throw new Error('只有运行中的流程可以暂停');
  }

  await db.from('workflow_instance')
    .update({ status: 'paused' })
    .eq('id', instanceId)
    .eq('tenant_id', tenantId);

  await db.from('workflow_node_instance')
    .update({ status: 'pending' })
    .eq('instance_id', instanceId)
    .eq('tenant_id', tenantId)
    .eq('status', 'in_progress');

  return { ...instance, status: 'paused' } as WorkflowInstanceRow;
}

export async function resumeWorkflow(
  tenantId: string,
  instanceId: string,
): Promise<WorkflowInstanceRow> {
  const db = getSupabaseClient();

  const { data: instance } = await db.from('workflow_instance')
    .select('*')
    .eq('id', instanceId)
    .eq('tenant_id', tenantId)
    .single();

  if (!instance) {
    throw new Error('流程实例不存在');
  }

  if (instance.status !== 'paused') {
    throw new Error('只有暂停的流程可以恢复');
  }

  await db.from('workflow_instance')
    .update({ status: 'running' })
    .eq('id', instanceId)
    .eq('tenant_id', tenantId);

  const currentNodeKey = instance.current_node_key as string | null;
  if (currentNodeKey) {
    const { data: defData } = await db.from('workflow_def')
      .select('*')
      .eq('id', instance.def_id)
      .limit(1);

    const def = defData?.[0] as WorkflowDefRow | undefined;
    if (def) {
      const definition = def.definition as unknown as WorkflowDefinition;
      const { data: pendingNodes } = await db.from('workflow_node_instance')
        .select('id,node_key,status')
        .eq('instance_id', instanceId)
        .eq('tenant_id', tenantId)
        .eq('status', 'pending')
        .order('started_at', { ascending: false })
        .limit(1);

      if (pendingNodes?.[0]) {
        const pendingNodeKey = pendingNodes[0].node_key as string;
        const node = definition.nodes.find(n => n.key === pendingNodeKey);
        if (node && NODE_AUTO_COMPLETE_TYPES.has(normalizeNodeType(node.type))) {
          await activateNode(
            tenantId,
            instanceId,
            pendingNodeKey,
            definition,
            instance.context as Record<string, unknown>,
            instance.started_by ?? '',
          );
        }
      }
    }
  }

  return { ...instance, status: 'running' } as WorkflowInstanceRow;
}

export async function cancelWorkflow(
  tenantId: string,
  instanceId: string,
): Promise<WorkflowInstanceRow> {
  const db = getSupabaseClient();

  const { data: instance } = await db.from('workflow_instance')
    .select('*')
    .eq('id', instanceId)
    .eq('tenant_id', tenantId)
    .single();

  if (!instance) {
    throw new Error('流程实例不存在');
  }

  if (instance.status === 'completed' || instance.status === 'cancelled') {
    throw new Error('已结束的流程无法取消');
  }

  await db.from('workflow_instance')
    .update({
      status: 'cancelled',
      current_node_key: null,
      finished_at: new Date().toISOString(),
    })
    .eq('id', instanceId)
    .eq('tenant_id', tenantId);

  await db.from('workflow_node_instance')
    .update({ status: 'skipped' })
    .eq('instance_id', instanceId)
    .eq('tenant_id', tenantId)
    .in('status', ['pending', 'in_progress']);

  return { ...instance, status: 'cancelled' } as WorkflowInstanceRow;
}

export async function retryNode(
  tenantId: string,
  instanceId: string,
  nodeKey: string,
): Promise<WorkflowNodeInstanceRow | null> {
  const db = getSupabaseClient();

  const { data: instance } = await db.from('workflow_instance')
    .select('*')
    .eq('id', instanceId)
    .eq('tenant_id', tenantId)
    .single();

  if (!instance) {
    throw new Error('流程实例不存在');
  }

  const { data: defData } = await db.from('workflow_def')
    .select('*')
    .eq('id', instance.def_id)
    .limit(1);

  const def = defData?.[0] as WorkflowDefRow | undefined;
  if (!def) {
    throw new Error('流程定义不存在');
  }

  const definition = def.definition as unknown as WorkflowDefinition;
  const node = definition.nodes.find(n => n.key === nodeKey);
  if (!node) {
    throw new Error(`节点 ${nodeKey} 不存在`);
  }

  const { data: failedNode } = await db.from('workflow_node_instance')
    .select('*')
    .eq('instance_id', instanceId)
    .eq('node_key', nodeKey)
    .eq('tenant_id', tenantId)
    .order('started_at', { ascending: false })
    .limit(1);

  const nodeInstance = failedNode?.[0] as WorkflowNodeInstanceRow | undefined;
  if (!nodeInstance) {
    throw new Error('节点实例不存在');
  }

  if (node.idempotentKey) {
    const { data: existing } = await db.from('workflow_node_instance')
      .select('id,status,output')
      .eq('instance_id', instanceId)
      .eq('tenant_id', tenantId)
      .eq('idempotent_key', node.idempotentKey)
      .neq('id', nodeInstance.id)
      .limit(1);

    if (existing?.[0] && (existing[0].status === 'completed' || existing[0].status === 'in_progress')) {
      throw new Error('幂等检查失败：该节点已产生外部副作用，不可重复执行');
    }
  }

  const newNodeInstanceId = crypto.randomUUID();
  await db.from('workflow_node_instance').insert({
    id: newNodeInstanceId,
    tenant_id: tenantId,
    instance_id: instanceId,
    node_key: nodeKey,
    node_type: node.type,
    status: 'pending',
    assignee_id: node.assigneeId ?? null,
    input: instance.context as Record<string, unknown>,
    retry_count: (nodeInstance.retry_count ?? 0) + 1,
    idempotent_key: node.idempotentKey ?? null,
    started_at: new Date().toISOString(),
  });

  if (NODE_AUTO_COMPLETE_TYPES.has(normalizeNodeType(node.type))) {
    await executeAutoNode(
      tenantId,
      instanceId,
      newNodeInstanceId,
      node,
      definition,
      instance.context as Record<string, unknown>,
      instance.started_by ?? '',
    );
  }

  const { data: updatedNode } = await db.from('workflow_node_instance')
    .select('*')
    .eq('id', newNodeInstanceId)
    .eq('tenant_id', tenantId)
    .limit(1);

  return (updatedNode?.[0] as WorkflowNodeInstanceRow | undefined) ?? null;
}

export async function getWorkflowInstance(
  tenantId: string,
  instanceId: string,
): Promise<{
  instance: WorkflowInstanceRow;
  def: WorkflowDefRow | null;
  nodes: WorkflowNodeInstanceRow[];
} | null> {
  const db = getSupabaseClient();

  const { data: instanceData } = await db
    .from('workflow_instance')
    .select('*')
    .eq('id', instanceId)
    .eq('tenant_id', tenantId)
    .limit(1);

  const instance = instanceData?.[0] as WorkflowInstanceRow | undefined;
  if (!instance) return null;

  const [{ data: defData }, { data: nodeData }] = await Promise.all([
    db.from('workflow_def').select('*').eq('id', instance.def_id).limit(1),
    db
      .from('workflow_node_instance')
      .select('*')
      .eq('instance_id', instanceId)
      .eq('tenant_id', tenantId)
      .order('started_at', { ascending: true }),
  ]);

  return {
    instance,
    def: (defData?.[0] as WorkflowDefRow | undefined) ?? null,
    nodes: (nodeData ?? []) as WorkflowNodeInstanceRow[],
  };
}

export async function listWorkflowsByCollaboration(
  tenantId: string,
  collaborationId: string,
): Promise<WorkflowInstanceRow[]> {
  const db = getSupabaseClient();

  const { data } = await db.from('workflow_instance')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('collaboration_id', collaborationId)
    .order('started_at', { ascending: false });

  return (data ?? []) as WorkflowInstanceRow[];
}