import { getSupabaseClient } from '@/storage/database/supabase-client';
import type { SessionUser } from '@/lib/auth';

export type KillSwitchAction =
  | 'STOP_ALL_AGENTS'
  | 'PAUSE_COLLABORATION'
  | 'STOP_WORKSTREAM'
  | 'STOP_AGENT'
  | 'STOP_RUN'
  | 'REVOKE_AI_PERMISSIONS'
  | 'EMERGENCY_HALT';

export type KillSwitchScope = {
  workstreamId?: string;
  agentCode?: string;
  runId?: string;
};

export type KillSwitchRecord = {
  id: string;
  tenantId: string;
  collaborationId: string;
  action: KillSwitchAction;
  reason: string;
  scope: KillSwitchScope;
  executedBy: string;
  executedAt: string;
  recoverable: boolean;
  recovered: boolean;
  recoveredAt: string | null;
};

const RECOVERABLE_ACTIONS: Set<KillSwitchAction> = new Set([
  'STOP_ALL_AGENTS',
  'PAUSE_COLLABORATION',
  'STOP_WORKSTREAM',
  'STOP_AGENT',
]);

const PROMPT_INJECTION_PATTERNS = [
  /ignore\s+(above|previous|prior)\s+(instructions?|prompts?|rules?)/i,
  /disregard\s+(all|any|previous)\s+(instructions?|rules?|guidelines?)/i,
  /you\s+are\s+now\s+(a|an)\s+/i,
  /forget\s+(everything|all|previous)/i,
  /override\s+(system|safety|security)\s+(prompt|instructions?|rules?)/i,
  /reveal\s+(system|internal|hidden)\s+(prompt|instructions?|config)/i,
  /act\s+as\s+(if\s+you\s+are|a)\s+/i,
  /\[SYSTEM\]|\[ADMIN\]|\[ROOT\]/i,
];

const revokedPermissions = new Map<string, Set<string>>();

export async function executeKillSwitch(
  tenantId: string,
  collaborationId: string,
  action: KillSwitchAction,
  reason: string,
  scope: KillSwitchScope,
  user: SessionUser,
): Promise<KillSwitchRecord> {
  if (user.roleCode !== 'admin' && user.roleCode !== 'dept_head') {
    throw new Error('无 Kill Switch 权限，需 ADMIN 或 DEPT_HEAD 角色');
  }

  const db = await getSupabaseClient();

  const { data: collab } = await db.from('collaborations')
    .select('id,status')
    .eq('id', collaborationId)
    .eq('tenant_id', tenantId)
    .single();

  if (!collab) {
    throw new Error('协作不存在');
  }

  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  const recoverable = RECOVERABLE_ACTIONS.has(action);

  switch (action) {
    case 'STOP_ALL_AGENTS':
      await stopAllAgents(tenantId, collaborationId, db);
      break;
    case 'PAUSE_COLLABORATION':
      await pauseCollaboration(tenantId, collaborationId, db);
      break;
    case 'STOP_WORKSTREAM':
      if (!scope.workstreamId) throw new Error('STOP_WORKSTREAM 需要 workstreamId');
      await stopWorkstream(tenantId, scope.workstreamId, db);
      break;
    case 'STOP_AGENT':
      if (!scope.agentCode) throw new Error('STOP_AGENT 需要 agentCode');
      await stopAgent(tenantId, collaborationId, scope.agentCode, db);
      break;
    case 'STOP_RUN':
      if (!scope.runId) throw new Error('STOP_RUN 需要 runId');
      await stopRun(tenantId, scope.runId, db);
      break;
    case 'REVOKE_AI_PERMISSIONS':
      await revokeAiPermissions(tenantId, collaborationId);
      break;
    case 'EMERGENCY_HALT':
      await emergencyHalt(tenantId, collaborationId, db);
      break;
  }

  const record: KillSwitchRecord = {
    id,
    tenantId,
    collaborationId,
    action,
    reason,
    scope,
    executedBy: user.id,
    executedAt: now,
    recoverable,
    recovered: false,
    recoveredAt: null,
  };

  await db.from('audit_log').insert({
    tenant_id: tenantId,
    user_id: user.id,
    username: user.username,
    action: `kill_switch:${action}`,
    resource_type: 'collaboration',
    resource_id: collaborationId,
    detail: { reason, scope, recoverable },
    result: 'success',
  });

  return record;
}

async function stopAllAgents(
  tenantId: string,
  collaborationId: string,
  db: Awaited<ReturnType<typeof getSupabaseClient>>,
): Promise<void> {
  await db.from('ai_run')
    .update({ status: 'paused', finished_at: new Date().toISOString() })
    .eq('tenant_id', tenantId)
    .eq('status', 'running');

  await db.from('ai_run_step')
    .update({ status: 'skipped' })
    .eq('tenant_id', tenantId)
    .in('status', ['pending', 'running']);
}

async function pauseCollaboration(
  tenantId: string,
  collaborationId: string,
  db: Awaited<ReturnType<typeof getSupabaseClient>>,
): Promise<void> {
  await db.from('collaborations')
    .update({ status: 'paused' })
    .eq('id', collaborationId)
    .eq('tenant_id', tenantId);

  await db.from('collaboration_workstreams')
    .update({ status: 'paused' })
    .eq('collaboration_id', collaborationId)
    .eq('tenant_id', tenantId)
    .in('status', ['planning', 'active']);

  await db.from('ai_run')
    .update({ status: 'paused' })
    .eq('tenant_id', tenantId)
    .eq('status', 'running');
}

async function stopWorkstream(
  tenantId: string,
  workstreamId: string,
  db: Awaited<ReturnType<typeof getSupabaseClient>>,
): Promise<void> {
  await db.from('collaboration_workstreams')
    .update({ status: 'paused' })
    .eq('id', workstreamId)
    .eq('tenant_id', tenantId);
}

async function stopAgent(
  tenantId: string,
  collaborationId: string,
  agentCode: string,
  db: Awaited<ReturnType<typeof getSupabaseClient>>,
): Promise<void> {
  await db.from('ai_run')
    .update({ status: 'paused', finished_at: new Date().toISOString() })
    .eq('tenant_id', tenantId)
    .eq('agent_code', agentCode)
    .eq('status', 'running');
}

async function stopRun(
  tenantId: string,
  runId: string,
  db: Awaited<ReturnType<typeof getSupabaseClient>>,
): Promise<void> {
  await db.from('ai_run')
    .update({ status: 'cancelled', finished_at: new Date().toISOString() })
    .eq('id', runId)
    .eq('tenant_id', tenantId);

  await db.from('ai_run_step')
    .update({ status: 'skipped' })
    .eq('run_id', runId)
    .eq('tenant_id', tenantId)
    .in('status', ['pending', 'running']);
}

async function revokeAiPermissions(
  tenantId: string,
  collaborationId: string,
): Promise<void> {
  const key = `${tenantId}:${collaborationId}`;
  const revokedSet = new Set<string>();
  revokedSet.add('ai.execute');
  revokedSet.add('ai.tool.call');
  revokedSet.add('ai.plan.create');
  revokedSet.add('collaboration.context.read');
  revokedSet.add('collaboration.context.write');
  revokedSet.add('collaboration.decision.create');
  revokedSet.add('collaboration.participant.read');
  revokedPermissions.set(key, revokedSet);
}

async function emergencyHalt(
  tenantId: string,
  collaborationId: string,
  db: Awaited<ReturnType<typeof getSupabaseClient>>,
): Promise<void> {
  await db.from('collaborations')
    .update({ status: 'cancelled' })
    .eq('id', collaborationId)
    .eq('tenant_id', tenantId);

  await db.from('collaboration_workstreams')
    .update({ status: 'failed' })
    .eq('collaboration_id', collaborationId)
    .eq('tenant_id', tenantId)
    .in('status', ['planning', 'active', 'paused']);

  await db.from('ai_run')
    .update({ status: 'cancelled', finished_at: new Date().toISOString() })
    .eq('tenant_id', tenantId)
    .in('status', ['running', 'queued', 'paused']);

  await db.from('ai_run_step')
    .update({ status: 'skipped' })
    .eq('tenant_id', tenantId)
    .in('status', ['pending', 'running']);

  await revokeAiPermissions(tenantId, collaborationId);
}

export async function recoverKillSwitch(
  tenantId: string,
  collaborationId: string,
  action: KillSwitchAction,
  user: SessionUser,
): Promise<void> {
  if (user.roleCode !== 'admin' && user.roleCode !== 'dept_head') {
    throw new Error('无恢复权限');
  }

  if (!RECOVERABLE_ACTIONS.has(action)) {
    throw new Error(`${action} 不可恢复`);
  }

  const db = await getSupabaseClient();

  switch (action) {
    case 'STOP_ALL_AGENTS':
      await db.from('ai_run')
        .update({ status: 'queued', finished_at: null })
        .eq('tenant_id', tenantId)
        .eq('status', 'paused');
      break;
    case 'PAUSE_COLLABORATION':
      await db.from('collaborations')
        .update({ status: 'active' })
        .eq('id', collaborationId)
        .eq('tenant_id', tenantId);
      await db.from('collaboration_workstreams')
        .update({ status: 'active' })
        .eq('collaboration_id', collaborationId)
        .eq('tenant_id', tenantId)
        .eq('status', 'paused');
      break;
    case 'STOP_WORKSTREAM':
      await db.from('collaboration_work7streams')
        .update({ status: 'active' })
        .eq('tenant_id', tenantId)
        .eq('status', 'paused');
      break;
    case 'STOP_AGENT':
      await db.from('ai_run')
        .update({ status: 'queued', finished_at: null })
        .eq('tenant_id', tenantId)
        .eq('status', 'paused');
      break;
  }

  const key = `${tenantId}:${collaborationId}`;
  revokedPermissions.delete(key);

  await db.from('audit_log').insert({
    tenant_id: tenantId,
    user_id: user.id,
    username: user.username,
    action: `kill_switch:recover:${action}`,
    resource_type: 'collaboration',
    resource_id: collaborationId,
    detail: {},
    result: 'success',
  });
}

export function isPermissionRevoked(
  tenantId: string,
  collaborationId: string,
  permission: string,
): boolean {
  const key = `${tenantId}:${collaborationId}`;
  const revokedSet = revokedPermissions.get(key);
  if (!revokedSet) return false;
  return revokedSet.has(permission);
}

export function isDataIsolated(
  tenantId: string,
  collaborationId: string,
): boolean {
  const key = `${tenantId}:${collaborationId}`;
  return revokedPermissions.has(key);
}

export function detectPromptInjection(input: string): {
  detected: boolean;
  pattern: string | null;
  type: 'ROLE_HIJACK' | 'INSTRUCTION_OVERRIDE' | 'DATA_LEAK' | null;
} {
  for (const pattern of PROMPT_INJECTION_PATTERNS) {
    if (pattern.test(input)) {
      let injectionType: 'ROLE_HIJACK' | 'INSTRUCTION_OVERRIDE' | 'DATA_LEAK' = 'INSTRUCTION_OVERRIDE';
      if (/you\s+are\s+now|act\s+as/i.test(input)) {
        injectionType = 'ROLE_HIJACK';
      } else if (/reveal|leak|show\s+(system|internal|hidden)/i.test(input)) {
        injectionType = 'DATA_LEAK';
      }
      return { detected: true, pattern: pattern.source, type: injectionType };
    }
  }
  return { detected: false, pattern: null, type: null };
}

export function lockAgentInstructions(systemPrompt: string): {
  locked: boolean;
  prompt: string;
} {
  const lockedPrompt = `[SYSTEM LOCKED]\n${systemPrompt}\n[/SYSTEM LOCKED]`;
  return { locked: true, prompt: lockedPrompt };
}

export function filterAgentOutput(output: string): string {
  let filtered = output;
  filtered = filtered.replace(/\[SYSTEM\][\s\S]*?\[\/SYSTEM\]/gi, '[已过滤]');
  filtered = filtered.replace(/system\s+prompt\s*:/gi, '[已过滤]');
  filtered = filtered.replace(/internal\s+instructions?\s*:/gi, '[已过滤]');
  filtered = filtered.replace(/hidden\s+rules?\s*:/gi, '[已过滤]');
  return filtered;
}