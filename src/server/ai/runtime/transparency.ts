import { getSupabaseClient } from '@/storage/database/supabase-client';
import type { SessionUser } from '@/lib/auth';

export type RunPanelItem = {
  runId: string;
  agentCode: string;
  goal: string;
  status: string;
  startedAt: string | null;
  finishedAt: string | null;
  latencyMs: number | null;
};

export type RunPanel = {
  running: RunPanelItem[];
  queued: RunPanelItem[];
  waitingConfirm: RunPanelItem[];
  recentlyCompleted: RunPanelItem[];
  failed: RunPanelItem[];
  paused: RunPanelItem[];
  partialCompleted: RunPanelItem[];
};

export type TimelineStep = {
  stepId: string;
  seq: number;
  kind: string;
  name: string;
  status: string;
  startedAt: string | null;
  finishedAt: string | null;
  durationMs: number | null;
  toolName: string | null;
  hasError: boolean;
  error: string | null;
};

export type RunTimeline = {
  runId: string;
  agentCode: string;
  goal: string;
  status: string;
  startedAt: string | null;
  finishedAt: string | null;
  latencyMs: number | null;
  steps: TimelineStep[];
};

export type VisibleTimelineStep = {
  stepId: string;
  seq: number;
  status: string;
  name: string;
  durationMs: number | null;
  toolName: string | null;
  hasError: boolean;
};

export type VisibleRunTimeline = {
  runId: string;
  agentCode: string;
  goal: string;
  status: string;
  startedAt: string | null;
  finishedAt: string | null;
  steps: VisibleTimelineStep[];
};

const HIDDEN_FIELDS = new Set([
  'input',
  'output',
  'internalPrompt',
  'modelParams',
  'tokenDetails',
  'sqlQuery',
  'agentReasoning',
]);

const ADMIN_VISIBLE_FIELDS = new Set([
  'input',
  'output',
  'toolParams',
]);

export async function getRunPanel(
  tenantId: string,
  user: SessionUser,
): Promise<RunPanel> {
  const db = await getSupabaseClient();

  const { data: runningRuns } = await db.from('ai_run')
    .select('id,agent_code,goal,status,started_at,finished_at,latency_ms')
    .eq('tenant_id', tenantId)
    .eq('status', 'running')
    .order('started_at', { ascending: false })
    .limit(20);

  const { data: queuedRuns } = await db.from('ai_run')
    .select('id,agent_code,goal,status,started_at,finished_at,latency_ms')
    .eq('tenant_id', tenantId)
    .eq('status', 'queued')
    .order('created_at', { ascending: false })
    .limit(20);

  const { data: waitingRuns } = await db.from('ai_run')
    .select('id,agent_code,goal,status,started_at,finished_at,latency_ms')
    .eq('tenant_id', tenantId)
    .eq('status', 'waiting_confirm')
    .order('created_at', { ascending: false })
    .limit(20);

  const { data: completedRuns } = await db.from('ai_run')
    .select('id,agent_code,goal,status,started_at,finished_at,latency_ms')
    .eq('tenant_id', tenantId)
    .eq('status', 'succeeded')
    .order('finished_at', { ascending: false })
    .limit(20);

  const { data: failedRuns } = await db.from('ai_run')
    .select('id,agent_code,goal,status,started_at,finished_at,latency_ms')
    .eq('tenant_id', tenantId)
    .eq('status', 'failed')
    .order('finished_at', { ascending: false })
    .limit(20);

  const { data: pausedRuns } = await db.from('ai_run')
    .select('id,agent_code,goal,status,started_at,finished_at,latency_ms')
    .eq('tenant_id', tenantId)
    .eq('status', 'paused')
    .order('created_at', { ascending: false })
    .limit(20);

  const { data: partialRuns } = await db.from('ai_run')
    .select('id,agent_code,goal,status,started_at,finished_at,latency_ms')
    .eq('tenant_id', tenantId)
    .eq('status', 'partial_completed')
    .order('finished_at', { ascending: false })
    .limit(20);

  return {
    running: (runningRuns ?? []).map(r => mapRowToPanelItem(r as Record<string, unknown>)),
    queued: (queuedRuns ?? []).map(r => mapRowToPanelItem(r as Record<string, unknown>)),
    waitingConfirm: (waitingRuns ?? []).map(r => mapRowToPanelItem(r as Record<string, unknown>)),
    recentlyCompleted: (completedRuns ?? []).map(r => mapRowToPanelItem(r as Record<string, unknown>)),
    failed: (failedRuns ?? []).map(r => mapRowToPanelItem(r as Record<string, unknown>)),
    paused: (pausedRuns ?? []).map(r => mapRowToPanelItem(r as Record<string, unknown>)),
    partialCompleted: (partialRuns ?? []).map(r => mapRowToPanelItem(r as Record<string, unknown>)),
  };
}

export async function getRunTimeline(
  tenantId: string,
  runId: string,
  user: SessionUser,
): Promise<RunTimeline | null> {
  const db = await getSupabaseClient();

  const { data: run } = await db.from('ai_run')
    .select('id,agent_code,goal,status,started_at,finished_at,latency_ms')
    .eq('id', runId)
    .eq('tenant_id', tenantId)
    .single();

  if (!run) return null;

  const { data: steps } = await db.from('ai_run_step')
    .select('id,seq,kind,name,status,started_at,finished_at,error')
    .eq('run_id', runId)
    .eq('tenant_id', tenantId)
    .order('seq');

  const timelineSteps: TimelineStep[] = (steps ?? []).map((s: Record<string, unknown>) => {
    const startedAt = s.started_at as string | null;
    const finishedAt = s.finished_at as string | null;
    let durationMs: number | null = null;
    if (startedAt && finishedAt) {
      durationMs = new Date(finishedAt).getTime() - new Date(startedAt).getTime();
    }

    return {
      stepId: s.id as string,
      seq: s.seq as number,
      kind: s.kind as string,
      name: s.name as string,
      status: s.status as string,
      startedAt,
      finishedAt,
      durationMs,
      toolName: s.kind === 'tool_call' ? s.name as string : null,
      hasError: s.status === 'failed',
      error: s.error as string | null,
    };
  });

  return {
    runId: run.id as string,
    agentCode: run.agent_code as string,
    goal: run.goal as string,
    status: run.status as string,
    startedAt: run.started_at as string | null,
    finishedAt: run.finished_at as string | null,
    latencyMs: run.latency_ms as number | null,
    steps: timelineSteps,
  };
}

export async function getVisibleRunTimeline(
  tenantId: string,
  runId: string,
  user: SessionUser,
): Promise<VisibleRunTimeline | null> {
  const timeline = await getRunTimeline(tenantId, runId, user);
  if (!timeline) return null;

  const isAdmin = user.roleCode === 'admin';

  const visibleSteps: VisibleTimelineStep[] = timeline.steps.map(step => ({
    stepId: step.stepId,
    seq: step.seq,
    status: step.status,
    name: step.name,
    durationMs: step.durationMs,
    toolName: step.toolName,
    hasError: step.hasError,
  }));

  return {
    runId: timeline.runId,
    agentCode: timeline.agentCode,
    goal: timeline.goal,
    status: timeline.status,
    startedAt: timeline.startedAt,
    finishedAt: timeline.finishedAt,
    steps: visibleSteps,
  };
}

function mapRowToPanelItem(row: Record<string, unknown>): RunPanelItem {
  return {
    runId: row.id as string,
    agentCode: row.agent_code as string,
    goal: row.goal as string,
    status: row.status as string,
    startedAt: row.started_at as string | null,
    finishedAt: row.finished_at as string | null,
    latencyMs: row.latency_ms as number | null,
  };
}