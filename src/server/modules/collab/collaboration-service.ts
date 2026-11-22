import { getSupabaseClient } from '@/storage/database/supabase-client';
import { createNotification } from '@/server/platform/notification/service';

/* ============================================================
 * V2 类型定义
 * ============================================================ */

export type CollaborationType =
  | 'STRATEGIC_INITIATIVE'
  | 'PROJECT'
  | 'COMMITTEE'
  | 'TASK_FORCE'
  | 'CAMPAIGN'
  | 'RESEARCH'
  | 'REVIEW'
  | 'PLANNING'
  | 'NEGOTIATION'
  | 'INVESTIGATION'
  | 'COORDINATION'
  | 'AD_HOC';

export type CollaborationScale =
  | 'SOLO'
  | 'SMALL_TEAM'
  | 'LARGE_TEAM'
  | 'DEPARTMENT'
  | 'CROSS_DEPARTMENT'
  | 'ENTERPRISE';

export type StructureType =
  | 'FLAT'
  | 'HIERARCHICAL'
  | 'MATRIX'
  | 'NETWORK'
  | 'HYBRID';

export type CoordinatorMode =
  | 'HUMAN'
  | 'AI_ASSISTED'
  | 'AI_COORDINATED'
  | 'AUTO';

export type CollaborationStatus =
  | 'DRAFT'
  | 'PLANNING'
  | 'PENDING_CONFIRMATION'
  | 'READY'
  | 'ACTIVE'
  | 'PAUSED'
  | 'BLOCKED'
  | 'FINALIZING'
  | 'COMPLETED'
  | 'CANCELLED'
  | 'FAILED';

/* ============================================================
 * V1 兼容类型（保留向后兼容）
 * ============================================================ */

export type CollaborationRow = {
  id: string;
  tenant_id: string;
  code: string;
  title: string;
  type: string;
  scale?: string;
  structure_type?: string;
  coordinator_mode?: string;
  description: string | null;
  owner_id: string | null;
  org_unit_id: string | null;
  status: string;
  success_criteria?: string | null;
  completion_criteria?: Record<string, unknown> | null;
  coordinator_agent_id?: string | null;
  started_at?: string | null;
  completed_at?: string | null;
  created_at: string;
  updated_at: string;
};

export type CollaborationMemberRow = {
  id: string;
  tenant_id: string;
  collaboration_id: string;
  user_id: string;
  role: string;
  joined_at: string;
};

export type CollaborationFilter = {
  status?: string;
  type?: string;
  scale?: string;
  structureType?: string;
  coordinatorMode?: string;
  keyword?: string;
  memberId?: string;
  page?: number;
  pageSize?: number;
};

export type CollaborationDetail = {
  row: CollaborationRow;
  members: CollaborationMemberRow[];
  taskIds: string[];
};

export type CreateCollaborationInput = {
  title: string;
  description?: string;
  type?: CollaborationType;
  scale?: CollaborationScale;
  structureType?: StructureType;
  coordinatorMode?: CoordinatorMode;
  successCriteria?: string;
  completionCriteria?: Record<string, unknown>;
  coordinatorAgentId?: string;
  memberIds?: string[];
};

/* ============================================================
 * 状态机定义
 * ============================================================ */

const VALID_COLLAB_TRANSITIONS: Record<CollaborationStatus, CollaborationStatus[]> = {
  DRAFT: ['PLANNING', 'CANCELLED'],
  PLANNING: ['PENDING_CONFIRMATION', 'READY', 'CANCELLED'],
  PENDING_CONFIRMATION: ['READY', 'CANCELLED', 'PLANNING'],
  READY: ['ACTIVE', 'CANCELLED'],
  ACTIVE: ['PAUSED', 'BLOCKED', 'FINALIZING', 'CANCELLED', 'FAILED'],
  PAUSED: ['ACTIVE', 'CANCELLED'],
  BLOCKED: ['ACTIVE', 'CANCELLED', 'FAILED'],
  FINALIZING: ['COMPLETED', 'FAILED', 'CANCELLED'],
  COMPLETED: [],
  CANCELLED: [],
  FAILED: [],
};

function validateCollabTransition(from: CollaborationStatus, to: CollaborationStatus): boolean {
  const allowed = VALID_COLLAB_TRANSITIONS[from];
  return allowed.includes(to);
}

/* ============================================================
 * V2 CRUD 函数
 * ============================================================ */

export async function createCollaborationV2(
  tenantId: string,
  ownerId: string,
  input: CreateCollaborationInput,
): Promise<CollaborationRow> {
  const db = getSupabaseClient();
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  const code = `COL-${Date.now().toString(36).toUpperCase()}`;

  const { data, error: insertError } = await db
    .from('collaboration')
    .insert({
      id,
      tenant_id: tenantId,
      code,
      title: input.title,
      type: input.type ?? 'PROJECT',
      scale: input.scale ?? 'SMALL_TEAM',
      structure_type: input.structureType ?? 'FLAT',
      coordinator_mode: input.coordinatorMode ?? 'AI_ASSISTED',
      description: input.description ?? null,
      owner_id: ownerId,
      status: 'DRAFT',
      success_criteria: input.successCriteria ?? null,
      completion_criteria: input.completionCriteria ?? null,
      coordinator_agent_id: input.coordinatorAgentId ?? null,
      created_at: now,
      updated_at: now,
    })
    .select('*')
    .limit(1);

  if (insertError || !data?.[0]) {
    throw new Error(`创建协同事项失败: ${insertError?.message ?? '未知错误'}`);
  }

  const collaboration = data[0] as CollaborationRow;

  if (input.memberIds && input.memberIds.length > 0) {
    const memberRows = input.memberIds.map((userId) => ({
      id: crypto.randomUUID(),
      tenant_id: tenantId,
      collaboration_id: id,
      user_id: userId,
      role: 'member',
      joined_at: now,
    }));

    await db.from('collaboration_member').insert(memberRows);

    for (const userId of input.memberIds) {
      if (userId !== ownerId) {
        await createNotification(
          tenantId,
          userId,
          'system_notice',
          '加入协同事项',
          `您已被加入协同事项「${input.title}」`,
          id,
        );
      }
    }
  }

  const ownerMember = {
    id: crypto.randomUUID(),
    tenant_id: tenantId,
    collaboration_id: id,
    user_id: ownerId,
    role: 'owner',
    joined_at: now,
  };
  await db.from('collaboration_member').insert(ownerMember);

  return collaboration;
}

export async function updateCollaborationStatus(
  tenantId: string,
  collaborationId: string,
  newStatus: CollaborationStatus,
): Promise<CollaborationRow> {
  const db = getSupabaseClient();

  const { data: current } = await db
    .from('collaboration')
    .select('status,started_at')
    .eq('id', collaborationId)
    .eq('tenant_id', tenantId)
    .limit(1);

  if (!current?.[0]) {
    throw new Error(`协作不存在: ${collaborationId}`);
  }

  const currentStatus = current[0].status as CollaborationStatus;
  if (!validateCollabTransition(currentStatus, newStatus)) {
    throw new Error(`无效的状态转换: ${currentStatus} → ${newStatus}`);
  }

  const now = new Date().toISOString();
  const updateFields: Record<string, unknown> = {
    status: newStatus,
    updated_at: now,
  };

  if (newStatus === 'ACTIVE' && !current[0].started_at) {
    updateFields.started_at = now;
  }
  if (newStatus === 'COMPLETED') {
    updateFields.completed_at = now;
  }

  const { data, error } = await db
    .from('collaboration')
    .update(updateFields)
    .eq('id', collaborationId)
    .eq('tenant_id', tenantId)
    .select('*')
    .limit(1);

  if (error || !data?.[0]) {
    throw new Error(`更新协作状态失败: ${error?.message ?? '未知错误'}`);
  }

  return data[0] as CollaborationRow;
}

export async function updateCollaboration(
  tenantId: string,
  collaborationId: string,
  updates: {
    title?: string;
    description?: string;
    type?: CollaborationType;
    scale?: CollaborationScale;
    structureType?: StructureType;
    coordinatorMode?: CoordinatorMode;
    successCriteria?: string;
    completionCriteria?: Record<string, unknown>;
    coordinatorAgentId?: string;
  },
): Promise<CollaborationRow> {
  const db = getSupabaseClient();
  const now = new Date().toISOString();

  const updateFields: Record<string, unknown> = {
    updated_at: now,
  };

  if (updates.title !== undefined) updateFields.title = updates.title;
  if (updates.description !== undefined) updateFields.description = updates.description;
  if (updates.type !== undefined) updateFields.type = updates.type;
  if (updates.scale !== undefined) updateFields.scale = updates.scale;
  if (updates.structureType !== undefined) updateFields.structure_type = updates.structureType;
  if (updates.coordinatorMode !== undefined) updateFields.coordinator_mode = updates.coordinatorMode;
  if (updates.successCriteria !== undefined) updateFields.success_criteria = updates.successCriteria;
  if (updates.completionCriteria !== undefined) updateFields.completion_criteria = updates.completionCriteria;
  if (updates.coordinatorAgentId !== undefined) updateFields.coordinator_agent_id = updates.coordinatorAgentId;

  const { data, error } = await db
    .from('collaboration')
    .update(updateFields)
    .eq('id', collaborationId)
    .eq('tenant_id', tenantId)
    .select('*')
    .limit(1);

  if (error || !data?.[0]) {
    throw new Error(`更新协作失败: ${error?.message ?? '未知错误'}`);
  }

  return data[0] as CollaborationRow;
}

export function canTransitionTo(from: string, to: CollaborationStatus): boolean {
  return validateCollabTransition(from as CollaborationStatus, to);
}

export function getValidTransitions(status: CollaborationStatus): CollaborationStatus[] {
  return VALID_COLLAB_TRANSITIONS[status];
}

/* ============================================================
 * V1 兼容函数（保留向后兼容）
 * ============================================================ */

export async function createCollaboration(
  tenantId: string,
  ownerId: string,
  input: CreateCollaborationInput,
): Promise<CollaborationRow> {
  return createCollaborationV2(tenantId, ownerId, input);
}

export async function listCollaborations(
  tenantId: string,
  filter: CollaborationFilter,
): Promise<{ items: CollaborationRow[]; total: number }> {
  const db = getSupabaseClient();
  const page = filter.page ?? 1;
  const pageSize = filter.pageSize ?? 20;
  const offset = (page - 1) * pageSize;

  let query = db
    .from('collaboration')
    .select('*', { count: 'exact' })
    .eq('tenant_id', tenantId);

  if (filter.status) {
    query = query.eq('status', filter.status);
  }
  if (filter.type) {
    query = query.eq('type', filter.type);
  }
  if (filter.scale) {
    query = query.eq('scale', filter.scale);
  }
  if (filter.structureType) {
    query = query.eq('structure_type', filter.structureType);
  }
  if (filter.coordinatorMode) {
    query = query.eq('coordinator_mode', filter.coordinatorMode);
  }
  if (filter.keyword) {
    query = query.or(`title.ilike.%${filter.keyword}%,code.ilike.%${filter.keyword}%`);
  }
  if (filter.memberId) {
    const { data: memberLinks } = await db
      .from('collaboration_member')
      .select('collaboration_id')
      .eq('user_id', filter.memberId)
      .eq('tenant_id', tenantId);
    const collabIds = (memberLinks ?? []).map((m) => m.collaboration_id as string);
    if (collabIds.length === 0) {
      return { items: [], total: 0 };
    }
    query = query.in('id', collabIds);
  }

  query = query.order('updated_at', { ascending: false }).range(offset, offset + pageSize - 1);

  const { data, count } = await query;

  return {
    items: (data ?? []) as CollaborationRow[],
    total: count ?? 0,
  };
}

export async function getCollaboration(
  tenantId: string,
  collaborationId: string,
): Promise<CollaborationDetail | null> {
  const db = getSupabaseClient();

  const { data: collabData } = await db
    .from('collaboration')
    .select('*')
    .eq('id', collaborationId)
    .eq('tenant_id', tenantId)
    .limit(1);

  const row = (collabData?.[0] as CollaborationRow | undefined) ?? null;
  if (!row) return null;

  const [{ data: members }, { data: tasks }] = await Promise.all([
    db
      .from('collaboration_member')
      .select('*')
      .eq('collaboration_id', collaborationId)
      .eq('tenant_id', tenantId)
      .order('joined_at', { ascending: true }),
    db
      .from('task')
      .select('id')
      .eq('tenant_id', tenantId)
      .eq('parent_id', collaborationId)
      .is('deleted_at', null),
  ]);

  return {
    row,
    members: (members ?? []) as CollaborationMemberRow[],
    taskIds: (tasks ?? []).map((t) => t.id as string),
  };
}

export async function addMember(
  tenantId: string,
  collaborationId: string,
  userId: string,
  role: string = 'member',
): Promise<CollaborationMemberRow | null> {
  const db = getSupabaseClient();

  const { data: existing } = await db
    .from('collaboration_member')
    .select('id')
    .eq('collaboration_id', collaborationId)
    .eq('user_id', userId)
    .eq('tenant_id', tenantId)
    .limit(1);

  if (existing && existing.length > 0) {
    return null;
  }

  const id = crypto.randomUUID();
  const now = new Date().toISOString();

  const { data, error } = await db
    .from('collaboration_member')
    .insert({
      id,
      tenant_id: tenantId,
      collaboration_id: collaborationId,
      user_id: userId,
      role,
      joined_at: now,
    })
    .select('*')
    .limit(1);

  if (error || !data?.[0]) return null;

  const { data: collab } = await db
    .from('collaboration')
    .select('title')
    .eq('id', collaborationId)
    .limit(1);

  const collabTitle = collab?.[0]?.title ?? '协同事项';
  await createNotification(
    tenantId,
    userId,
    'system_notice',
    '加入协同事项',
    `您已被加入协同事项「${collabTitle}」`,
    collaborationId,
  );

  return data[0] as CollaborationMemberRow;
}

export async function removeMember(
  tenantId: string,
  collaborationId: string,
  userId: string,
): Promise<boolean> {
  const db = getSupabaseClient();

  const { error } = await db
    .from('collaboration_member')
    .delete()
    .eq('collaboration_id', collaborationId)
    .eq('user_id', userId)
    .eq('tenant_id', tenantId)
    .neq('role', 'owner');

  return !error;
}