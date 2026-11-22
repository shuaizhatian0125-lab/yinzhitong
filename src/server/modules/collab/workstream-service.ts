import { getSupabaseClient } from '@/storage/database/supabase-client';
import type { SessionUser } from '@/lib/auth';

export type WorkstreamStatus =
  | 'PLANNED'
  | 'ACTIVE'
  | 'PAUSED'
  | 'COMPLETED'
  | 'FAILED';

export type Phase = {
  id: string;
  collaborationId: string;
  name: string;
  sequence: number;
  workstreams: Workstream[];
};

export type Milestone = {
  id: string;
  workstreamId: string;
  name: string;
  checkDate: string | null;
  checkResult: MilestoneCheckResult | null;
};

export type MilestoneCheckResult = {
  goalCompletion: number;
  qualityScore: number;
  dependenciesResolved: boolean;
  passed: boolean;
  notes: string;
};

export type Workstream = {
  id: string;
  tenantId: string;
  collaborationId: string;
  name: string;
  phase: string;
  objectives: string[];
  milestone: Milestone | null;
  dependencies: string[];
  status: WorkstreamStatus;
  progress: number;
  dynamicAdjustment: DynamicAdjustment | null;
};

export type DynamicAdjustment = {
  type: 'SPLIT' | 'MERGE' | 'REPLACE' | 'DEPENDENCY_CHANGE';
  description: string;
  reason: string;
  appliedAt: string;
};

export type CreateWorkstreamInput = {
  collaborationId: string;
  name: string;
  phase: string;
  objectives: string[];
  milestone?: MilestoneInput;
  dependencies?: string[];
};

export type MilestoneInput = {
  name: string;
  checkDate?: string;
};

export type UpdateWorkstreamInput = {
  name?: string;
  phase?: string;
  objectives?: string[];
  status?: WorkstreamStatus;
  progress?: number;
  milestone?: MilestoneInput;
  dynamicAdjustment?: DynamicAdjustment;
  dependencies?: string[];
};

export type WorkstreamWithPhase = {
  workstream: Workstream;
  phase: Phase;
};

export async function createWorkstream(
  tenantId: string,
  input: CreateWorkstreamInput,
): Promise<Workstream> {
  const db = await getSupabaseClient();

  if (input.dependencies && input.dependencies.length > 0) {
    await validateDependencies(tenantId, input.collaborationId, input.dependencies, null);
  }

  const id = crypto.randomUUID();
  const milestoneData = input.milestone
    ? {
        id: crypto.randomUUID(),
        workstreamId: id,
        name: input.milestone.name,
        checkDate: input.milestone.checkDate ?? null,
        checkResult: null,
      }
    : null;

  const { data, error } = await db.from('collaboration_workstreams').insert({
    id,
    tenant_id: tenantId,
    collaboration_id: input.collaborationId,
    name: input.name,
    phase: input.phase,
    objectives: input.objectives,
    milestone: milestoneData,
    dependencies: input.dependencies ?? [],
    status: 'PLANNED',
    progress: 0,
    dynamic_adjustment: null,
  }).select('*').limit(1);

  if (error || !data?.[0]) {
    throw new Error(`创建 Workstream 失败: ${error?.message ?? '未知错误'}`);
  }

  const row = data[0] as Record<string, unknown>;
  return mapRowToWorkstream(row);
}

export async function listWorkstreams(
  tenantId: string,
  collaborationId: string,
): Promise<{ workstreams: Workstream[]; phases: Phase[] }> {
  const db = await getSupabaseClient();

  const { data } = await db.from('collaboration_workstreams')
    .select('*')
    .eq('collaboration_id', collaborationId)
    .eq('tenant_id', tenantId)
    .order('phase');

  const workstreams: Workstream[] = (data ?? []).map(row => mapRowToWorkstream(row as Record<string, unknown>));

  const phaseMap = new Map<string, Phase>();
  for (const ws of workstreams) {
    if (!phaseMap.has(ws.phase)) {
      phaseMap.set(ws.phase, {
        id: crypto.randomUUID(),
        collaborationId,
        name: ws.phase,
        sequence: phaseMap.size,
        workstreams: [],
      });
    }
    phaseMap.get(ws.phase)!.workstreams.push(ws);
  }

  return {
    workstreams,
    phases: Array.from(phaseMap.values()),
  };
}

export async function getWorkstream(
  tenantId: string,
  workstreamId: string,
): Promise<Workstream | null> {
  const db = await getSupabaseClient();
  const { data } = await db.from('collaboration_workstreams')
    .select('*')
    .eq('id', workstreamId)
    .eq('tenant_id', tenantId)
    .limit(1);

  if (!data?.[0]) return null;
  return mapRowToWorkstream(data[0] as Record<string, unknown>);
}

export async function updateWorkstream(
  tenantId: string,
  workstreamId: string,
  patch: UpdateWorkstreamInput,
): Promise<Workstream> {
  const db = await getSupabaseClient();

  const { data: existing } = await db.from('collaboration_workstreams')
    .select('*')
    .eq('id', workstreamId)
    .eq('tenant_id', tenantId)
    .single();

  if (!existing) {
    throw new Error('Workstream 不存在');
  }

  const updates: Record<string, unknown> = {};

  if (patch.name !== undefined) updates.name = patch.name;
  if (patch.phase !== undefined) updates.phase = patch.phase;
  if (patch.objectives !== undefined) updates.objectives = patch.objectives;
  if (patch.status !== undefined) updates.status = patch.status.toLowerCase();
  if (patch.progress !== undefined) updates.progress = patch.progress;
  if (patch.dependencies !== undefined) {
    await validateDependencies(tenantId, existing.collaboration_id as string, patch.dependencies, workstreamId);
    updates.dependencies = patch.dependencies;
  }
  if (patch.dynamicAdjustment !== undefined) {
    updates.dynamic_adjustment = {
      ...patch.dynamicAdjustment,
      appliedAt: new Date().toISOString(),
    };
  }
  if (patch.milestone !== undefined) {
    const existingMilestone = existing.milestone as Record<string, unknown> | null;
    updates.milestone = {
      id: existingMilestone?.id ?? crypto.randomUUID(),
      workstreamId,
      name: patch.milestone.name,
      checkDate: patch.milestone.checkDate ?? existingMilestone?.checkDate ?? null,
      checkResult: existingMilestone?.checkResult ?? null,
    };
  }

  const { data, error } = await db.from('collaboration_workstreams')
    .update(updates)
    .eq('id', workstreamId)
    .eq('tenant_id', tenantId)
    .select('*')
    .limit(1);

  if (error || !data?.[0]) {
    throw new Error(`更新 Workstream 失败: ${error?.message ?? '未知错误'}`);
  }

  const updated = mapRowToWorkstream(data[0] as Record<string, unknown>);

  if (patch.status === 'COMPLETED' || (patch.progress !== undefined && patch.progress >= 100)) {
    await checkMilestone(tenantId, updated);
  }

  return updated;
}

export async function deleteWorkstream(
  tenantId: string,
  workstreamId: string,
): Promise<void> {
  const db = await getSupabaseClient();

  const { data: dependents } = await db.from('collaboration_workstreams')
    .select('id,name')
    .contains('dependencies', [workstreamId])
    .eq('tenant_id', tenantId);

  if (dependents && dependents.length > 0) {
    const names = dependents.map((d: Record<string, unknown>) => d.name as string).join(', ');
    throw new Error(`无法删除：以下 Workstream 依赖此项: ${names}`);
  }

  await db.from('collaboration_workstreams')
    .delete()
    .eq('id', workstreamId)
    .eq('tenant_id', tenantId);
}

export async function checkMilestone(
  tenantId: string,
  workstream: Workstream,
): Promise<MilestoneCheckResult | null> {
  if (!workstream.milestone) return null;

  const db = await getSupabaseClient();

  const { data: allWorkstreams } = await db.from('collaboration_workstreams')
    .select('id,status,progress')
    .eq('collaboration_id', workstream.collaborationId)
    .eq('tenant_id', tenantId);

  const depsResolved = workstream.dependencies.every(depId => {
    const dep = (allWorkstreams ?? []).find((w: Record<string, unknown>) => w.id === depId);
    return dep && (dep.status === 'completed' || dep.progress === 100);
  });

  const result: MilestoneCheckResult = {
    goalCompletion: workstream.progress,
    qualityScore: workstream.progress >= 80 ? 80 : 50,
    dependenciesResolved: depsResolved,
    passed: workstream.progress >= 80 && depsResolved,
    notes: workstream.progress >= 80
      ? (depsResolved ? '里程碑检查通过' : '依赖未完成，里程碑检查未通过')
      : `进度不足 (${workstream.progress}%)，里程碑检查未通过`,
  };

  const updatedMilestone: Milestone = {
    ...workstream.milestone,
    checkResult: result,
    checkDate: new Date().toISOString(),
  };

  await db.from('collaboration_workstreams')
    .update({ milestone: updatedMilestone })
    .eq('id', workstream.id)
    .eq('tenant_id', tenantId);

  return result;
}

export async function splitWorkstream(
  tenantId: string,
  workstreamId: string,
  splitNames: string[],
  user: SessionUser,
): Promise<Workstream[]> {
  const db = await getSupabaseClient();

  const original = await getWorkstream(tenantId, workstreamId);
  if (!original) {
    throw new Error('Workstream 不存在');
  }

  const created: Workstream[] = [];
  for (const name of splitNames) {
    const ws = await createWorkstream(tenantId, {
      collaborationId: original.collaborationId,
      name,
      phase: original.phase,
      objectives: original.objectives,
      dependencies: original.dependencies,
    });
    created.push(ws);
  }

  await updateWorkstream(tenantId, workstreamId, {
    status: 'COMPLETED',
    dynamicAdjustment: {
      type: 'SPLIT',
      description: `拆分为: ${splitNames.join(', ')}`,
      reason: 'Workstream 过大，拆分为多个独立工作线',
      appliedAt: new Date().toISOString(),
    },
  });

  return created;
}

export async function mergeWorkstreams(
  tenantId: string,
  workstreamIds: string[],
  mergedName: string,
  user: SessionUser,
): Promise<Workstream> {
  const db = await getSupabaseClient();

  const workstreams: Workstream[] = [];
  for (const id of workstreamIds) {
    const ws = await getWorkstream(tenantId, id);
    if (ws) workstreams.push(ws);
  }

  if (workstreams.length < 2) {
    throw new Error('合并至少需要 2 个 Workstream');
  }

  const collaborationId = workstreams[0].collaborationId;
  const allObjectives = workstreams.flatMap(ws => ws.objectives);
  const allDeps = Array.from(new Set(workstreams.flatMap(ws => ws.dependencies)));

  const merged = await createWorkstream(tenantId, {
    collaborationId,
    name: mergedName,
    phase: workstreams[0].phase,
    objectives: allObjectives,
    dependencies: allDeps,
  });

  for (const ws of workstreams) {
    await updateWorkstream(tenantId, ws.id, {
      status: 'COMPLETED',
      dynamicAdjustment: {
        type: 'MERGE',
        description: `合并为: ${mergedName}`,
        reason: 'Workstream 过小，合并以提升效率',
        appliedAt: new Date().toISOString(),
      },
    });
  }

  return merged;
}

async function validateDependencies(
  tenantId: string,
  collaborationId: string,
  dependencies: string[],
  currentWorkstreamId: string | null,
): Promise<void> {
  const db = await getSupabaseClient();

  const { data: allWorkstreams } = await db.from('collaboration_workstreams')
    .select('id,name,dependencies')
    .eq('collaboration_id', collaborationId)
    .eq('tenant_id', tenantId);

  const wsMap = new Map<string, Record<string, unknown>>();
  for (const ws of allWorkstreams ?? []) {
    wsMap.set(ws.id as string, ws as Record<string, unknown>);
  }

  for (const depId of dependencies) {
    if (depId === currentWorkstreamId) {
      throw new Error('Workstream 不能依赖自身');
    }
    if (!wsMap.has(depId)) {
      throw new Error(`依赖的 Workstream ${depId} 不存在`);
    }
  }

  if (currentWorkstreamId) {
    const visited = new Set<string>();
    const hasCycle = detectCycle(currentWorkstreamId, wsMap, visited, dependencies);
    if (hasCycle) {
      throw new Error('依赖关系存在循环');
    }
  }
}

function detectCycle(
  workstreamId: string,
  wsMap: Map<string, Record<string, unknown>>,
  visited: Set<string>,
  newDependencies: string[],
): boolean {
  if (visited.has(workstreamId)) {
    return true;
  }
  visited.add(workstreamId);

  const deps = newDependencies;
  for (const depId of deps) {
    const depWs = wsMap.get(depId);
    if (!depWs) continue;
    const depDeps = (depWs.dependencies as string[]) ?? [];
    if (detectCycle(depId, wsMap, new Set(visited), depDeps)) {
      return true;
    }
  }

  return false;
}

function mapRowToWorkstream(row: Record<string, unknown>): Workstream {
  const milestoneData = row.milestone as Record<string, unknown> | null;
  const milestone: Milestone | null = milestoneData
    ? {
        id: milestoneData.id as string,
        workstreamId: milestoneData.workstreamId as string,
        name: milestoneData.name as string,
        checkDate: milestoneData.checkDate as string | null,
        checkResult: milestoneData.checkResult as MilestoneCheckResult | null,
      }
    : null;

  const adjustmentData = row.dynamic_adjustment as Record<string, unknown> | null;
  const dynamicAdjustment: DynamicAdjustment | null = adjustmentData
    ? {
        type: adjustmentData.type as 'SPLIT' | 'MERGE' | 'REPLACE' | 'DEPENDENCY_CHANGE',
        description: adjustmentData.description as string,
        reason: adjustmentData.reason as string,
        appliedAt: adjustmentData.appliedAt as string,
      }
    : null;

  return {
    id: row.id as string,
    tenantId: row.tenant_id as string,
    collaborationId: row.collaboration_id as string,
    name: row.name as string,
    phase: row.phase as string,
    objectives: (row.objectives as string[]) ?? [],
    milestone,
    dependencies: (row.dependencies as string[]) ?? [],
    status: (row.status as string).toUpperCase() as WorkstreamStatus,
    progress: row.progress as number,
    dynamicAdjustment,
  };
}