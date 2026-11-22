import { getSupabaseClient } from '@/storage/database/supabase-client';
import type { SessionUser } from '@/lib/auth';

export type CollaborationDraft = {
  id: string;
  goal: GoalPreview;
  organization: OrganizationPreview;
  workPlan: WorkPlanPreview;
  collaborationRules: CollaborationRulesPreview;
  risks: RisksPreview;
  status: 'DRAFT' | 'VALIDATED' | 'CREATED';
  createdAt: string;
};

export type GoalPreview = {
  commonGoal: string;
  goalBackground: string;
  goalScope: string;
  successCriteria: string[];
  deliverables: string[];
};

export type OrganizationPreview = {
  owner: string;
  aiCoordinator: string;
  agentMembers: AgentMemberPreview[];
  humanMembers: HumanMemberPreview[];
  departments: string[];
  systems: string[];
};

export type AgentMemberPreview = {
  agentCode: string;
  role: string;
  responsibilities: string[];
};

export type HumanMemberPreview = {
  userId: string;
  role: string;
  responsibilities: string[];
};

export type WorkPlanPreview = {
  phases: PhasePreview[];
};

export type PhasePreview = {
  name: string;
  workstreams: WorkstreamPreview[];
};

export type WorkstreamPreview = {
  name: string;
  tasks: TaskPreview[];
  dependencies: string[];
  estimatedDuration: string;
  executor: string;
};

export type TaskPreview = {
  name: string;
  description: string;
  estimatedWorkload: string;
};

export type CollaborationRulesPreview = {
  coordinator: string;
  taskCreator: string;
  planModifier: string;
  dataViewer: string;
  reviewer: string;
  humanConfirmationTriggers: string[];
};

export type RisksPreview = {
  timeRisks: RiskItem[];
  dataRisks: RiskItem[];
  personnelRisks: RiskItem[];
  agentExecutionRisks: RiskItem[];
  businessRisks: RiskItem[];
  permissionRisks: RiskItem[];
};

export type RiskItem = {
  description: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH';
  mitigation: string;
};

export type ValidationResult = {
  valid: boolean;
  errors: ValidationError[];
};

export type ValidationError = {
  field: string;
  message: string;
};

const COLLABORATION_TYPES = [
  'PROJECT', 'RESEARCH', 'ANALYSIS', 'PLANNING', 'REVIEW',
  'STRATEGIC_PLANNING', 'CROSS_DEPT_PROJECT', 'KNOWLEDGE_BUILDING',
  'PROBLEM_SOLVING', 'INNOVATION', 'COMPLIANCE_REVIEW', 'RISK_ASSESSMENT',
];

const COLLABORATION_SCALES = ['SMALL', 'MEDIUM', 'LARGE', 'ENTERPRISE', 'CROSS_ORG'];

const ORG_STRUCTURES = ['FLAT', 'HIERARCHICAL', 'MATRIX', 'NETWORK', 'HYBRID'];

export async function generateCollaborationDraft(
  goalDescription: string,
  user: SessionUser,
  constraints?: {
    collaborationType?: string;
    scale?: string;
    structure?: string;
    participants?: string[];
    deadline?: string;
  },
): Promise<CollaborationDraft> {
  const draftId = crypto.randomUUID();

  const goal = parseGoal(goalDescription, constraints);
  const organization = recommendOrganization(goal, constraints);
  const workPlan = generateWorkPlan(goal, organization);
  const collaborationRules = generateRules(organization);
  const risks = identifyRisks(goal, workPlan, organization);

  return {
    id: draftId,
    goal,
    organization,
    workPlan,
    collaborationRules,
    risks,
    status: 'DRAFT',
    createdAt: new Date().toISOString(),
  };
}

function parseGoal(description: string, constraints?: Record<string, unknown>): GoalPreview {
  const commonGoal = description.trim();
  const goalBackground = `基于用户描述: "${commonGoal}"`;
  const goalScope = constraints?.['scope'] as string ?? '待用户确认';
  const successCriteria = [
    '所有 Workstream 完成',
    '交付成果通过审核',
    '协作目标达成',
  ];
  const deliverables = [
    '协作总结报告',
    '关键数据成果',
    '决策记录',
  ];

  return {
    commonGoal,
    goalBackground,
    goalScope,
    successCriteria,
    deliverables,
  };
}

function recommendOrganization(goal: GoalPreview, constraints?: Record<string, unknown>): OrganizationPreview {
  const collaborationType = (constraints?.['collaborationType'] as string) ?? 'PROJECT';
  const scale = (constraints?.['scale'] as string) ?? 'MEDIUM';
  const structure = (constraints?.['structure'] as string) ?? 'FLAT';

  const isHighRisk = ['STRATEGIC_PLANNING', 'COMPLIANCE_REVIEW', 'RISK_ASSESSMENT'].includes(collaborationType);

  return {
    owner: '协作负责人（待指定）',
    aiCoordinator: isHighRisk ? 'AI_ASSISTED' : 'AI_COORDINATED',
    agentMembers: [
      {
        agentCode: 'research_agent',
        role: '研究员',
        responsibilities: ['信息收集', '数据分析'],
      },
      {
        agentCode: 'analysis_agent',
        role: '分析师',
        responsibilities: ['深度分析', '报告撰写'],
      },
    ],
    humanMembers: [
      {
        userId: '待指定',
        role: '协作负责人',
        responsibilities: ['目标确认', '关键决策', '成果审核'],
      },
    ],
    departments: ['待指定'],
    systems: ['银智通平台'],
  };
}

function generateWorkPlan(goal: GoalPreview, organization: OrganizationPreview): WorkPlanPreview {
  return {
    phases: [
      {
        name: 'Phase 1: 信息收集与准备',
        workstreams: [
          {
            name: 'WS1: 背景调研',
            tasks: [
              { name: '行业背景调研', description: '收集行业基础信息', estimatedWorkload: '2小时' },
              { name: '竞品分析', description: '分析竞争对手情况', estimatedWorkload: '3小时' },
            ],
            dependencies: [],
            estimatedDuration: '1-2天',
            executor: 'research_agent',
          },
        ],
      },
      {
        name: 'Phase 2: 深度分析',
        workstreams: [
          {
            name: 'WS2: 数据分析',
            tasks: [
              { name: '数据整理', description: '整理收集的数据', estimatedWorkload: '2小时' },
              { name: '趋势分析', description: '分析行业趋势', estimatedWorkload: '3小时' },
            ],
            dependencies: ['WS1'],
            estimatedDuration: '2-3天',
            executor: 'analysis_agent',
          },
        ],
      },
      {
        name: 'Phase 3: 成果整合与交付',
        workstreams: [
          {
            name: 'WS3: 报告撰写',
            tasks: [
              { name: '初稿撰写', description: '撰写协作报告初稿', estimatedWorkload: '4小时' },
              { name: '审核修订', description: '审核并修订报告', estimatedWorkload: '2小时' },
            ],
            dependencies: ['WS2'],
            estimatedDuration: '1-2天',
            executor: 'human',
          },
        ],
      },
    ],
  };
}

function generateRules(organization: OrganizationPreview): CollaborationRulesPreview {
  return {
    coordinator: organization.aiCoordinator,
    taskCreator: '协作负责人 + AI Coordinator',
    planModifier: '协作负责人确认后 AI 可修改',
    dataViewer: '所有参与者可查看协作数据',
    reviewer: '协作负责人审核成果',
    humanConfirmationTriggers: [
      '关键决策需人工确认',
      '高风险操作需人工审批',
      '成果发布需人工审核',
    ],
  };
}

function identifyRisks(goal: GoalPreview, workPlan: WorkPlanPreview, organization: OrganizationPreview): RisksPreview {
  return {
    timeRisks: [
      { description: 'Phase 2 数据分析可能耗时较长', severity: 'MEDIUM', mitigation: '预留缓冲时间' },
    ],
    dataRisks: [
      { description: '数据来源可能不完整', severity: 'MEDIUM', mitigation: '多源交叉验证' },
    ],
    personnelRisks: [
      { description: '协作负责人未指定', severity: 'HIGH', mitigation: '尽快指定负责人' },
    ],
    agentExecutionRisks: [
      { description: 'AI Agent 可能产生幻觉', severity: 'MEDIUM', mitigation: '人工审核关键结论' },
    ],
    businessRisks: [
      { description: '分析结论可能偏离业务需求', severity: 'LOW', mitigation: '定期与业务方对齐' },
    ],
    permissionRisks: [
      { description: '数据访问权限可能不足', severity: 'MEDIUM', mitigation: '提前申请数据权限' },
    ],
  };
}

export function validateDraft(draft: CollaborationDraft): ValidationResult {
  const errors: ValidationError[] = [];

  if (!draft.goal.commonGoal || draft.goal.commonGoal.trim().length < 10) {
    errors.push({ field: 'goal.commonGoal', message: '目标描述不充分，至少需要10个字符' });
  }

  if (draft.organization.humanMembers.length === 0 || draft.organization.humanMembers[0].userId === '待指定') {
    errors.push({ field: 'organization.humanMembers', message: '协作负责人未指定' });
  }

  if (draft.workPlan.phases.length === 0) {
    errors.push({ field: 'workPlan.phases', message: '工作计划为空' });
  }

  const allDependencies: string[] = [];
  for (const phase of draft.workPlan.phases) {
    for (const ws of phase.workstreams) {
      allDependencies.push(...ws.dependencies);
    }
  }
  const wsNames = new Set<string>();
  for (const phase of draft.workPlan.phases) {
    for (const ws of phase.workstreams) {
      wsNames.add(ws.name);
    }
  }
  for (const dep of allDependencies) {
    if (!wsNames.has(dep)) {
      errors.push({ field: 'workPlan', message: `依赖 ${dep} 不存在对应 Workstream` });
    }
  }

  if (draft.organization.aiCoordinator === 'AUTO') {
    errors.push({ field: 'organization.aiCoordinator', message: '银行场景不建议使用 AUTO 模式' });
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

export async function createCollaborationFromDraft(
  draft: CollaborationDraft,
  user: SessionUser,
): Promise<string> {
  const db = await getSupabaseClient();
  const collaborationId = crypto.randomUUID();

  const validation = validateDraft(draft);
  if (!validation.valid) {
    throw new Error(`草案验证失败: ${validation.errors.map(e => e.message).join('; ')}`);
  }

  await db.from('collaborations').insert({
    id: collaborationId,
    tenant_id: user.tenantId,
    name: draft.goal.commonGoal,
    type: 'project',
    scale: 'MEDIUM',
    structure_type: 'FLAT',
    coordinator_mode: draft.organization.aiCoordinator,
    status: 'draft',
    success_criteria: draft.goal.successCriteria.join('; '),
    description: draft.goal.goalBackground,
    owner_id: user.id,
  });

  for (const phase of draft.workPlan.phases) {
    for (const ws of phase.workstreams) {
      const wsId = crypto.randomUUID();
      await db.from('collaboration_workstreams').insert({
        id: wsId,
        tenant_id: user.tenantId,
        collaboration_id: collaborationId,
        name: ws.name,
        phase: phase.name,
        objectives: ws.tasks.map(t => t.name),
        dependencies: ws.dependencies,
        status: 'planning',
        progress: 0,
      });
    }
  }

  return collaborationId;
}