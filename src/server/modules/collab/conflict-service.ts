import { getSupabaseClient } from '@/storage/database/supabase-client';
import type { SessionUser } from '@/lib/auth';

export type ConflictType =
  | 'DATA_CONFLICT'
  | 'OPINION_CONFLICT'
  | 'RESOURCE_CONFLICT'
  | 'PRIORITY_CONFLICT'
  | 'SCOPE_CONFLICT'
  | 'PROCESS_CONFLICT'
  | 'TECHNICAL_CONFLICT'
  | 'SCHEDULE_CONFLICT'
  | 'BUDGET_CONFLICT'
  | 'GOAL_CONFLICT';

export type ConflictStatus =
  | 'DETECTED'
  | 'ANALYZING'
  | 'RESOLVING'
  | 'RESOLVED'
  | 'ESCALATED';

export type ConflictSeverity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export type Conflict = {
  id: string;
  tenantId: string;
  collaborationId: string;
  type: ConflictType;
  description: string;
  contextIds: string[];
  severity: ConflictSeverity;
  status: ConflictStatus;
  resolution: string | null;
  resolvedBy: string | null;
  resolvedAt: string | null;
  aiAnalysis: ConflictAiAnalysis | null;
  createdAt: string;
};

export type ConflictAiAnalysis = {
  differencePoints: string[];
  impactScope: string;
  recommendedOptions: ConflictResolutionOption[];
  autoResolvable: boolean;
};

export type ConflictResolutionOption = {
  description: string;
  feasibility: 'HIGH' | 'MEDIUM' | 'LOW';
  impactOnGoal: 'POSITIVE' | 'NEUTRAL' | 'NEGATIVE';
};

const AUTO_RESOLVABLE_TYPES: Set<ConflictType> = new Set([
  'RESOURCE_CONFLICT',
  'SCHEDULE_CONFLICT',
]);

const HIGH_SEVERITY_TYPES: Set<ConflictType> = new Set([
  'GOAL_CONFLICT',
  'SCOPE_CONFLICT',
  'BUDGET_CONFLICT',
]);

export async function createConflict(
  tenantId: string,
  collaborationId: string,
  type: ConflictType,
  description: string,
  contextIds: string[],
  severity?: ConflictSeverity,
): Promise<Conflict> {
  const db = await getSupabaseClient();

  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  const conflictSeverity = severity ?? (HIGH_SEVERITY_TYPES.has(type) ? 'HIGH' : 'MEDIUM');

  const { data, error } = await db.from('collaboration_conflicts').insert({
    id,
    tenant_id: tenantId,
    collaboration_id: collaborationId,
    type,
    description,
    context_ids: contextIds,
    severity: conflictSeverity.toLowerCase(),
    status: 'open',
    resolution: null,
    resolved_by: null,
    resolved_at: null,
  }).select('*').limit(1);

  if (error || !data?.[0]) {
    throw new Error(`创建冲突记录失败: ${error?.message ?? '未知错误'}`);
  }

  return mapRowToConflict(data[0] as Record<string, unknown>);
}

export async function getConflict(
  tenantId: string,
  conflictId: string,
): Promise<Conflict | null> {
  const db = await getSupabaseClient();
  const { data } = await db.from('collaboration_conflicts')
    .select('*')
    .eq('id', conflictId)
    .eq('tenant_id', tenantId)
    .limit(1);

  if (!data?.[0]) return null;
  return mapRowToConflict(data[0] as Record<string, unknown>);
}

export async function listConflicts(
  tenantId: string,
  collaborationId: string,
  filter?: { status?: ConflictStatus; type?: ConflictType; severity?: ConflictSeverity },
): Promise<Conflict[]> {
  const db = await getSupabaseClient();

  let query = db.from('collaboration_conflicts')
    .select('*')
    .eq('collaboration_id', collaborationId)
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false });

  if (filter?.status) {
    query = query.eq('status', filter.status.toLowerCase());
  }
  if (filter?.type) {
    query = query.eq('type', filter.type);
  }
  if (filter?.severity) {
    query = query.eq('severity', filter.severity.toLowerCase());
  }

  const { data } = await query;
  return (data ?? []).map(row => mapRowToConflict(row as Record<string, unknown>));
}

export async function analyzeConflict(
  tenantId: string,
  conflictId: string,
  aiAnalysis: ConflictAiAnalysis,
): Promise<Conflict> {
  const db = await getSupabaseClient();

  const { data: existing } = await db.from('collaboration_conflicts')
    .select('status')
    .eq('id', conflictId)
    .eq('tenant_id', tenantId)
    .single();

  if (!existing) {
    throw new Error('冲突不存在');
  }

  if (existing.status !== 'open' && existing.status !== 'detected') {
    throw new Error('当前状态不允许分析');
  }

  await db.from('collaboration_conflicts')
    .update({
      status: 'analyzing',
    })
    .eq('id', conflictId)
    .eq('tenant_id', tenantId);

  if (aiAnalysis.autoResolvable && AUTO_RESOLVABLE_TYPES.has(
    (await getConflict(tenantId, conflictId))!.type
  )) {
    return autoResolveConflict(tenantId, conflictId, aiAnalysis);
  }

  await db.from('collaboration_conflicts')
    .update({
      status: 'resolving',
    })
    .eq('id', conflictId)
    .eq('tenant_id', tenantId);

  const { data } = await db.from('collaboration_conflicts')
    .select('*')
    .eq('id', conflictId)
    .eq('tenant_id', tenantId)
    .limit(1);

  return mapRowToConflict(data![0] as Record<string, unknown>);
}

async function autoResolveConflict(
  tenantId: string,
  conflictId: string,
  aiAnalysis: ConflictAiAnalysis,
): Promise<Conflict> {
  const db = await getSupabaseClient();

  const bestOption = aiAnalysis.recommendedOptions.find(
    o => o.feasibility === 'HIGH' && o.impactOnGoal !== 'NEGATIVE'
  ) ?? aiAnalysis.recommendedOptions[0];

  const resolution = bestOption
    ? `AI 自动解决: ${bestOption.description}`
    : 'AI 自动解决: 采用折中方案';

  await db.from('collaboration_conflicts')
    .update({
      status: 'resolved',
      resolution,
      resolved_by: 'AI_COORDINATOR',
      resolved_at: new Date().toISOString(),
    })
    .eq('id', conflictId)
    .eq('tenant_id', tenantId);

  const { data } = await db.from('collaboration_conflicts')
    .select('*')
    .eq('id', conflictId)
    .eq('tenant_id', tenantId)
    .limit(1);

  return mapRowToConflict(data![0] as Record<string, unknown>);
}

export async function resolveConflict(
  tenantId: string,
  conflictId: string,
  resolution: string,
  user: SessionUser,
): Promise<Conflict> {
  const db = await getSupabaseClient();

  const { data: existing } = await db.from('collaboration_conflicts')
    .select('status')
    .eq('id', conflictId)
    .eq('tenant_id', tenantId)
    .single();

  if (!existing) {
    throw new Error('冲突不存在');
  }

  if (existing.status === 'resolved') {
    throw new Error('冲突已解决');
  }

  await db.from('collaboration_conflicts')
    .update({
      status: 'resolved',
      resolution,
      resolved_by: user.id,
      resolved_at: new Date().toISOString(),
    })
    .eq('id', conflictId)
    .eq('tenant_id', tenantId);

  const { data } = await db.from('collaboration_conflicts')
    .select('*')
    .eq('id', conflictId)
    .eq('tenant_id', tenantId)
    .limit(1);

  return mapRowToConflict(data![0] as Record<string, unknown>);
}

export async function escalateConflict(
  tenantId: string,
  conflictId: string,
  reason: string,
): Promise<Conflict> {
  const db = await getSupabaseClient();

  const { data: existing } = await db.from('collaboration_conflicts')
    .select('status')
    .eq('id', conflictId)
    .eq('tenant_id', tenantId)
    .single();

  if (!existing) {
    throw new Error('冲突不存在');
  }

  if (existing.status === 'resolved') {
    throw new Error('冲突已解决，不可升级');
  }

  await db.from('collaboration_conflicts')
    .update({
      status: 'escalated',
      resolution: `升级原因: ${reason}`,
    })
    .eq('id', conflictId)
    .eq('tenant_id', tenantId);

  const { data } = await db.from('collaboration_conflicts')
    .select('*')
    .eq('id', conflictId)
    .eq('tenant_id', tenantId)
    .limit(1);

  return mapRowToConflict(data![0] as Record<string, unknown>);
}

export async function detectConflictsFromContext(
  tenantId: string,
  collaborationId: string,
): Promise<Conflict[]> {
  const db = await getSupabaseClient();

  const { data: contexts } = await db.from('collaboration_context')
    .select('id,context_type,content,status')
    .eq('collaboration_id', collaborationId)
    .eq('tenant_id', tenantId)
    .eq('status', 'CONFLICT');

  const conflicts: Conflict[] = [];

  if (contexts && contexts.length > 0) {
    const { data: existingConflicts } = await db.from('collaboration_conflicts')
      .select('context_ids')
      .eq('collaboration_id', collaborationId)
      .eq('tenant_id', tenantId)
      .in('status', ['open', 'analyzing', 'resolving']);

    const existingContextIdPairs = new Set<string>();
    for (const ec of existingConflicts ?? []) {
      const ids = (ec.context_ids as string[]) ?? [];
      if (ids.length >= 2) {
        existingContextIdPairs.add(`${ids[0]}:${ids[1]}`);
      }
    }

    const conflictContexts = contexts as Record<string, unknown>[];
    for (let i = 0; i < conflictContexts.length; i++) {
      for (let j = i + 1; j < conflictContexts.length; j++) {
        const pairKey = `${conflictContexts[i].id}:${conflictContexts[j].id}`;
        if (!existingContextIdPairs.has(pairKey)) {
          const conflict = await createConflict(
            tenantId,
            collaborationId,
            'DATA_CONFLICT',
            `${conflictContexts[i].context_type} 类型 Context 存在矛盾`,
            [conflictContexts[i].id as string, conflictContexts[j].id as string],
            conflictContexts[i].context_type === 'FACT' ? 'HIGH' : 'MEDIUM',
          );
          conflicts.push(conflict);
        }
      }
    }
  }

  return conflicts;
}

function mapRowToConflict(row: Record<string, unknown>): Conflict {
  const severity = (row.severity as string)?.toUpperCase() as ConflictSeverity;
  const status = (row.status as string)?.toUpperCase() as ConflictStatus;

  return {
    id: row.id as string,
    tenantId: row.tenant_id as string,
    collaborationId: row.collaboration_id as string,
    type: row.type as ConflictType,
    description: row.description as string,
    contextIds: (row.context_ids as string[]) ?? [],
    severity,
    status,
    resolution: row.resolution as string | null,
    resolvedBy: row.resolved_by as string | null,
    resolvedAt: row.resolved_at as string | null,
    aiAnalysis: null,
    createdAt: row.created_at as string,
  };
}