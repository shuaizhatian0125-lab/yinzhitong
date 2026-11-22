import { getSupabaseClient } from '@/storage/database/supabase-client';
import type { SessionUser } from '@/lib/auth';

export type CollaborationTemplate = {
  id: string;
  tenantId: string;
  name: string;
  description: string | null;
  collaborationType: string;
  structureType: string;
  participantTemplate: ParticipantTemplateItem[];
  workstreamTemplate: WorkstreamTemplateItem[];
  ruleTemplate: RuleTemplate;
  sourceCollaborationId: string | null;
  createdAt: string;
};

export type ParticipantTemplateItem = {
  type: string;
  role: string;
  permissions: string[];
  responsibilities: string[];
};

export type WorkstreamTemplateItem = {
  phase: string;
  name: string;
  objectives: string[];
  dependencies: string[];
  estimatedDuration: string;
  executor: string;
};

export type RuleTemplate = {
  coordinatorMode: string;
  humanConfirmationTriggers: string[];
  decisionRules: string[];
  conflictResolutionRules: string[];
};

export type CreateTemplateInput = {
  name: string;
  description?: string;
  collaborationType: string;
  structureType?: string;
  participantTemplate?: ParticipantTemplateItem[];
  workstreamTemplate?: WorkstreamTemplateItem[];
  ruleTemplate?: RuleTemplate;
};

export type TemplateCategory =
  | 'RESEARCH'
  | 'PROJECT'
  | 'CROSS_DEPT'
  | 'CUSTOMER'
  | 'COMPLIANCE'
  | 'STRATEGIC_PLANNING'
  | 'RISK_ASSESSMENT'
  | 'KNOWLEDGE_BUILDING'
  | 'INNOVATION';

const DEFAULT_TEMPLATES: Record<TemplateCategory, CreateTemplateInput> = {
  RESEARCH: {
    name: '研究协作模板',
    description: '适用于行业研究、市场分析等研究类协作',
    collaborationType: 'RESEARCH',
    structureType: 'FLAT',
    participantTemplate: [
      { type: 'HUMAN', role: 'OWNER', permissions: ['*'], responsibilities: ['目标确认', '成果审核'] },
      { type: 'AI_AGENT', role: 'RESEARCHER', permissions: ['knowledge.view', 'search.execute'], responsibilities: ['信息收集', '数据分析'] },
      { type: 'AI_AGENT', role: 'ANALYST', permissions: ['knowledge.view', 'analytics.execute'], responsibilities: ['深度分析', '报告撰写'] },
    ],
    workstreamTemplate: [
      { phase: 'Phase 1', name: '背景调研', objectives: ['行业背景', '竞品分析'], dependencies: [], estimatedDuration: '1-2天', executor: 'research_agent' },
      { phase: 'Phase 2', name: '深度分析', objectives: ['数据整理', '趋势分析'], dependencies: ['背景调研'], estimatedDuration: '2-3天', executor: 'analysis_agent' },
      { phase: 'Phase 3', name: '成果整合', objectives: ['报告撰写', '审核修订'], dependencies: ['深度分析'], estimatedDuration: '1-2天', executor: 'human' },
    ],
    ruleTemplate: {
      coordinatorMode: 'AI_COORDINATED',
      humanConfirmationTriggers: ['关键结论确认', '成果发布审核'],
      decisionRules: ['研究方案选择需 OWNER 确认'],
      conflictResolutionRules: ['数据冲突以多源交叉验证为准'],
    },
  },
  PROJECT: {
    name: '项目协作模板',
    description: '适用于项目管理、任务执行等项目类协作',
    collaborationType: 'PROJECT',
    structureType: 'HIERARCHICAL',
    participantTemplate: [
      { type: 'HUMAN', role: 'OWNER', permissions: ['*'], responsibilities: ['项目决策', '资源分配'] },
      { type: 'HUMAN', role: 'LEADER', permissions: ['task.manage'], responsibilities: ['任务分配', '进度跟踪'] },
      { type: 'AI_AGENT', role: 'ASSISTANT', permissions: ['task.view', 'notification.send'], responsibilities: ['进度提醒', '风险预警'] },
    ],
    workstreamTemplate: [
      { phase: 'Phase 1', name: '项目启动', objectives: ['需求确认', '计划制定'], dependencies: [], estimatedDuration: '2-3天', executor: 'human' },
      { phase: 'Phase 2', name: '项目执行', objectives: ['任务执行', '进度跟踪'], dependencies: ['项目启动'], estimatedDuration: '5-10天', executor: 'mixed' },
      { phase: 'Phase 3', name: '项目收尾', objectives: ['成果验收', '经验总结'], dependencies: ['项目执行'], estimatedDuration: '1-2天', executor: 'human' },
    ],
    ruleTemplate: {
      coordinatorMode: 'AI_ASSISTED',
      humanConfirmationTriggers: ['项目计划变更', '资源重新分配', '里程碑验收'],
      decisionRules: ['项目计划变更需 OWNER 确认'],
      conflictResolutionRules: ['任务冲突由 LEADER 协调'],
    },
  },
  CROSS_DEPT: {
    name: '跨部门协作模板',
    description: '适用于跨部门项目、联合调研等跨部门协作',
    collaborationType: 'CROSS_DEPT_PROJECT',
    structureType: 'MATRIX',
    participantTemplate: [
      { type: 'HUMAN', role: 'OWNER', permissions: ['*'], responsibilities: ['整体协调', '关键决策'] },
      { type: 'HUMAN', role: 'LEADER', permissions: ['dept.scope'], responsibilities: ['部门内协调'] },
      { type: 'AI_AGENT', role: 'COORDINATOR', permissions: ['collaboration.coordinate'], responsibilities: ['跨部门信息同步'] },
    ],
    workstreamTemplate: [
      { phase: 'Phase 1', name: '需求对齐', objectives: ['各部门需求收集', '目标统一'], dependencies: [], estimatedDuration: '3-5天', executor: 'human' },
      { phase: 'Phase 2', name: '联合执行', objectives: ['各部门任务执行', '进度同步'], dependencies: ['需求对齐'], estimatedDuration: '5-15天', executor: 'mixed' },
      { phase: 'Phase 3', name: '成果整合', objectives: ['跨部门成果汇总', '统一交付'], dependencies: ['联合执行'], estimatedDuration: '2-3天', executor: 'human' },
    ],
    ruleTemplate: {
      coordinatorMode: 'AI_ASSISTED',
      humanConfirmationTriggers: ['跨部门数据共享', '目标范围变更'],
      decisionRules: ['跨部门决策需 OWNER + 相关 LEADER 共同确认'],
      conflictResolutionRules: ['部门间冲突由 OWNER 协调'],
    },
  },
  CUSTOMER: {
    name: '客户协作模板',
    description: '适用于客户服务、客户调研等客户相关协作',
    collaborationType: 'PROJECT',
    structureType: 'FLAT',
    participantTemplate: [
      { type: 'HUMAN', role: 'OWNER', permissions: ['customer.view'], responsibilities: ['客户关系管理'] },
      { type: 'AI_AGENT', role: 'ANALYST', permissions: ['customer.view', 'analytics.execute'], responsibilities: ['客户数据分析'] },
    ],
    workstreamTemplate: [
      { phase: 'Phase 1', name: '客户调研', objectives: ['客户需求收集', '客户画像分析'], dependencies: [], estimatedDuration: '2-3天', executor: 'mixed' },
      { phase: 'Phase 2', name: '方案制定', objectives: ['服务方案设计', '方案评审'], dependencies: ['客户调研'], estimatedDuration: '3-5天', executor: 'human' },
    ],
    ruleTemplate: {
      coordinatorMode: 'AI_COORDINATED',
      humanConfirmationTriggers: ['客户数据访问', '方案对外发送'],
      decisionRules: ['客户相关决策需 OWNER 确认'],
      conflictResolutionRules: ['客户冲突优先保障客户体验'],
    },
  },
  COMPLIANCE: {
    name: '合规审查协作模板',
    description: '适用于合规审查、风险评估等合规类协作',
    collaborationType: 'COMPLIANCE_REVIEW',
    structureType: 'HIERARCHICAL',
    participantTemplate: [
      { type: 'HUMAN', role: 'OWNER', permissions: ['*'], responsibilities: ['合规决策', '审查审批'] },
      { type: 'HUMAN', role: 'REVIEWER', permissions: ['compliance.view'], responsibilities: ['合规审查'] },
      { type: 'AI_AGENT', role: 'ANALYST', permissions: ['compliance.view', 'search.execute'], responsibilities: ['合规数据分析'] },
    ],
    workstreamTemplate: [
      { phase: 'Phase 1', name: '合规调研', objectives: ['法规收集', '合规要求梳理'], dependencies: [], estimatedDuration: '2-3天', executor: 'mixed' },
      { phase: 'Phase 2', name: '合规审查', objectives: ['合规风险评估', '整改建议'], dependencies: ['合规调研'], estimatedDuration: '3-5天', executor: 'human' },
    ],
    ruleTemplate: {
      coordinatorMode: 'HUMAN',
      humanConfirmationTriggers: ['所有合规决策', '整改方案确认'],
      decisionRules: ['合规决策必须人工确认'],
      conflictResolutionRules: ['合规冲突以法规为准'],
    },
  },
  STRATEGIC_PLANNING: {
    name: '战略规划协作模板',
    description: '适用于战略规划、业务规划等战略类协作',
    collaborationType: 'STRATEGIC_PLANNING',
    structureType: 'HIERARCHICAL',
    participantTemplate: [
      { type: 'HUMAN', role: 'OWNER', permissions: ['*'], responsibilities: ['战略决策'] },
      { type: 'HUMAN', role: 'ADVISOR', permissions: ['strategy.view'], responsibilities: ['战略建议'] },
      { type: 'AI_AGENT', role: 'ANALYST', permissions: ['analytics.execute', 'search.execute'], responsibilities: ['数据分析', '趋势预测'] },
    ],
    workstreamTemplate: [
      { phase: 'Phase 1', name: '战略分析', objectives: ['环境分析', '竞争分析'], dependencies: [], estimatedDuration: '3-5天', executor: 'mixed' },
      { phase: 'Phase 2', name: '战略制定', objectives: ['战略方案设计', '方案评审'], dependencies: ['战略分析'], estimatedDuration: '5-7天', executor: 'human' },
    ],
    ruleTemplate: {
      coordinatorMode: 'AI_ASSISTED',
      humanConfirmationTriggers: ['战略方向决策', '资源分配确认'],
      decisionRules: ['战略决策需 OWNER + ADVISOR 确认'],
      conflictResolutionRules: ['战略冲突由 OWNER 最终决策'],
    },
  },
  RISK_ASSESSMENT: {
    name: '风险评估协作模板',
    description: '适用于风险识别、风险评估等风险类协作',
    collaborationType: 'RISK_ASSESSMENT',
    structureType: 'FLAT',
    participantTemplate: [
      { type: 'HUMAN', role: 'OWNER', permissions: ['*'], responsibilities: ['风险决策'] },
      { type: 'AI_AGENT', role: 'ANALYST', permissions: ['risk.view', 'analytics.execute'], responsibilities: ['风险数据分析'] },
    ],
    workstreamTemplate: [
      { phase: 'Phase 1', name: '风险识别', objectives: ['风险因素收集', '风险分类'], dependencies: [], estimatedDuration: '1-2天', executor: 'mixed' },
      { phase: 'Phase 2', name: '风险评估', objectives: ['风险等级评定', '风险缓解方案'], dependencies: ['风险识别'], estimatedDuration: '2-3天', executor: 'human' },
    ],
    ruleTemplate: {
      coordinatorMode: 'AI_ASSISTED',
      humanConfirmationTriggers: ['风险等级确认', '缓解方案审批'],
      decisionRules: ['风险决策需 OWNER 确认'],
      conflictResolutionRules: ['风险冲突以保守评估为准'],
    },
  },
  KNOWLEDGE_BUILDING: {
    name: '知识建设协作模板',
    description: '适用于知识库建设、经验沉淀等知识类协作',
    collaborationType: 'KNOWLEDGE_BUILDING',
    structureType: 'FLAT',
    participantTemplate: [
      { type: 'HUMAN', role: 'OWNER', permissions: ['*'], responsibilities: ['知识审核'] },
      { type: 'AI_AGENT', role: 'CURATOR', permissions: ['knowledge.view', 'knowledge.write'], responsibilities: ['知识整理', '知识标注'] },
    ],
    workstreamTemplate: [
      { phase: 'Phase 1', name: '知识收集', objectives: ['知识来源识别', '知识内容收集'], dependencies: [], estimatedDuration: '2-3天', executor: 'mixed' },
      { phase: 'Phase 2', name: '知识整理', objectives: ['知识分类', '知识标注', '知识入库'], dependencies: ['知识收集'], estimatedDuration: '3-5天', executor: 'mixed' },
    ],
    ruleTemplate: {
      coordinatorMode: 'AI_COORDINATED',
      humanConfirmationTriggers: ['知识发布', '知识删除'],
      decisionRules: ['知识发布需 OWNER 审核'],
      conflictResolutionRules: ['知识冲突以权威来源为准'],
    },
  },
  INNOVATION: {
    name: '创新协作模板',
    description: '适用于创新探索、产品创新等创新类协作',
    collaborationType: 'INNOVATION',
    structureType: 'NETWORK',
    participantTemplate: [
      { type: 'HUMAN', role: 'OWNER', permissions: ['*'], responsibilities: ['创新方向决策'] },
      { type: 'HUMAN', role: 'CONTRIBUTOR', permissions: ['innovation.view'], responsibilities: ['创意贡献'] },
      { type: 'AI_AGENT', role: 'ANALYST', permissions: ['search.execute', 'analytics.execute'], responsibilities: ['创意分析', '可行性评估'] },
    ],
    workstreamTemplate: [
      { phase: 'Phase 1', name: '创意收集', objectives: ['创意征集', '创意分类'], dependencies: [], estimatedDuration: '2-3天', executor: 'mixed' },
      { phase: 'Phase 2', name: '创意评估', objectives: ['可行性分析', '创意筛选'], dependencies: ['创意收集'], estimatedDuration: '3-5天', executor: 'mixed' },
    ],
    ruleTemplate: {
      coordinatorMode: 'AI_COORDINATED',
      humanConfirmationTriggers: ['创意筛选', '创新方向决策'],
      decisionRules: ['创新方向需 OWNER 确认'],
      conflictResolutionRules: ['创意冲突以可行性评估为准'],
    },
  },
};

export async function createTemplate(
  tenantId: string,
  input: CreateTemplateInput,
): Promise<CollaborationTemplate> {
  const db = await getSupabaseClient();

  const id = crypto.randomUUID();

  const { data, error } = await db.from('collaboration_templates').insert({
    id,
    tenant_id: tenantId,
    name: input.name,
    description: input.description ?? null,
    collaboration_type: input.collaborationType,
    structure_type: input.structureType ?? 'FLAT',
    participant_template: input.participantTemplate ?? [],
    workstream_template: input.workstreamTemplate ?? [],
    rule_template: input.ruleTemplate ?? {},
    source_collaboration_id: null,
  }).select('*').limit(1);

  if (error || !data?.[0]) {
    throw new Error(`创建模板失败: ${error?.message ?? '未知错误'}`);
  }

  return mapRowToTemplate(data[0] as Record<string, unknown>);
}

export async function listTemplates(
  tenantId: string,
  collaborationType?: string,
): Promise<CollaborationTemplate[]> {
  const db = await getSupabaseClient();

  let query = db.from('collaboration_templates')
    .select('*')
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false });

  if (collaborationType) {
    query = query.eq('collaboration_type', collaborationType);
  }

  const { data } = await query;
  return (data ?? []).map(row => mapRowToTemplate(row as Record<string, unknown>));
}

export async function getTemplate(
  tenantId: string,
  templateId: string,
): Promise<CollaborationTemplate | null> {
  const db = await getSupabaseClient();
  const { data } = await db.from('collaboration_templates')
    .select('*')
    .eq('id', templateId)
    .eq('tenant_id', tenantId)
    .limit(1);

  if (!data?.[0]) return null;
  return mapRowToTemplate(data[0] as Record<string, unknown>);
}

export async function createFromTemplate(
  tenantId: string,
  templateId: string,
  user: SessionUser,
  overrides?: {
    name?: string;
    description?: string;
  },
): Promise<string> {
  const db = await getSupabaseClient();

  const template = await getTemplate(tenantId, templateId);
  if (!template) {
    throw new Error('模板不存在');
  }

  const collaborationId = crypto.randomUUID();
  const name = overrides?.name ?? template.name;

  await db.from('collaborations').insert({
    id: collaborationId,
    tenant_id: tenantId,
    name,
    type: template.collaborationType,
    scale: 'MEDIUM',
    structure_type: template.structureType,
    coordinator_mode: template.ruleTemplate.coordinatorMode ?? 'AI_COORDINATED',
    status: 'draft',
    description: overrides?.description ?? template.description,
    owner_id: user.id,
    success_criteria: '',
  });

  for (const pt of template.participantTemplate) {
    if (pt.type === 'HUMAN') {
      await db.from('collaboration_participants').insert({
        id: crypto.randomUUID(),
        tenant_id: tenantId,
        collaboration_id: collaborationId,
        participant_type: 'HUMAN',
        native_entity_id: user.id,
        role: pt.role,
        permissions: pt.permissions,
        status: 'active',
      });
    }
  }

  for (const ws of template.workstreamTemplate) {
    await db.from('collaboration_workstreams').insert({
      id: crypto.randomUUID(),
      tenant_id: tenantId,
      collaboration_id: collaborationId,
      name: ws.name,
      phase: ws.phase,
      objectives: ws.objectives,
      dependencies: ws.dependencies,
      status: 'planning',
      progress: 0,
    });
  }

  return collaborationId;
}

export async function createFromRetrospective(
  tenantId: string,
  sourceCollaborationId: string,
  templateName: string,
  user: SessionUser,
): Promise<CollaborationTemplate> {
  const db = await getSupabaseClient();

  const { data: collab } = await db.from('collaborations')
    .select('id,name,type,scale,structure_type,coordinator_mode,success_criteria')
    .eq('id', sourceCollaborationId)
    .eq('tenant_id', tenantId)
    .single();

  if (!collab) {
    throw new Error('源协作不存在');
  }

  const { data: participants } = await db.from('collaboration_participants')
    .select('participant_type,role,permissions')
    .eq('collaboration_id', sourceCollaborationId)
    .eq('tenant_id', tenantId);

  const { data: workstreams } = await db.from('collaboration_workstreams')
    .select('name,phase,objectives,dependencies')
    .eq('collaboration_id', sourceCollaborationId)
    .eq('tenant_id', tenantId);

  const participantTemplate: ParticipantTemplateItem[] = (participants ?? []).map((p: Record<string, unknown>) => ({
    type: p.participant_type as string,
    role: p.role as string,
    permissions: (p.permissions as string[]) ?? [],
    responsibilities: [],
  }));

  const workstreamTemplate: WorkstreamTemplateItem[] = (workstreams ?? []).map((ws: Record<string, unknown>) => ({
    phase: ws.phase as string,
    name: ws.name as string,
    objectives: (ws.objectives as string[]) ?? [],
    dependencies: (ws.dependencies as string[]) ?? [],
    estimatedDuration: '待评估',
    executor: 'mixed',
  }));

  return createTemplate(tenantId, {
    name: templateName,
    description: `基于协作 "${collab.name as string}" 复盘沉淀`,
    collaborationType: collab.type as string,
    structureType: collab.structure_type as string,
    participantTemplate,
    workstreamTemplate,
    ruleTemplate: {
      coordinatorMode: collab.coordinator_mode as string ?? 'AI_COORDINATED',
      humanConfirmationTriggers: [],
      decisionRules: [],
      conflictResolutionRules: [],
    },
  });
}

export function getDefaultTemplate(category: TemplateCategory): CreateTemplateInput {
  return DEFAULT_TEMPLATES[category];
}

export function listDefaultTemplateCategories(): TemplateCategory[] {
  return Object.keys(DEFAULT_TEMPLATES) as TemplateCategory[];
}

function mapRowToTemplate(row: Record<string, unknown>): CollaborationTemplate {
  return {
    id: row.id as string,
    tenantId: row.tenant_id as string,
    name: row.name as string,
    description: row.description as string | null,
    collaborationType: row.collaboration_type as string,
    structureType: row.structure_type as string,
    participantTemplate: (row.participant_template as ParticipantTemplateItem[]) ?? [],
    workstreamTemplate: (row.workstream_template as WorkstreamTemplateItem[]) ?? [],
    ruleTemplate: (row.rule_template as RuleTemplate) ?? {
      coordinatorMode: 'AI_COORDINATED',
      humanConfirmationTriggers: [],
      decisionRules: [],
      conflictResolutionRules: [],
    },
    sourceCollaborationId: row.source_collaboration_id as string | null,
    createdAt: row.created_at as string,
  };
}