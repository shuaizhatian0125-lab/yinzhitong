import { getSupabaseClient } from '@/storage/database/supabase-client';
import type { SessionUser } from '@/lib/auth';
import { getAgent } from '@/server/ai/agents/registry';
import { executeTool } from '@/server/ai/tools/registry';
import type { Plan, LegacyPlan } from '@/server/ai/runtime/planner';

export type RunStatus =
  | 'queued'
  | 'running'
  | 'waiting_confirm'
  | 'waiting_approval'
  | 'partial_completed'
  | 'paused'
  | 'succeeded'
  | 'failed'
  | 'cancelled';

export type StepStatus = 'pending' | 'running' | 'succeeded' | 'failed' | 'skipped';

export type RunBudget = {
  maxTokens?: number;
  maxToolCalls?: number;
  maxSteps?: number;
  timeoutSeconds?: number;
};

export type BudgetUsage = {
  tokensUsed: number;
  toolCallsUsed: number;
  stepsExecuted: number;
  elapsedSeconds: number;
};

export type CreateRunParams = {
  tenantId: string;
  conversationId?: string;
  messageId?: string;
  userId: string;
  agentCode: string;
  goal: string;
  plan: Plan | LegacyPlan;
  riskLevel: string;
  budget?: RunBudget;
};

export type RunResult = {
  runId: string;
  status: RunStatus;
  result?: Record<string, unknown>;
  error?: string;
  steps?: RunStepResult[];
  budgetUsage?: BudgetUsage;
};

export type RunStepResult = {
  stepId: string;
  seq: number;
  status: StepStatus;
  output?: Record<string, unknown>;
  error?: string;
};

const DEFAULT_BUDGET: Required<RunBudget> = {
  maxTokens: 100_000,
  maxToolCalls: 20,
  maxSteps: 15,
  timeoutSeconds: 180,
};

const STEP_TIMEOUT_MS = 60_000;
const MAX_RETRY = 1;

const completedStepCache = new Set<string>();
const pausedRunCache = new Map<string, { reason: string; atStep: number }>();

function stepTypeToKind(stepType: string): string {
  if (['RESEARCH', 'ANALYSIS', 'REVIEW'].includes(stepType)) return 'reasoning';
  if (['APPROVAL'].includes(stepType)) return 'output';
  return 'tool_call';
}

function planRequiresConfirmation(plan: Plan | LegacyPlan): boolean {
  if ('requiresConfirmation' in plan) return plan.requiresConfirmation;
  return plan.status === 'APPROVAL_REQUIRED';
}

function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

export async function createAiRun(params: CreateRunParams): Promise<string> {
  const db = await getSupabaseClient();
  const runId = crypto.randomUUID();
  const budget = { ...DEFAULT_BUDGET, ...params.budget };

  await db.from('ai_run').insert({
    id: runId,
    tenant_id: params.tenantId,
    conversation_id: params.conversationId ?? null,
    message_id: params.messageId ?? null,
    user_id: params.userId,
    agent_code: params.agentCode,
    goal: params.goal,
    plan: params.plan as unknown as Record<string, unknown>,
    status: 'queued',
    risk_level: params.riskLevel,
    max_tokens: budget.maxTokens,
    max_tool_calls: budget.maxToolCalls,
    max_steps: budget.maxSteps,
    timeout_seconds: budget.timeoutSeconds,
  });

  for (const step of params.plan.steps) {
    const stepId = crypto.randomUUID();
    const kind = 'kind' in step ? step.kind : stepTypeToKind(step.stepType);
    await db.from('ai_run_step').insert({
      id: stepId,
      tenant_id: params.tenantId,
      run_id: runId,
      seq: step.seq,
      kind,
      name: step.description,
      input: step.toolParams ?? null,
      status: 'pending',
    });
  }

  return runId;
}

export async function executeRun(runId: string, user: SessionUser): Promise<RunResult> {
  const db = await getSupabaseClient();
  const runStartTime = Date.now();

  const { data: run } = await db.from('ai_run')
    .select('id,tenant_id,agent_code,goal,plan,status,risk_level,max_tokens,max_tool_calls,max_steps,timeout_seconds')
    .eq('id', runId)
    .single();

  if (!run) {
    return { runId, status: 'failed', error: 'AI Run 不存在' };
  }

  if (run.status === 'cancelled') {
    return { runId, status: 'cancelled' };
  }

  if (run.status === 'paused') {
    return { runId, status: 'paused', error: 'Run 已暂停，使用 resumeRun 恢复' };
  }

  const plan = run.plan as unknown as Plan;
  const agent = getAgent(run.agent_code as string);
  if (!agent) {
    await updateRunStatus(runId, 'failed', { error: 'Agent 不存在' });
    return { runId, status: 'failed', error: 'Agent 不存在' };
  }

  if (planRequiresConfirmation(plan) && run.status === 'queued') {
    await updateRunStatus(runId, 'waiting_confirm');
    return { runId, status: 'waiting_confirm' };
  }

  await updateRunStatus(runId, 'running');

  const budget: Required<RunBudget> = {
    maxTokens: run.max_tokens ?? DEFAULT_BUDGET.maxTokens,
    maxToolCalls: run.max_tool_calls ?? DEFAULT_BUDGET.maxToolCalls,
    maxSteps: run.max_steps ?? DEFAULT_BUDGET.maxSteps,
    timeoutSeconds: run.timeout_seconds ?? DEFAULT_BUDGET.timeoutSeconds,
  };

  const budgetUsage: BudgetUsage = {
    tokensUsed: 0,
    toolCallsUsed: 0,
    stepsExecuted: 0,
    elapsedSeconds: 0,
  };

  const { data: steps } = await db.from('ai_run_step')
    .select('id,seq,kind,name,input,status')
    .eq('run_id', runId)
    .eq('tenant_id', user.tenantId)
    .order('seq');

  const stepResults: RunStepResult[] = [];
  let lastOutput: Record<string, unknown> = {};
  let hasFailure = false;
  let hasSuccess = false;

  const resumeFromSeq = pausedRunCache.has(runId) ? pausedRunCache.get(runId)!.atStep : 0;
  if (resumeFromSeq > 0) {
    pausedRunCache.delete(runId);
  }

  for (const step of steps ?? []) {
    const stepKey = `${runId}:${step.seq}`;
    const seq = step.seq as number;

    if (seq < resumeFromSeq) {
      stepResults.push({
        stepId: step.id,
        seq,
        status: 'skipped',
      });
      continue;
    }

    if (step.status === 'succeeded' || step.status === 'failed') {
      stepResults.push({
        stepId: step.id,
        seq,
        status: step.status as StepStatus,
      });
      if (step.status === 'succeeded') hasSuccess = true;
      if (step.status === 'failed') hasFailure = true;
      continue;
    }

    if (completedStepCache.has(stepKey)) {
      stepResults.push({
        stepId: step.id,
        seq,
        status: 'skipped',
      });
      continue;
    }

    budgetUsage.elapsedSeconds = Math.floor((Date.now() - runStartTime) / 1000);
    if (budgetUsage.elapsedSeconds > budget.timeoutSeconds) {
      await updateRunStatus(runId, 'failed', { error: '整体超时' });
      return { runId, status: 'failed', error: '整体超时', steps: stepResults, budgetUsage };
    }

    if (budgetUsage.stepsExecuted >= budget.maxSteps) {
      await updateRunStatus(runId, 'paused', { error: '步骤数超限' });
      pausedRunCache.set(runId, { reason: '步骤数超限', atStep: seq });
      return {
        runId,
        status: 'paused',
        error: `步骤数超限 (${budgetUsage.stepsExecuted}/${budget.maxSteps})`,
        steps: stepResults,
        budgetUsage,
      };
    }

    if (budgetUsage.toolCallsUsed >= budget.maxToolCalls) {
      await updateRunStatus(runId, 'paused', { error: '工具调用数超限' });
      pausedRunCache.set(runId, { reason: '工具调用数超限', atStep: seq });
      return {
        runId,
        status: 'paused',
        error: `工具调用数超限 (${budgetUsage.toolCallsUsed}/${budget.maxToolCalls})`,
        steps: stepResults,
        budgetUsage,
      };
    }

    if (budgetUsage.tokensUsed >= budget.maxTokens) {
      await updateRunStatus(runId, 'paused', { error: 'Token 预算超限' });
      pausedRunCache.set(runId, { reason: 'Token 预算超限', atStep: seq });
      return {
        runId,
        status: 'paused',
        error: `Token 预算超限 (${budgetUsage.tokensUsed}/${budget.maxTokens})`,
        steps: stepResults,
        budgetUsage,
      };
    }

    const stepResult = await executeStep(
      runId,
      step.id,
      seq,
      step.kind as string,
      step.name as string,
      step.input as Record<string, unknown> | null,
      user,
      run.tenant_id as string,
      budgetUsage,
    );

    stepResults.push(stepResult);
    completedStepCache.add(stepKey);
    budgetUsage.stepsExecuted++;

    if (stepResult.status === 'failed') {
      hasFailure = true;
      const retried = await retryStep(
        runId,
        step.id,
        seq,
        step.kind as string,
        step.name as string,
        step.input as Record<string, unknown> | null,
        user,
        run.tenant_id as string,
        budgetUsage,
      );

      if (retried.status === 'failed') {
        const remainingSteps = (steps ?? []).filter(s => (s.seq as number) > seq);
        if (remainingSteps.length > 0 && hasSuccess) {
          await updateRunStatus(runId, 'partial_completed', {
            result: lastOutput,
            error: `步骤 ${seq} 失败: ${stepResult.error}`,
          });
          return {
            runId,
            status: 'partial_completed',
            result: lastOutput,
            error: `步骤 ${seq} 失败: ${stepResult.error}`,
            steps: stepResults,
            budgetUsage,
          };
        }
        await updateRunStatus(runId, 'failed', { error: stepResult.error });
        return { runId, status: 'failed', error: stepResult.error, steps: stepResults, budgetUsage };
      }

      stepResults[stepResults.length - 1] = retried;
      lastOutput = retried.output ?? {};
      hasFailure = false;
    } else {
      lastOutput = stepResult.output ?? {};
      hasSuccess = true;
    }
  }

  if (hasFailure && hasSuccess) {
    await updateRunStatus(runId, 'partial_completed', { result: lastOutput });
    return {
      runId,
      status: 'partial_completed',
      result: lastOutput,
      steps: stepResults,
      budgetUsage,
    };
  }

  await db.from('ai_run').update({
    status: 'succeeded',
    result: lastOutput,
    finished_at: new Date().toISOString(),
    latency_ms: Date.now() - runStartTime,
  }).eq('id', runId);

  return {
    runId,
    status: 'succeeded',
    result: lastOutput,
    steps: stepResults,
    budgetUsage,
  };
}

async function executeStep(
  runId: string,
  stepId: string,
  seq: number,
  kind: string,
  name: string,
  input: Record<string, unknown> | null,
  user: SessionUser,
  tenantId: string,
  budgetUsage: BudgetUsage,
): Promise<RunStepResult> {
  const db = await getSupabaseClient();
  const stepStartTime = Date.now();

  await db.from('ai_run_step').update({
    status: 'running',
    started_at: new Date().toISOString(),
  }).eq('id', stepId);

  let output: Record<string, unknown> = {};
  let status: StepStatus = 'succeeded';
  let error: string | undefined;

  try {
    if (kind === 'tool_call') {
      const plan = (await db.from('ai_run').select('plan').eq('id', runId).single()).data?.plan as unknown as Plan;
      const planStep = plan?.steps.find((s) => s.seq === seq);
      const toolCode = planStep?.toolCode ?? input?.toolCode as string;

      if (!toolCode) {
        throw new Error('未指定工具编码');
      }

      const toolParams = planStep?.toolParams ?? input ?? {};

      const stepTimeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('步骤超时')), STEP_TIMEOUT_MS);
      });

      const toolResult = await Promise.race([
        executeTool(toolCode, toolParams, user, { runId, stepId }),
        stepTimeoutPromise,
      ]);

      budgetUsage.toolCallsUsed++;
      budgetUsage.tokensUsed += estimateTokens(JSON.stringify(toolParams)) + estimateTokens(JSON.stringify(toolResult));

      output = toolResult.success ? toolResult.result : { error: toolResult.error };
      if (!toolResult.success) {
        status = 'failed';
        error = toolResult.error;
      }
    } else if (kind === 'reasoning') {
      output = { reasoning: name };
      budgetUsage.tokensUsed += estimateTokens(name);
    } else if (kind === 'output') {
      output = { output: name };
      budgetUsage.tokensUsed += estimateTokens(name);
    }
  } catch (err) {
    status = 'failed';
    error = err instanceof Error ? err.message : String(err);
  }

  await db.from('ai_run_step').update({
    status,
    output,
    error: error ?? null,
    finished_at: new Date().toISOString(),
  }).eq('id', stepId);

  return {
    stepId,
    seq,
    status,
    output: status === 'succeeded' ? output : undefined,
    error,
  };
}

async function retryStep(
  runId: string,
  stepId: string,
  seq: number,
  kind: string,
  name: string,
  input: Record<string, unknown> | null,
  user: SessionUser,
  tenantId: string,
  budgetUsage: BudgetUsage,
): Promise<RunStepResult> {
  return executeStep(runId, stepId, seq, kind, name, input, user, tenantId, budgetUsage);
}

async function updateRunStatus(
  runId: string,
  status: RunStatus,
  extra?: { error?: string; result?: Record<string, unknown> },
): Promise<void> {
  const db = await getSupabaseClient();
  const updates: Record<string, unknown> = { status };
  if (extra?.error) updates.error = extra.error;
  if (extra?.result) updates.result = extra.result;
  if (status === 'running') updates.started_at = new Date().toISOString();
  if (status === 'succeeded' || status === 'failed' || status === 'cancelled' || status === 'partial_completed') {
    updates.finished_at = new Date().toISOString();
  }

  await db.from('ai_run').update(updates).eq('id', runId);
}

export async function confirmRun(runId: string, user: SessionUser): Promise<RunResult> {
  const db = await getSupabaseClient();
  const { data: run } = await db.from('ai_run')
    .select('status')
    .eq('id', runId)
    .eq('tenant_id', user.tenantId)
    .single();

  if (!run) {
    return { runId, status: 'failed', error: 'AI Run 不存在' };
  }

  if (run.status !== 'waiting_confirm') {
    return { runId, status: run.status as RunStatus, error: '当前状态不允许确认' };
  }

  await db.from('ai_run').update({ status: 'running' }).eq('id', runId);

  return executeRun(runId, user);
}

export async function cancelRun(runId: string, user: SessionUser): Promise<RunResult> {
  const db = await getSupabaseClient();
  const { data: run } = await db.from('ai_run')
    .select('status')
    .eq('id', runId)
    .eq('tenant_id', user.tenantId)
    .single();

  if (!run) {
    return { runId, status: 'failed', error: 'AI Run 不存在' };
  }

  const currentStatus = run.status as RunStatus;
  if (currentStatus === 'succeeded' || currentStatus === 'failed' || currentStatus === 'cancelled') {
    return { runId, status: currentStatus, error: '已完成的 Run 无法取消' };
  }

  await db.from('ai_run').update({
    status: 'cancelled',
    finished_at: new Date().toISOString(),
  }).eq('id', runId);

  await db.from('ai_run_step')
    .update({ status: 'skipped' })
    .eq('run_id', runId)
    .eq('tenant_id', user.tenantId)
    .in('status', ['pending', 'running']);

  pausedRunCache.delete(runId);

  return { runId, status: 'cancelled' };
}

export async function stopRun(runId: string, user: SessionUser): Promise<RunResult> {
  const db = await getSupabaseClient();
  const { data: run } = await db.from('ai_run')
    .select('id,status')
    .eq('id', runId)
    .eq('tenant_id', user.tenantId)
    .single();

  if (!run) {
    return { runId, status: 'failed', error: 'AI Run 不存在' };
  }

  const currentStatus = run.status as RunStatus;
  if (currentStatus === 'succeeded' || currentStatus === 'failed' || currentStatus === 'cancelled') {
    return { runId, status: currentStatus };
  }

  await db.from('ai_run').update({
    status: 'paused',
    finished_at: new Date().toISOString(),
  }).eq('id', runId);

  await db.from('ai_run_step')
    .update({ status: 'skipped' })
    .eq('run_id', runId)
    .eq('tenant_id', user.tenantId)
    .eq('status', 'pending');

  const { data: steps } = await db.from('ai_run_step')
    .select('id,seq,kind,name,status,output,error')
    .eq('run_id', runId)
    .eq('tenant_id', user.tenantId)
    .order('seq');

  const completedSteps: RunStepResult[] = (steps ?? [])
    .filter(s => s.status === 'succeeded' || s.status === 'failed')
    .map(s => ({
      stepId: s.id as string,
      seq: s.seq as number,
      status: s.status as StepStatus,
      output: s.output as Record<string, unknown> | undefined,
      error: s.error as string | undefined,
    }));

  const lastCompletedSeq = completedSteps.length > 0
    ? completedSteps[completedSteps.length - 1].seq + 1
    : 0;
  pausedRunCache.set(runId, { reason: '用户主动停止', atStep: lastCompletedSeq });

  return {
    runId,
    status: 'paused',
    steps: completedSteps,
    error: '用户主动停止',
  };
}

export async function resumeRun(runId: string, user: SessionUser): Promise<RunResult> {
  const db = await getSupabaseClient();
  const { data: run } = await db.from('ai_run')
    .select('status')
    .eq('id', runId)
    .eq('tenant_id', user.tenantId)
    .single();

  if (!run) {
    return { runId, status: 'failed', error: 'AI Run 不存在' };
  }

  if (run.status !== 'paused') {
    return { runId, status: run.status as RunStatus, error: '当前状态不允许恢复' };
  }

  await db.from('ai_run').update({ status: 'running', finished_at: null }).eq('id', runId);

  return executeRun(runId, user);
}

export async function regenerateRun(runId: string, user: SessionUser): Promise<string> {
  const db = await getSupabaseClient();
  const { data: originalRun } = await db.from('ai_run')
    .select('tenant_id,conversation_id,message_id,user_id,agent_code,goal,plan,risk_level,max_tokens,max_tool_calls,max_steps,timeout_seconds')
    .eq('id', runId)
    .eq('tenant_id', user.tenantId)
    .single();

  if (!originalRun) {
    throw new Error('原始 Run 不存在');
  }

  const newRunId = await createAiRun({
    tenantId: originalRun.tenant_id as string,
    conversationId: originalRun.conversation_id as string | undefined,
    messageId: originalRun.message_id as string | undefined,
    userId: originalRun.user_id as string,
    agentCode: originalRun.agent_code as string,
    goal: originalRun.goal as string,
    plan: originalRun.plan as unknown as Plan,
    riskLevel: originalRun.risk_level as string,
    budget: {
      maxTokens: originalRun.max_tokens as number | undefined,
      maxToolCalls: originalRun.max_tool_calls as number | undefined,
      maxSteps: originalRun.max_steps as number | undefined,
      timeoutSeconds: originalRun.timeout_seconds as number | undefined,
    },
  });

  return newRunId;
}

export async function getRunStatus(runId: string, user: SessionUser): Promise<{
  runId: string;
  status: RunStatus;
  steps: RunStepResult[];
  budgetUsage?: BudgetUsage;
  error?: string;
}> {
  const db = await getSupabaseClient();

  const { data: run } = await db.from('ai_run')
    .select('id,status,error,max_tokens,max_tool_calls,max_steps,timeout_seconds')
    .eq('id', runId)
    .eq('tenant_id', user.tenantId)
    .single();

  if (!run) {
    return { runId, status: 'failed', steps: [], error: 'AI Run 不存在' };
  }

  const { data: steps } = await db.from('ai_run_step')
    .select('id,seq,kind,name,status,output,error')
    .eq('run_id', runId)
    .eq('tenant_id', user.tenantId)
    .order('seq');

  const stepResults: RunStepResult[] = (steps ?? []).map(s => ({
    stepId: s.id as string,
    seq: s.seq as number,
    status: s.status as StepStatus,
    output: s.output as Record<string, unknown> | undefined,
    error: s.error as string | undefined,
  }));

  return {
    runId,
    status: run.status as RunStatus,
    steps: stepResults,
    error: run.error as string | undefined,
  };
}

export function clearCompletedStepCache(runId?: string): void {
  if (runId) {
    for (const key of completedStepCache) {
      if (key.startsWith(`${runId}:`)) {
        completedStepCache.delete(key);
      }
    }
    pausedRunCache.delete(runId);
  } else {
    completedStepCache.clear();
    pausedRunCache.clear();
  }
}