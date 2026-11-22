import { getSupabaseClient } from '@/storage/database/supabase-client';
import type { SessionUser } from '@/lib/auth';

export type FeedbackType = 'LIKE' | 'DISLIKE' | 'TEXT';

export type Feedback = {
  id: string;
  tenantId: string;
  aiRunId: string;
  messageId: string | null;
  stepId: string | null;
  type: FeedbackType;
  content: string | null;
  createdBy: string;
  createdAt: string;
};

export type Evaluation = {
  runId: string;
  successRate: number;
  stepCompletionRate: number;
  toolAccuracyRate: number;
  userSatisfaction: number;
  qualityScore: number;
  metrics: QualityMetrics;
};

export type QualityMetrics = {
  firstExecutionSuccessRate: number;
  avgStepCount: number;
  avgToolCallCount: number;
  avgTokenConsumption: number;
  avgExecutionTime: number;
  feedbackDistribution: FeedbackDistribution;
  qualityScoreDistribution: ScoreDistribution;
  agentRanking: AgentRankingItem[];
};

export type FeedbackDistribution = {
  like: number;
  dislike: number;
  text: number;
  total: number;
};

export type ScoreDistribution = {
  excellent: number;
  good: number;
  average: number;
  poor: number;
  total: number;
};

export type AgentRankingItem = {
  agentCode: string;
  successRate: number;
  avgQualityScore: number;
  totalRuns: number;
};

export async function createFeedback(
  tenantId: string,
  aiRunId: string,
  type: FeedbackType,
  content?: string,
  messageId?: string,
  stepId?: string,
  createdBy?: string,
): Promise<Feedback> {
  const db = await getSupabaseClient();

  const id = crypto.randomUUID();
  const now = new Date().toISOString();

  const { data, error } = await db.from('ai_feedback').insert({
    id,
    tenant_id: tenantId,
    ai_run_id: aiRunId,
    message_id: messageId ?? null,
    step_id: stepId ?? null,
    type,
    content: content ?? null,
    created_by: createdBy ?? null,
    created_at: now,
  }).select('*').limit(1);

  if (error || !data?.[0]) {
    throw new Error(`创建反馈失败: ${error?.message ?? '未知错误'}`);
  }

  const row = data[0] as Record<string, unknown>;
  return {
    id: row.id as string,
    tenantId: row.tenant_id as string,
    aiRunId: row.ai_run_id as string,
    messageId: row.message_id as string | null,
    stepId: row.step_id as string | null,
    type: row.type as FeedbackType,
    content: row.content as string | null,
    createdBy: row.created_by as string,
    createdAt: row.created_at as string,
  };
}

export async function getEvaluation(
  tenantId: string,
  runId: string,
): Promise<Evaluation | null> {
  const db = await getSupabaseClient();

  const { data: run } = await db.from('ai_run')
    .select('id,status,agent_code,latency_ms,cost')
    .eq('id', runId)
    .eq('tenant_id', tenantId)
    .single();

  if (!run) return null;

  const { data: steps } = await db.from('ai_run_step')
    .select('id,status')
    .eq('run_id', runId)
    .eq('tenant_id', tenantId);

  const { data: feedback } = await db.from('ai_feedback')
    .select('type')
    .eq('ai_run_id', runId)
    .eq('tenant_id', tenantId);

  const totalSteps = steps?.length ?? 0;
  const succeededSteps = (steps ?? []).filter((s: Record<string, unknown>) => s.status === 'succeeded').length;
  const stepCompletionRate = totalSteps > 0 ? succeededSteps / totalSteps : 0;

  const successRate = run.status === 'succeeded' ? 1 : run.status === 'partial_completed' ? 0.5 : 0;

  const feedbackList = feedback ?? [];
  const likeCount = feedbackList.filter((f: Record<string, unknown>) => f.type === 'LIKE').length;
  const dislikeCount = feedbackList.filter((f: Record<string, unknown>) => f.type === 'DISLIKE').length;
  const userSatisfaction = feedbackList.length > 0
    ? likeCount / feedbackList.length
    : 0.5;

  const toolAccuracyRate = stepCompletionRate;

  const qualityScore = Math.round(
    (successRate * 30 + stepCompletionRate * 25 + toolAccuracyRate * 20 + userSatisfaction * 25)
  );

  return {
    runId,
    successRate,
    stepCompletionRate,
    toolAccuracyRate,
    userSatisfaction,
    qualityScore,
    metrics: {
      firstExecutionSuccessRate: successRate,
      avgStepCount: totalSteps,
      avgToolCallCount: 0,
      avgTokenConsumption: run.cost as number ?? 0,
      avgExecutionTime: run.latency_ms as number ?? 0,
      feedbackDistribution: {
        like: likeCount,
        dislike: dislikeCount,
        text: feedbackList.filter((f: Record<string, unknown>) => f.type === 'TEXT').length,
        total: feedbackList.length,
      },
      qualityScoreDistribution: {
        excellent: qualityScore >= 90 ? 1 : 0,
        good: qualityScore >= 70 && qualityScore < 90 ? 1 : 0,
        average: qualityScore >= 50 && qualityScore < 70 ? 1 : 0,
        poor: qualityScore < 50 ? 1 : 0,
        total: 1,
      },
      agentRanking: [],
    },
  };
}

export async function getAgentEvaluationSummary(
  tenantId: string,
  agentCode: string,
): Promise<QualityMetrics | null> {
  const db = await getSupabaseClient();

  const { data: runs } = await db.from('ai_run')
    .select('id,status,latency_ms,cost')
    .eq('tenant_id', tenantId)
    .eq('agent_code', agentCode)
    .limit(100);

  if (!runs || runs.length === 0) return null;

  const totalRuns = runs.length;
  const succeededRuns = runs.filter((r: Record<string, unknown>) => r.status === 'succeeded').length;
  const firstExecutionSuccessRate = succeededRuns / totalRuns;

  const avgLatency = runs.reduce((sum: number, r: Record<string, unknown>) => sum + (r.latency_ms as number ?? 0), 0) / totalRuns;
  const avgCost = runs.reduce((sum: number, r: Record<string, unknown>) => sum + (r.cost as number ?? 0), 0) / totalRuns;

  let totalSteps = 0;
  let totalToolCalls = 0;
  for (const run of runs) {
    const { data: steps } = await db.from('ai_run_step')
      .select('id,kind')
      .eq('run_id', run.id as string)
      .eq('tenant_id', tenantId);
    totalSteps += steps?.length ?? 0;
    totalToolCalls += (steps ?? []).filter((s: Record<string, unknown>) => s.kind === 'tool_call').length;
  }

  const { data: allFeedback } = await db.from('ai_feedback')
    .select('type')
    .in('ai_run_id', runs.map((r: Record<string, unknown>) => r.id as string))
    .eq('tenant_id', tenantId);

  const feedbackList = allFeedback ?? [];
  const likeCount = feedbackList.filter((f: Record<string, unknown>) => f.type === 'LIKE').length;
  const dislikeCount = feedbackList.filter((f: Record<string, unknown>) => f.type === 'DISLIKE').length;
  const textCount = feedbackList.filter((f: Record<string, unknown>) => f.type === 'TEXT').length;

  return {
    firstExecutionSuccessRate,
    avgStepCount: totalSteps / totalRuns,
    avgToolCallCount: totalToolCalls / totalRuns,
    avgTokenConsumption: avgCost,
    avgExecutionTime: avgLatency,
    feedbackDistribution: {
      like: likeCount,
      dislike: dislikeCount,
      text: textCount,
      total: feedbackList.length,
    },
    qualityScoreDistribution: {
      excellent: 0,
      good: 0,
      average: 0,
      poor: 0,
      total: 0,
    },
    agentRanking: [],
  };
}