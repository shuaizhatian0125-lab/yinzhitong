import { getSupabaseClient } from '@/storage/database/supabase-client';
import type { SessionUser } from '@/lib/auth';
import { getAgent, listAgents } from '@/server/ai/agents/registry';
import type { AgentDefinition } from '@/server/ai/agents/registry';
import type { Plan, PlanStep, StepStatus } from '@/server/ai/runtime/planner';
import { getPlan } from '@/server/ai/runtime/planner';
import { executeTool } from '@/server/ai/tools/registry';
import type { ComplexityLevel } from '@/server/ai/runtime/intent-router';

/* ============================================================
 * 类型定义
 * ============================================================ */

export type ExecutionStrategy =
  | 'SINGLE'
  | 'SEQUENTIAL'
  | 'PARALLEL'
  | 'HIERARCHICAL';

export type OrchestratorEvent =
  | 'step_start'
  | 'step_complete'
  | 'step_failed'
  | 'confirmation_required'
  | 'run_complete'
  | 'run_partial_completed'
  | 'run_failed';

export type StepExecutionStatus =
  | 'pending'
  | 'ready'
  | 'executing'
  | 'completed'
  | 'failed'
  | 'skipped'
  | 'waiting_confirmation';

export type Budget = {
  maxTokens: number;
  maxToolCalls: number;
  maxSteps: number;
  timeoutSeconds: number;
};

export type AgentContext = {
  runId: string;
  planId: string;
  stepId: string;
  conversationId?: string;
  tenantId: string;
  userId: string;
  organizationId?: string;
  permissions: string[];
  dataScope: string;
  memoryContext: string;
  knowledgeContext: string;
  toolContext: string[];
  budget: Budget;
};

export type StepResult = {
  stepId: string;
  seq: number;
  status: StepExecutionStatus;
  output?: Record<string, unknown>;
  error?: string;
  agentCode?: string;
  toolCode?: string;
  tokenUsage?: number;
  durationMs?: number;
};

export type OrchestratorResult = {
  runId: string;
  status: 'completed' | 'partial_completed' | 'failed' | 'cancelled';
  results: StepResult[];
  summary?: string;
  error?: string;
};

export type OrchestratorConfig = {
  planId: string;
  executionStrategy?: ExecutionStrategy;
  user: SessionUser;
  tenantId: string;
  budget?: Partial<Budget>;
};

/* ============================================================
 * 常量定义
 * ============================================================ */

const MAX_CONCURRENT_AGENTS_PER_RUN = 5;
const MAX_AGENT_RETRIES = 2;
const DEFAULT_BUDGET: Budget = {
  maxTokens: 8000,
  maxToolCalls: 10,
  maxSteps: 10,
  timeoutSeconds: 120,
};

const STRATEGY_COMPLEXITY_MAP: Record<ComplexityLevel, ExecutionStrategy> = {
  L0: 'SINGLE',
  L1: 'SINGLE',
  L2: 'SEQUENTIAL',
  L3: 'SEQUENTIAL',
  L4: 'PARALLEL',
};

/* ============================================================
 * Agent 匹配评分算法
 * ============================================================ */

function matchAgentForStep(
  step: PlanStep,
  user: SessionUser,
): AgentDefinition | null {
  const allAgents = listAgents();
  let bestAgent: AgentDefinition | null = null;
  let bestScore = 0;

  for (const agent of allAgents) {
    if (agent.status && agent.status !== 'active') continue;

    if (!checkAgentPermission(user, agent)) continue;

    let score = 0;

    if (step.toolCode && agent.tools.includes(step.toolCode)) {
      score += 0.3;
    }

    if (step.agentCode && agent.code === step.agentCode) {
      score += 0.4;
    }

    const riskCompat: Record<string, number> = { L0: 1.0, L1: 0.8, L2: 0.6, L3: 0.4, L4: 0.2 };
    const stepRisk = step.riskLevel;
    const agentRisk = agent.riskLevel;
    const compatScore = riskCompat[agentRisk] ?? 0.5;
    if (stepRisk === 'L0' || stepRisk === 'L1') {
      score += compatScore * 0.2;
    } else {
      score += (1 - compatScore) * 0.2;
    }

    score += 0.1;

    if (score > bestScore) {
      bestScore = score;
      bestAgent = agent;
    }
  }

  return bestAgent;
}

function checkAgentPermission(user: SessionUser, agent: AgentDefinition): boolean {
  if (agent.riskLevel === 'L0') return true;

  const modulePermMap: Record<string, string> = {
    task: 'task.view',
    office: 'office.view',
    research: 'research.view',
    enterprise: 'enterprise.view',
    customer: 'customer.view',
    risk: 'risk.view',
    analytics: 'analytics.view',
    knowledge: 'knowledge.view',
    cockpit: 'cockpit.view',
    collab: 'collab.view',
  };

  const requiredPerm = modulePermMap[agent.module];
  if (!requiredPerm) return true;

  return user.permissions.includes('*') || user.permissions.includes(requiredPerm);
}

/* ============================================================
 * 上下文构建
 * ============================================================ */

function buildAgentContext(
  step: PlanStep,
  config: OrchestratorConfig,
  runId: string,
  budget: Budget,
): AgentContext {
  return {
    runId,
    planId: config.planId,
    stepId: step.id,
    conversationId: undefined,
    tenantId: config.tenantId,
    userId: config.user.id,
    organizationId: config.user.orgUnitId ?? undefined,
    permissions: step.permissionRequired.length > 0
      ? step.permissionRequired
      : config.user.permissions,
    dataScope: config.user.dataScope,
    memoryContext: '',
    knowledgeContext: '',
    toolContext: step.toolCode ? [step.toolCode] : [],
    budget,
  };
}

/* ============================================================
 * Orchestrator 核心执行逻辑
 * ============================================================ */

export async function orchestrate(
  config: OrchestratorConfig,
  eventCallback?: (event: OrchestratorEvent, data: Record<string, unknown>) => void,
): Promise<OrchestratorResult> {
  const plan = await getPlan(config.planId);

  if (plan.status !== 'APPROVED' && plan.status !== 'READY') {
    throw new Error(`Plan 状态非 READY/APPROVED: ${plan.status}`);
  }

  const strategy = config.executionStrategy ?? STRATEGY_COMPLEXITY_MAP[plan.complexity];
  const budget: Budget = {
    maxTokens: config.budget?.maxTokens ?? plan.maxTokens ?? DEFAULT_BUDGET.maxTokens,
    maxToolCalls: config.budget?.maxToolCalls ?? plan.maxToolCalls ?? DEFAULT_BUDGET.maxToolCalls,
    maxSteps: config.budget?.maxSteps ?? plan.maxSteps ?? DEFAULT_BUDGET.maxSteps,
    timeoutSeconds: config.budget?.timeoutSeconds ?? plan.timeoutSeconds ?? DEFAULT_BUDGET.timeoutSeconds,
  };

  const runId = crypto.randomUUID();
  const startTime = Date.now();
  const results: StepResult[] = [];
  let totalTokenUsage = 0;
  let totalToolCalls = 0;

  const db = await getSupabaseClient();
  await db.from('ai_run').insert({
    id: runId,
    tenant_id: config.tenantId,
    user_id: config.user.id,
    agent_code: plan.agentCode,
    goal: plan.userGoal,
    plan: plan as unknown as Record<string, unknown>,
    status: 'running',
    risk_level: 'L1',
    max_tokens: budget.maxTokens,
    max_tool_calls: budget.maxToolCalls,
    max_steps: budget.maxSteps,
    timeout_seconds: budget.timeoutSeconds,
  });

  const sortedSteps = sortByDependencies(plan.steps);

  for (const step of sortedSteps) {
    if (totalTokenUsage >= budget.maxTokens) {
      eventCallback?.('run_partial_completed', { reason: 'Token 预算超限', completedSteps: results.length });
      await updateRunStatus(runId, 'partial_completed', { reason: 'Token 预算超限' });
      return { runId, status: 'partial_completed', results, error: 'Token 预算超限' };
    }

    if (totalToolCalls >= budget.maxToolCalls) {
      eventCallback?.('run_partial_completed', { reason: '工具调用预算超限', completedSteps: results.length });
      await updateRunStatus(runId, 'partial_completed', { reason: '工具调用预算超限' });
      return { runId, status: 'partial_completed', results, error: '工具调用预算超限' };
    }

    if (Date.now() - startTime > budget.timeoutSeconds * 1000) {
      eventCallback?.('run_partial_completed', { reason: '执行超时', completedSteps: results.length });
      await updateRunStatus(runId, 'partial_completed', { reason: '执行超时' });
      return { runId, status: 'partial_completed', results, error: '执行超时' };
    }

    const depResults = step.dependencies.map((depId) =>
      results.find((r) => r.stepId === depId),
    );

    if (depResults.some((r) => r?.status === 'failed')) {
      results.push({
        stepId: step.id,
        seq: step.seq,
        status: 'skipped',
        error: '依赖步骤失败',
      });
      continue;
    }

    if (depResults.some((r) => !r || r.status !== 'completed')) {
      results.push({
        stepId: step.id,
        seq: step.seq,
        status: 'pending',
        error: '依赖步骤未完成',
      });
      continue;
    }

    eventCallback?.('step_start', { stepId: step.id, seq: step.seq, description: step.description });

    const stepResult = await executeStep(
      step,
      config,
      runId,
      budget,
      db,
    );

    results.push(stepResult);

    if (stepResult.tokenUsage) {
      totalTokenUsage += stepResult.tokenUsage;
    }
    if (stepResult.toolCode) {
      totalToolCalls += 1;
    }

    if (stepResult.status === 'completed') {
      eventCallback?.('step_complete', { stepId: step.id, seq: step.seq });
    } else if (stepResult.status === 'failed') {
      const retryPolicy = step.retryPolicy ?? { maxRetries: MAX_AGENT_RETRIES, backoffMs: 1000 };
      let retried = false;

      for (let attempt = 1; attempt <= retryPolicy.maxRetries; attempt++) {
        await new Promise((resolve) => setTimeout(resolve, retryPolicy.backoffMs * attempt));

        eventCallback?.('step_start', { stepId: step.id, seq: step.seq, attempt });

        const retryResult = await executeStep(step, config, runId, budget, db);
        if (retryResult.status === 'completed') {
          results[results.length - 1] = retryResult;
          eventCallback?.('step_complete', { stepId: step.id, seq: step.seq, attempt });
          retried = true;
          break;
        }
      }

      if (!retried) {
        eventCallback?.('step_failed', { stepId: step.id, seq: step.seq, error: stepResult.error });
      }
    }

    if (stepResult.status === 'waiting_confirmation') {
      eventCallback?.('confirmation_required', { stepId: step.id, seq: step.seq });
      await updateRunStatus(runId, 'waiting_confirm');
      return {
        runId,
        status: 'partial_completed',
        results,
        error: '等待用户确认',
      };
    }
  }

  const allCompleted = results.every((r) => r.status === 'completed' || r.status === 'skipped');
  const anyFailed = results.some((r) => r.status === 'failed');

  if (allCompleted) {
    const summary = generateSummary(results, plan.userGoal);
    eventCallback?.('run_complete', { runId, summary });
    await updateRunStatus(runId, 'succeeded', { result: { summary } });
    return { runId, status: 'completed', results, summary };
  } else if (anyFailed) {
    eventCallback?.('run_partial_completed', { runId, failedSteps: results.filter((r) => r.status === 'failed').length });
    await updateRunStatus(runId, 'partial_completed', { reason: '部分步骤失败' });
    return { runId, status: 'partial_completed', results, error: '部分步骤失败' };
  } else {
    eventCallback?.('run_failed', { runId });
    await updateRunStatus(runId, 'failed', { reason: '执行未完成' });
    return { runId, status: 'failed', results, error: '执行未完成' };
  }
}

/* ============================================================
 * 步骤执行
 * ============================================================ */

async function executeStep(
  step: PlanStep,
  config: OrchestratorConfig,
  runId: string,
  budget: Budget,
  db: ReturnType<typeof getSupabaseClient>,
): Promise<StepResult> {
  const stepStartTime = Date.now();
  const agent = matchAgentForStep(step, config.user);
  const context = buildAgentContext(step, config, runId, budget);

  const stepId = crypto.randomUUID();
  await db.from('ai_run_step').insert({
    id: stepId,
    tenant_id: config.tenantId,
    run_id: runId,
    seq: step.seq,
    kind: step.stepType,
    name: step.description,
    input: step.toolParams ?? null,
    status: 'running',
  });

  try {
    let output: Record<string, unknown> = {};
    let tokenUsage = 0;

    if (step.toolCode) {
      const toolResult = await executeTool(step.toolCode, step.toolParams ?? {}, config.user);
      output = toolResult;
      tokenUsage = 200;
    } else {
      output = { description: step.description, result: '推理完成' };
      tokenUsage = 100;
    }

    const durationMs = Date.now() - stepStartTime;

    await db.from('ai_run_step').update({
      status: 'succeeded',
      output,
      finished_at: new Date().toISOString(),
      latency_ms: durationMs,
    }).eq('id', stepId);

    return {
      stepId: step.id,
      seq: step.seq,
      status: 'completed',
      output,
      agentCode: agent?.code,
      toolCode: step.toolCode,
      tokenUsage,
      durationMs,
    };
  } catch (err) {
    const error = err instanceof Error ? err.message : '执行失败';
    const durationMs = Date.now() - stepStartTime;

    await db.from('ai_run_step').update({
      status: 'failed',
      error,
      finished_at: new Date().toISOString(),
      latency_ms: durationMs,
    }).eq('id', stepId);

    return {
      stepId: step.id,
      seq: step.seq,
      status: 'failed',
      error,
      agentCode: agent?.code,
      toolCode: step.toolCode,
      durationMs,
    };
  }
}

/* ============================================================
 * 工具函数
 * ============================================================ */

function sortByDependencies(steps: PlanStep[]): PlanStep[] {
  const sorted: PlanStep[] = [];
  const visited = new Set<string>();

  function visit(step: PlanStep) {
    if (visited.has(step.id)) return;
    visited.add(step.id);

    for (const depId of step.dependencies) {
      const dep = steps.find((s) => s.id === depId);
      if (dep && !visited.has(dep.id)) {
        visit(dep);
      }
    }

    sorted.push(step);
  }

  for (const step of steps) {
    visit(step);
  }

  return sorted;
}

function generateSummary(results: StepResult[], userGoal: string): string {
  const completedSteps = results.filter((r) => r.status === 'completed');
  const toolCalls = results.filter((r) => r.toolCode).map((r) => r.toolCode);
  const outputs = completedSteps.map((r) => r.output).filter(Boolean);

  return `目标: ${userGoal}\n完成步骤: ${completedSteps.length}/${results.length}\n工具调用: ${toolCalls.join(', ')}\n结果: ${outputs.length} 个输出`;
}

async function updateRunStatus(
  runId: string,
  status: string,
  extra?: Record<string, unknown>,
): Promise<void> {
  const db = await getSupabaseClient();
  await db.from('ai_run').update({
    status,
    ...extra,
    finished_at: status === 'succeeded' || status === 'failed' || status === 'partial_completed'
      ? new Date().toISOString()
      : undefined,
  }).eq('id', runId);
}

/* ============================================================
 * 并行执行支持
 * ============================================================ */

export async function orchestrateParallel(
  config: OrchestratorConfig,
  eventCallback?: (event: OrchestratorEvent, data: Record<string, unknown>) => void,
): Promise<OrchestratorResult> {
  const plan = await getPlan(config.planId);

  if (plan.status !== 'APPROVED' && plan.status !== 'READY') {
    throw new Error(`Plan 状态非 READY/APPROVED: ${plan.status}`);
  }

  const runId = crypto.randomUUID();
  const startTime = Date.now();
  const budget: Budget = {
    maxTokens: config.budget?.maxTokens ?? plan.maxTokens ?? DEFAULT_BUDGET.maxTokens,
    maxToolCalls: config.budget?.maxToolCalls ?? plan.maxToolCalls ?? DEFAULT_BUDGET.maxToolCalls,
    maxSteps: config.budget?.maxSteps ?? plan.maxSteps ?? DEFAULT_BUDGET.maxSteps,
    timeoutSeconds: config.budget?.timeoutSeconds ?? plan.timeoutSeconds ?? DEFAULT_BUDGET.timeoutSeconds,
  };

  const db = await getSupabaseClient();
  await db.from('ai_run').insert({
    id: runId,
    tenant_id: config.tenantId,
    user_id: config.user.id,
    agent_code: plan.agentCode,
    goal: plan.userGoal,
    plan: plan as unknown as Record<string, unknown>,
    status: 'running',
    risk_level: 'L1',
    max_tokens: budget.maxTokens,
    max_tool_calls: budget.maxToolCalls,
    max_steps: budget.maxSteps,
    timeout_seconds: budget.timeoutSeconds,
  });

  const independentSteps = plan.steps.filter((s) => s.dependencies.length === 0);
  const dependentSteps = plan.steps.filter((s) => s.dependencies.length > 0);

  const results: StepResult[] = [];

  const batches: PlanStep[][] = [];
  batches.push(independentSteps);

  let remainingDependent = [...dependentSteps];
  const completedIds = new Set<string>();

  while (remainingDependent.length > 0) {
    const ready = remainingDependent.filter((s) =>
      s.dependencies.every((depId) => completedIds.has(depId)),
    );
    if (ready.length === 0) break;
    batches.push(ready);
    remainingDependent = remainingDependent.filter((s) => !ready.includes(s));
  }

  for (const batch of batches) {
    const limitedBatch = batch.slice(0, MAX_CONCURRENT_AGENTS_PER_RUN);
    const batchResults = await Promise.all(
      limitedBatch.map((step) => executeStep(step, config, runId, budget, db)),
    );

    for (const result of batchResults) {
      results.push(result);
      if (result.status === 'completed') {
        completedIds.add(result.stepId);
      }
      eventCallback?.(
        result.status === 'completed' ? 'step_complete' : 'step_failed',
        { stepId: result.stepId, seq: result.seq },
      );
    }
  }

  const allCompleted = results.every((r) => r.status === 'completed' || r.status === 'skipped');

  if (allCompleted) {
    const summary = generateSummary(results, plan.userGoal);
    eventCallback?.('run_complete', { runId, summary });
    await updateRunStatus(runId, 'succeeded', { result: { summary } });
    return { runId, status: 'completed', results, summary };
  } else {
    eventCallback?.('run_partial_completed', { runId });
    await updateRunStatus(runId, 'partial_completed', { reason: '部分步骤失败' });
    return { runId, status: 'partial_completed', results, error: '部分步骤失败' };
  }
}