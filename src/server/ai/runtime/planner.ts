import type { AgentDefinition } from '@/server/ai/agents/registry';
import { getAgent } from '@/server/ai/agents/registry';
import type { ComplexityLevel } from '@/server/ai/runtime/intent-router';
import { getSupabaseClient } from '@/storage/database/supabase-client';

/* ============================================================
 * V2 类型定义
 * ============================================================ */

export type StepType =
  | 'RESEARCH'
  | 'ANALYSIS'
  | 'RETRIEVAL'
  | 'DATA_QUERY'
  | 'DOCUMENT'
  | 'TASK'
  | 'TOOL'
  | 'REVIEW'
  | 'APPROVAL';

export type PlanStatus =
  | 'DRAFT'
  | 'VALIDATING'
  | 'READY'
  | 'APPROVAL_REQUIRED'
  | 'APPROVED'
  | 'EXECUTING'
  | 'COMPLETED'
  | 'REJECTED'
  | 'FAILED'
  | 'CANCELLED'
  | 'PAUSED'
  | 'PARTIAL_COMPLETED';

export type StepStatus =
  | 'pending'
  | 'ready'
  | 'executing'
  | 'completed'
  | 'failed'
  | 'skipped';

export type RetryPolicy = {
  maxRetries: number;
  backoffMs: number;
};

export type PlanStep = {
  id: string;
  seq: number;
  stepType: StepType;
  description: string;
  agentCode?: string;
  toolCode?: string;
  toolParams?: Record<string, unknown>;
  dependencies: string[];
  permissionRequired: string[];
  riskLevel: 'L0' | 'L1' | 'L2' | 'L3' | 'L4';
  retryPolicy?: RetryPolicy;
  status: StepStatus;
};

export type Plan = {
  id: string;
  tenantId: string;
  runId?: string;
  agentCode: string;
  userGoal: string;
  complexity: ComplexityLevel;
  status: PlanStatus;
  version: number;
  maxTokens?: number;
  maxToolCalls?: number;
  maxSteps?: number;
  timeoutSeconds?: number;
  steps: PlanStep[];
  createdAt: string;
  updatedAt: string;
};

export type PlannerContext = {
  tenantId: string;
  conversationId?: string;
  currentModule?: string;
  recentMessages?: { role: string; content: string }[];
  userPermissions: string[];
};

export type PlanBudget = {
  estimatedTokens: number;
  estimatedToolCalls: number;
  estimatedSteps: number;
  estimatedTimeSeconds: number;
};

/* ============================================================
 * V1 兼容类型（保留向后兼容）
 * ============================================================ */

export type Complexity = 'S1' | 'S2' | 'S3' | 'S4';

export type LegacyPlanStep = {
  seq: number;
  kind: 'reasoning' | 'tool_call' | 'output';
  description: string;
  toolCode?: string;
  toolParams?: Record<string, unknown>;
};

export type LegacyPlan = {
  agentCode: string;
  complexity: Complexity;
  goal: string;
  steps: LegacyPlanStep[];
  estimatedToolCalls: string[];
  riskLevel: 'L0' | 'L1' | 'L2' | 'L3';
  requiresConfirmation: boolean;
};

/* ============================================================
 * 常量定义
 * ============================================================ */

const STEP_TYPE_TOOL_MAP: Record<StepType, string[]> = {
  RESEARCH: ['knowledge.search', 'research.create'],
  ANALYSIS: ['analytics.query', 'metric.list'],
  RETRIEVAL: ['knowledge.search', 'knowledge.qa_log'],
  DATA_QUERY: ['analytics.query', 'dashboard.get'],
  DOCUMENT: ['document.create', 'document.update', 'document.template.list'],
  TASK: ['task.create_draft', 'task.list', 'task.update', 'task.link'],
  TOOL: [],
  REVIEW: ['document.create'],
  APPROVAL: [],
};

const RISK_LEVEL_MAP: Record<string, 'L0' | 'L1' | 'L2' | 'L3' | 'L4'> = {
  L0: 'L0',
  L1: 'L1',
  L2: 'L2',
  L3: 'L3',
  L4: 'L4',
};

const PERMISSION_MAP: Record<string, string[]> = {
  workbench: [],
  task: ['task.view', 'task.create', 'task.update'],
  office: ['office.view', 'document.create'],
  research: ['research.view'],
  enterprise: ['enterprise.view'],
  customer: ['customer.view'],
  risk: ['risk.view', 'risk.handle'],
  analytics: ['analytics.view'],
  knowledge: ['knowledge.view'],
  cockpit: ['cockpit.view'],
  collab: ['collab.view', 'collaboration.create'],
};

const DEFAULT_BUDGET: Record<ComplexityLevel, PlanBudget> = {
  L0: { estimatedTokens: 500, estimatedToolCalls: 0, estimatedSteps: 1, estimatedTimeSeconds: 5 },
  L1: { estimatedTokens: 1000, estimatedToolCalls: 1, estimatedSteps: 2, estimatedTimeSeconds: 15 },
  L2: { estimatedTokens: 3000, estimatedToolCalls: 3, estimatedSteps: 4, estimatedTimeSeconds: 30 },
  L3: { estimatedTokens: 8000, estimatedToolCalls: 5, estimatedSteps: 6, estimatedTimeSeconds: 60 },
  L4: { estimatedTokens: 15000, estimatedToolCalls: 8, estimatedSteps: 8, estimatedTimeSeconds: 120 },
};

const VALID_STATE_TRANSITIONS: Record<PlanStatus, PlanStatus[]> = {
  DRAFT: ['VALIDATING', 'CANCELLED'],
  VALIDATING: ['READY', 'REJECTED', 'APPROVAL_REQUIRED'],
  READY: ['APPROVAL_REQUIRED', 'EXECUTING', 'CANCELLED'],
  APPROVAL_REQUIRED: ['APPROVED', 'REJECTED', 'CANCELLED'],
  APPROVED: ['EXECUTING', 'CANCELLED'],
  EXECUTING: ['COMPLETED', 'FAILED', 'PAUSED', 'PARTIAL_COMPLETED', 'CANCELLED'],
  COMPLETED: [],
  REJECTED: [],
  FAILED: [],
  CANCELLED: [],
  PAUSED: ['EXECUTING', 'CANCELLED'],
  PARTIAL_COMPLETED: ['EXECUTING', 'COMPLETED', 'CANCELLED'],
};

/* ============================================================
 * 工具函数
 * ============================================================ */

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

function validateStateTransition(from: PlanStatus, to: PlanStatus): boolean {
  const allowed = VALID_STATE_TRANSITIONS[from];
  return allowed.includes(to);
}

function getStepTypeForTool(toolCode: string): StepType {
  for (const [stepType, tools] of Object.entries(STEP_TYPE_TOOL_MAP)) {
    if (tools.includes(toolCode)) {
      return stepType as StepType;
    }
  }
  return 'TOOL';
}

function getPermissionsForModule(module: string): string[] {
  return PERMISSION_MAP[module] ?? [];
}

function estimateBudget(steps: PlanStep[], complexity: ComplexityLevel): PlanBudget {
  const base = DEFAULT_BUDGET[complexity];
  const toolCallSteps = steps.filter((s) => s.stepType === 'TOOL' || s.toolCode).length;
  return {
    estimatedTokens: base.estimatedTokens + steps.length * 200,
    estimatedToolCalls: Math.max(base.estimatedToolCalls, toolCallSteps),
    estimatedSteps: steps.length,
    estimatedTimeSeconds: base.estimatedTimeSeconds + steps.length * 5,
  };
}

/* ============================================================
 * 7条计划生成原则
 * ============================================================ */

function applyMinimalStepsPrinciple(steps: PlanStep[]): PlanStep[] {
  const nonRedundant = steps.filter((step, idx) => {
    if (idx === 0) return true;
    const prev = steps[idx - 1];
    return !(step.stepType === prev.stepType && step.toolCode === prev.toolCode);
  });
  return nonRedundant;
}

function applyDependencyOrderingPrinciple(steps: PlanStep[]): PlanStep[] {
  const sorted = [...steps];
  const visited = new Set<string>();
  const result: PlanStep[] = [];

  function visit(step: PlanStep) {
    if (visited.has(step.id)) return;
    visited.add(step.id);
    for (const depId of step.dependencies) {
      const dep = sorted.find((s) => s.id === depId);
      if (dep && !visited.has(dep.id)) {
        visit(dep);
      }
    }
    result.push(step);
  }

  for (const step of sorted) {
    visit(step);
  }

  return result.map((step, idx) => ({ ...step, seq: idx + 1 }));
}

function applyRiskFirstPrinciple(steps: PlanStep[]): PlanStep[] {
  const riskOrder: Record<string, number> = { L4: 0, L3: 1, L2: 2, L1: 3, L0: 4 };
  return [...steps].sort((a, b) => {
    const aOrder = riskOrder[a.riskLevel] ?? 5;
    const bOrder = riskOrder[b.riskLevel] ?? 5;
    if (aOrder !== bOrder) return aOrder - bOrder;
    return a.seq - b.seq;
  });
}

function applyPermissionMatchingPrinciple(
  steps: PlanStep[],
  agent: AgentDefinition,
): PlanStep[] {
  const modulePerms = getPermissionsForModule(agent.module);
  return steps.map((step) => ({
    ...step,
    permissionRequired: step.permissionRequired.length > 0
      ? step.permissionRequired
      : modulePerms,
  }));
}

function applyBudgetEstimationPrinciple(
  plan: Plan,
  complexity: ComplexityLevel,
): Plan {
  const budget = estimateBudget(plan.steps, complexity);
  return {
    ...plan,
    maxTokens: budget.estimatedTokens,
    maxToolCalls: budget.estimatedToolCalls,
    maxSteps: budget.estimatedSteps,
    timeoutSeconds: budget.estimatedTimeSeconds,
  };
}

function applyInterruptiblePrinciple(steps: PlanStep[]): PlanStep[] {
  return steps.map((step) => ({
    ...step,
    retryPolicy: step.retryPolicy ?? { maxRetries: 2, backoffMs: 1000 },
    status: 'pending' as StepStatus,
  }));
}

function applyTraceabilityPrinciple(steps: PlanStep[], userGoal: string): PlanStep[] {
  return steps.map((step) => ({
    ...step,
    description: `[目标: ${userGoal.slice(0, 30)}] ${step.description}`,
  }));
}

/* ============================================================
 * V2 Plan 生成核心
 * ============================================================ */

function generatePlanSteps(
  agent: AgentDefinition,
  userGoal: string,
  complexity: ComplexityLevel,
): PlanStep[] {
  const steps: PlanStep[] = [];

  if (complexity === 'L0') {
    steps.push({
      id: generateId(),
      seq: 1,
      stepType: 'RETRIEVAL',
      description: '理解用户问题并直接生成回答',
      dependencies: [],
      permissionRequired: [],
      riskLevel: 'L0',
      status: 'pending',
    });
    return steps;
  }

  if (complexity === 'L1') {
    const primaryTool = agent.tools[0];
    if (primaryTool) {
      steps.push({
        id: generateId(),
        seq: 1,
        stepType: getStepTypeForTool(primaryTool),
        description: `调用 ${primaryTool} 获取相关信息`,
        toolCode: primaryTool,
        dependencies: [],
        permissionRequired: [],
        riskLevel: RISK_LEVEL_MAP[agent.riskLevel] ?? 'L0',
        status: 'pending',
      });
    }
    steps.push({
      id: generateId(),
      seq: steps.length + 1,
      stepType: 'ANALYSIS',
      description: '基于获取的信息生成回答',
      dependencies: steps.length > 0 ? [steps[0].id] : [],
      permissionRequired: [],
      riskLevel: 'L0',
      status: 'pending',
    });
    return steps;
  }

  if (complexity === 'L2') {
    const searchTools = agent.tools.filter(
      (t) => t.includes('search') || t.includes('list') || t.includes('query') || t.includes('get'),
    );
    const actionTools = agent.tools.filter(
      (t) => t.includes('create') || t.includes('update') || t.includes('draft'),
    );

    for (const tool of searchTools.slice(0, 2)) {
      steps.push({
        id: generateId(),
        seq: steps.length + 1,
        stepType: getStepTypeForTool(tool),
        description: `调用 ${tool} 收集信息`,
        toolCode: tool,
        dependencies: [],
        permissionRequired: [],
        riskLevel: 'L0',
        status: 'pending',
      });
    }

    steps.push({
      id: generateId(),
      seq: steps.length + 1,
      stepType: 'ANALYSIS',
      description: '分析收集到的信息',
      dependencies: steps.map((s) => s.id),
      permissionRequired: [],
      riskLevel: 'L0',
      status: 'pending',
    });

    for (const tool of actionTools.slice(0, 1)) {
      steps.push({
        id: generateId(),
        seq: steps.length + 1,
        stepType: getStepTypeForTool(tool),
        description: `调用 ${tool} 执行操作`,
        toolCode: tool,
        dependencies: [steps[steps.length - 1].id],
        permissionRequired: [],
        riskLevel: RISK_LEVEL_MAP[agent.riskLevel] ?? 'L1',
        status: 'pending',
      });
    }

    return steps;
  }

  if (complexity === 'L3') {
    const searchTools = agent.tools.filter(
      (t) => t.includes('search') || t.includes('list') || t.includes('query'),
    );
    const actionTools = agent.tools.filter(
      (t) => t.includes('create') || t.includes('update') || t.includes('draft'),
    );

    for (const tool of searchTools.slice(0, 2)) {
      steps.push({
        id: generateId(),
        seq: steps.length + 1,
        stepType: getStepTypeForTool(tool),
        description: `调用 ${tool} 收集信息`,
        toolCode: tool,
        dependencies: [],
        permissionRequired: [],
        riskLevel: 'L0',
        status: 'pending',
      });
    }

    steps.push({
      id: generateId(),
      seq: steps.length + 1,
      stepType: 'ANALYSIS',
      description: '分析收集到的信息，规划后续操作',
      dependencies: steps.map((s) => s.id),
      permissionRequired: [],
      riskLevel: 'L0',
      status: 'pending',
    });

    for (const tool of actionTools.slice(0, 2)) {
      steps.push({
        id: generateId(),
        seq: steps.length + 1,
        stepType: getStepTypeForTool(tool),
        description: `调用 ${tool} 执行操作`,
        toolCode: tool,
        dependencies: [steps[steps.length - 1].id],
        permissionRequired: [],
        riskLevel: RISK_LEVEL_MAP[agent.riskLevel] ?? 'L1',
        status: 'pending',
      });
    }

    steps.push({
      id: generateId(),
      seq: steps.length + 1,
      stepType: 'REVIEW',
      description: '生成最终输出结果并审核',
      dependencies: steps.map((s) => s.id),
      permissionRequired: [],
      riskLevel: 'L0',
      status: 'pending',
    });

    return steps;
  }

  // L4 - 工作流级别
  steps.push({
    id: generateId(),
    seq: 1,
    stepType: 'ANALYSIS',
    description: '分析需求，确定需要触发的工作流类型',
    dependencies: [],
    permissionRequired: [],
    riskLevel: 'L0',
    status: 'pending',
  });

  for (const tool of agent.tools.slice(0, 3)) {
    steps.push({
      id: generateId(),
      seq: steps.length + 1,
      stepType: getStepTypeForTool(tool),
      description: `调用 ${tool} 准备工作流上下文`,
      toolCode: tool,
      dependencies: [steps[0].id],
      permissionRequired: [],
      riskLevel: RISK_LEVEL_MAP[agent.riskLevel] ?? 'L1',
      status: 'pending',
    });
  }

  steps.push({
    id: generateId(),
    seq: steps.length + 1,
    stepType: 'APPROVAL',
    description: '创建工作流实例并等待用户确认',
    dependencies: steps.map((s) => s.id),
    permissionRequired: [],
    riskLevel: 'L3',
    status: 'pending',
  });

  return steps;
}

function applyAllPrinciples(
  steps: PlanStep[],
  agent: AgentDefinition,
  userGoal: string,
  complexity: ComplexityLevel,
): PlanStep[] {
  let result = applyMinimalStepsPrinciple(steps);
  result = applyRiskFirstPrinciple(result);
  result = applyDependencyOrderingPrinciple(result);
  result = applyPermissionMatchingPrinciple(result, agent);
  result = applyInterruptiblePrinciple(result);
  result = applyTraceabilityPrinciple(result, userGoal);
  return result;
}

/* ============================================================
 * V2 持久化函数
 * ============================================================ */

export async function createPlan(
  agentCode: string,
  userGoal: string,
  context: PlannerContext,
  complexity: ComplexityLevel,
): Promise<Plan> {
  const agent = getAgent(agentCode);
  if (!agent) {
    throw new Error(`Agent not found: ${agentCode}`);
  }

  const rawSteps = generatePlanSteps(agent, userGoal, complexity);
  const steps = applyAllPrinciples(rawSteps, agent, userGoal, complexity);

  const planId = generateId();
  const now = new Date().toISOString();

  const plan: Plan = {
    id: planId,
    tenantId: context.tenantId,
    agentCode,
    userGoal,
    complexity,
    status: 'DRAFT',
    version: 1,
    steps,
    createdAt: now,
    updatedAt: now,
  };

  const budgetedPlan = applyBudgetEstimationPrinciple(plan, complexity);

  const db = await getSupabaseClient();
  await db.from('ai_plans').insert({
    id: budgetedPlan.id,
    tenant_id: budgetedPlan.tenantId,
    agent_code: budgetedPlan.agentCode,
    user_goal: budgetedPlan.userGoal,
    complexity: budgetedPlan.complexity,
    status: budgetedPlan.status,
    version: budgetedPlan.version,
    max_tokens: budgetedPlan.maxTokens,
    max_tool_calls: budgetedPlan.maxToolCalls,
    max_steps: budgetedPlan.maxSteps,
    timeout_seconds: budgetedPlan.timeoutSeconds,
  });

  for (const step of budgetedPlan.steps) {
    await db.from('ai_plan_steps').insert({
      id: step.id,
      plan_id: budgetedPlan.id,
      seq: step.seq,
      step_type: step.stepType,
      description: step.description,
      agent_code: step.agentCode,
      tool_code: step.toolCode,
      tool_params: step.toolParams,
      dependencies: step.dependencies,
      permission_required: step.permissionRequired,
      risk_level: step.riskLevel,
      retry_policy: step.retryPolicy,
      status: step.status,
    });
  }

  return budgetedPlan;
}

export async function validatePlan(planId: string): Promise<Plan> {
  const db = await getSupabaseClient();

  const { data: planRow } = await db
    .from('ai_plans')
    .select('*')
    .eq('id', planId)
    .single();

  if (!planRow) {
    throw new Error(`Plan not found: ${planId}`);
  }

  if (!validateStateTransition(planRow.status as PlanStatus, 'VALIDATING')) {
    throw new Error(`Invalid state transition: ${planRow.status} → VALIDATING`);
  }

  await db.from('ai_plans').update({ status: 'VALIDATING' }).eq('id', planId);

  const { data: stepRows } = await db
    .from('ai_plan_steps')
    .select('*')
    .eq('plan_id', planId)
    .order('seq');

  const steps: PlanStep[] = (stepRows ?? []).map((row: Record<string, unknown>) => ({
    id: row.id as string,
    seq: row.seq as number,
    stepType: row.step_type as StepType,
    description: row.description as string,
    agentCode: row.agent_code as string | undefined,
    toolCode: row.tool_code as string | undefined,
    toolParams: row.tool_params as Record<string, unknown> | undefined,
    dependencies: (row.dependencies as string[]) ?? [],
    permissionRequired: (row.permission_required as string[]) ?? [],
    riskLevel: row.risk_level as 'L0' | 'L1' | 'L2' | 'L3' | 'L4',
    retryPolicy: row.retry_policy as RetryPolicy | undefined,
    status: row.status as StepStatus,
  }));

  const validationErrors: string[] = [];

  for (const step of steps) {
    for (const depId of step.dependencies) {
      if (!steps.find((s) => s.id === depId)) {
        validationErrors.push(`Step ${step.seq}: dependency ${depId} not found`);
      }
    }
  }

  const highRiskSteps = steps.filter((s) => s.riskLevel === 'L3' || s.riskLevel === 'L4');
  const needsApproval = highRiskSteps.length > 0;

  const planComplexity = planRow.complexity as ComplexityLevel;
  const requiresApproval = planComplexity === 'L3' || planComplexity === 'L4' || needsApproval;

  let newStatus: PlanStatus;
  if (validationErrors.length > 0) {
    newStatus = 'REJECTED';
  } else if (requiresApproval) {
    newStatus = 'APPROVAL_REQUIRED';
  } else {
    newStatus = 'READY';
  }

  if (!validateStateTransition('VALIDATING', newStatus)) {
    throw new Error(`Invalid state transition: VALIDATING → ${newStatus}`);
  }

  await db.from('ai_plans').update({ status: newStatus }).eq('id', planId);

  return {
    id: planRow.id as string,
    tenantId: planRow.tenant_id as string,
    runId: planRow.run_id as string | undefined,
    agentCode: planRow.agent_code as string,
    userGoal: planRow.user_goal as string,
    complexity: planComplexity,
    status: newStatus,
    version: planRow.version as number,
    maxTokens: planRow.max_tokens as number | undefined,
    maxToolCalls: planRow.max_tool_calls as number | undefined,
    maxSteps: planRow.max_steps as number | undefined,
    timeoutSeconds: planRow.timeout_seconds as number | undefined,
    steps,
    createdAt: planRow.created_at as string,
    updatedAt: planRow.updated_at as string,
  };
}

export async function approvePlan(
  planId: string,
  action: 'approve' | 'reject' | 'modify',
  modifications?: Partial<Plan>,
): Promise<Plan> {
  const db = await getSupabaseClient();

  const { data: planRow } = await db
    .from('ai_plans')
    .select('*')
    .eq('id', planId)
    .single();

  if (!planRow) {
    throw new Error(`Plan not found: ${planId}`);
  }

  const currentStatus = planRow.status as PlanStatus;

  if (action === 'approve') {
    if (!validateStateTransition(currentStatus, 'APPROVED')) {
      throw new Error(`Invalid state transition: ${currentStatus} → APPROVED`);
    }
    await db.from('ai_plans').update({ status: 'APPROVED' }).eq('id', planId);
  } else if (action === 'reject') {
    if (!validateStateTransition(currentStatus, 'REJECTED')) {
      throw new Error(`Invalid state transition: ${currentStatus} → REJECTED`);
    }
    await db.from('ai_plans').update({ status: 'REJECTED' }).eq('id', planId);
  } else if (action === 'modify') {
    return await modifyPlan(planId, modifications ?? {});
  }

  return await getPlan(planId);
}

export async function modifyPlan(
  planId: string,
  modifications: Partial<Plan>,
): Promise<Plan> {
  const db = await getSupabaseClient();

  const originalPlan = await getPlan(planId);

  const newVersion = originalPlan.version + 1;
  const newPlanId = generateId();
  const now = new Date().toISOString();

  const mergedPlan: Plan = {
    ...originalPlan,
    id: newPlanId,
    version: newVersion,
    status: 'DRAFT',
    userGoal: modifications?.userGoal ?? originalPlan.userGoal,
    complexity: modifications?.complexity ?? originalPlan.complexity,
    maxTokens: modifications?.maxTokens ?? originalPlan.maxTokens,
    maxToolCalls: modifications?.maxToolCalls ?? originalPlan.maxToolCalls,
    maxSteps: modifications?.maxSteps ?? originalPlan.maxSteps,
    timeoutSeconds: modifications?.timeoutSeconds ?? originalPlan.timeoutSeconds,
    steps: modifications?.steps ?? originalPlan.steps,
    createdAt: now,
    updatedAt: now,
  };

  const budgetedPlan = applyBudgetEstimationPrinciple(mergedPlan, mergedPlan.complexity);

  await db.from('ai_plans').insert({
    id: budgetedPlan.id,
    tenant_id: budgetedPlan.tenantId,
    run_id: budgetedPlan.runId,
    agent_code: budgetedPlan.agentCode,
    user_goal: budgetedPlan.userGoal,
    complexity: budgetedPlan.complexity,
    status: 'DRAFT',
    version: newVersion,
    max_tokens: budgetedPlan.maxTokens,
    max_tool_calls: budgetedPlan.maxToolCalls,
    max_steps: budgetedPlan.maxSteps,
    timeout_seconds: budgetedPlan.timeoutSeconds,
  });

  for (const step of budgetedPlan.steps) {
    await db.from('ai_plan_steps').insert({
      id: step.id,
      plan_id: budgetedPlan.id,
      seq: step.seq,
      step_type: step.stepType,
      description: step.description,
      agent_code: step.agentCode,
      tool_code: step.toolCode,
      tool_params: step.toolParams,
      dependencies: step.dependencies,
      permission_required: step.permissionRequired,
      risk_level: step.riskLevel,
      retry_policy: step.retryPolicy,
      status: 'pending',
    });
  }

  return budgetedPlan;
}

export async function getPlan(planId: string): Promise<Plan> {
  const db = await getSupabaseClient();

  const { data: planRow } = await db
    .from('ai_plans')
    .select('*')
    .eq('id', planId)
    .single();

  if (!planRow) {
    throw new Error(`Plan not found: ${planId}`);
  }

  const { data: stepRows } = await db
    .from('ai_plan_steps')
    .select('*')
    .eq('plan_id', planId)
    .order('seq');

  const steps: PlanStep[] = (stepRows ?? []).map((row: Record<string, unknown>) => ({
    id: row.id as string,
    seq: row.seq as number,
    stepType: row.step_type as StepType,
    description: row.description as string,
    agentCode: row.agent_code as string | undefined,
    toolCode: row.tool_code as string | undefined,
    toolParams: row.tool_params as Record<string, unknown> | undefined,
    dependencies: (row.dependencies as string[]) ?? [],
    permissionRequired: (row.permission_required as string[]) ?? [],
    riskLevel: row.risk_level as 'L0' | 'L1' | 'L2' | 'L3' | 'L4',
    retryPolicy: row.retry_policy as RetryPolicy | undefined,
    status: row.status as StepStatus,
  }));

  return {
    id: planRow.id as string,
    tenantId: planRow.tenant_id as string,
    runId: planRow.run_id as string | undefined,
    agentCode: planRow.agent_code as string,
    userGoal: planRow.user_goal as string,
    complexity: planRow.complexity as ComplexityLevel,
    status: planRow.status as PlanStatus,
    version: planRow.version as number,
    maxTokens: planRow.max_tokens as number | undefined,
    maxToolCalls: planRow.max_tool_calls as number | undefined,
    maxSteps: planRow.max_steps as number | undefined,
    timeoutSeconds: planRow.timeout_seconds as number | undefined,
    steps,
    createdAt: planRow.created_at as string,
    updatedAt: planRow.updated_at as string,
  };
}

export function canTransition(from: PlanStatus, to: PlanStatus): boolean {
  return validateStateTransition(from, to);
}

/* ============================================================
 * V1 兼容入口（保留向后兼容）
 * ============================================================ */

export function generatePlan(
  agentCode: string,
  userGoal: string,
  context: { conversationId?: string; currentModule?: string; recentMessages?: { role: string; content: string }[] },
  complexity: Complexity,
): LegacyPlan | null {
  const agent = getAgent(agentCode);
  if (!agent) return null;

  const complexityMap: Record<Complexity, ComplexityLevel> = {
    S1: 'L0',
    S2: 'L1',
    S3: 'L2',
    S4: 'L3',
  };
  const v2Complexity = complexityMap[complexity];

  const rawSteps = generatePlanSteps(agent, userGoal, v2Complexity);
  const v2Steps = applyAllPrinciples(rawSteps, agent, userGoal, v2Complexity);

  const legacySteps: LegacyPlanStep[] = v2Steps.map((step) => {
    const kind: LegacyPlanStep['kind'] =
      step.stepType === 'ANALYSIS' || step.stepType === 'RESEARCH' || step.stepType === 'REVIEW'
        ? 'reasoning'
        : step.stepType === 'APPROVAL'
          ? 'output'
          : 'tool_call';
    return {
      seq: step.seq,
      kind,
      description: step.description,
      toolCode: step.toolCode,
      toolParams: step.toolParams,
    };
  });

  const toolCalls = v2Steps
    .filter((s) => s.toolCode)
    .map((s) => s.toolCode!) as string[];

  return {
    agentCode: agent.code,
    complexity,
    goal: userGoal,
    steps: legacySteps,
    estimatedToolCalls: toolCalls,
    riskLevel: agent.riskLevel as 'L0' | 'L1' | 'L2' | 'L3',
    requiresConfirmation: complexity === 'S3' || complexity === 'S4',
  };
}