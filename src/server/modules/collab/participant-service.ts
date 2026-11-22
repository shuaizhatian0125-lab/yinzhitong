import { getSupabaseClient } from '@/storage/database/supabase-client';
import { createNotification } from '@/server/platform/notification/service';

/* ============================================================
 * V2 类型定义
 * ============================================================ */

export type ParticipantType =
  | 'USER'
  | 'AGENT'
  | 'DEPARTMENT'
  | 'TEAM'
  | 'SYSTEM'
  | 'EXTERNAL'
  | 'SERVICE';

export type ParticipantRole =
  | 'SPONSOR'
  | 'OWNER'
  | 'COORDINATOR'
  | 'EXECUTOR'
  | 'EXPERT'
  | 'ANALYST'
  | 'RESEARCHER'
  | 'REVIEWER'
  | 'APPROVER'
  | 'OBSERVER'
  | 'ADVISOR'
  | 'SYSTEM_OPERATOR';

export type ParticipantStatus =
  | 'invited'
  | 'active'
  | 'inactive'
  | 'removed';

export type Participant = {
  id: string;
  tenantId: string;
  collaborationId: string;
  participantType: ParticipantType;
  nativeEntityId: string;
  role: ParticipantRole;
  permissions: string[];
  status: ParticipantStatus;
  joinedAt: string;
};

export type AddParticipantInput = {
  participantType: ParticipantType;
  nativeEntityId: string;
  role: ParticipantRole;
  permissions?: string[];
};

export type ParticipantFilter = {
  collaborationId?: string;
  participantType?: ParticipantType;
  role?: ParticipantRole;
  status?: ParticipantStatus;
  nativeEntityId?: string;
};

/* ============================================================
 * 角色权限映射
 * ============================================================ */

const ROLE_PERMISSIONS: Record<ParticipantRole, string[]> = {
  SPONSOR: ['collaboration.view', 'collaboration.manage'],
  OWNER: ['collaboration.view', 'collaboration.manage', 'participant.manage', 'task.create', 'task.assign', 'plan.modify', 'decision.create', 'deliverable.submit'],
  COORDINATOR: ['collaboration.view', 'task.create', 'task.assign', 'plan.modify', 'decision.create', 'conflict.resolve'],
  EXECUTOR: ['collaboration.view', 'task.execute', 'deliverable.submit'],
  EXPERT: ['collaboration.view', 'task.execute', 'deliverable.review'],
  ANALYST: ['collaboration.view', 'task.execute', 'analytics.view'],
  RESEARCHER: ['collaboration.view', 'task.execute', 'knowledge.search'],
  REVIEWER: ['collaboration.view', 'deliverable.review', 'decision.review'],
  APPROVER: ['collaboration.view', 'decision.approve', 'deliverable.approve'],
  OBSERVER: ['collaboration.view'],
  ADVISOR: ['collaboration.view', 'task.execute', 'plan.review'],
  SYSTEM_OPERATOR: ['collaboration.view', 'task.execute', 'workflow.trigger'],
};

const ROLE_DESCRIPTIONS: Record<ParticipantRole, string> = {
  SPONSOR: '发起人',
  OWNER: '负责人',
  COORDINATOR: '协调者',
  EXECUTOR: '执行者',
  EXPERT: '专家',
  ANALYST: '分析人员',
  RESEARCHER: '研究人员',
  REVIEWER: '审核人员',
  APPROVER: '审批人',
  OBSERVER: '观察者',
  ADVISOR: '顾问',
  SYSTEM_OPERATOR: '系统操作主体',
};

const PARTICIPANT_TYPE_DESCRIPTIONS: Record<ParticipantType, string> = {
  USER: '人员',
  AGENT: 'AI智能体',
  DEPARTMENT: '部门',
  TEAM: '团队',
  SYSTEM: '系统',
  EXTERNAL: '外部专家',
  SERVICE: '服务',
};

/* ============================================================
 * CRUD 函数
 * ============================================================ */

export async function addParticipant(
  tenantId: string,
  collaborationId: string,
  input: AddParticipantInput,
): Promise<Participant> {
  const db = getSupabaseClient();

  const { data: existing } = await db
    .from('collaboration_participants')
    .select('id')
    .eq('collaboration_id', collaborationId)
    .eq('participant_type', input.participantType)
    .eq('native_entity_id', input.nativeEntityId)
    .eq('tenant_id', tenantId)
    .limit(1);

  if (existing && existing.length > 0) {
    throw new Error('参与者已存在');
  }

  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  const permissions = input.permissions ?? ROLE_PERMISSIONS[input.role];

  const { data, error } = await db
    .from('collaboration_participants')
    .insert({
      id,
      tenant_id: tenantId,
      collaboration_id: collaborationId,
      participant_type: input.participantType,
      native_entity_id: input.nativeEntityId,
      role: input.role,
      permissions,
      status: 'invited',
      joined_at: now,
    })
    .select('*')
    .limit(1);

  if (error || !data?.[0]) {
    throw new Error(`添加参与者失败: ${error?.message ?? '未知错误'}`);
  }

  if (input.participantType === 'USER') {
    const { data: collab } = await db
      .from('collaboration')
      .select('title')
      .eq('id', collaborationId)
      .limit(1);

    const collabTitle = collab?.[0]?.title ?? '协同事项';
    await createNotification(
      tenantId,
      input.nativeEntityId,
      'system_notice',
      '加入协同事项',
      `您已被邀请加入协同事项「${collabTitle}」，角色：${ROLE_DESCRIPTIONS[input.role]}`,
      collaborationId,
    );
  }

  return mapRowToParticipant(data[0]);
}

export async function removeParticipant(
  tenantId: string,
  collaborationId: string,
  participantId: string,
): Promise<boolean> {
  const db = getSupabaseClient();

  const { data: participant } = await db
    .from('collaboration_participants')
    .select('role')
    .eq('id', participantId)
    .eq('collaboration_id', collaborationId)
    .eq('tenant_id', tenantId)
    .limit(1);

  if (!participant?.[0]) return false;

  if (participant[0].role === 'OWNER') {
    throw new Error('不能移除负责人');
  }

  const { error } = await db
    .from('collaboration_participants')
    .update({ status: 'removed' })
    .eq('id', participantId)
    .eq('collaboration_id', collaborationId)
    .eq('tenant_id', tenantId);

  return !error;
}

export async function updateParticipantRole(
  tenantId: string,
  collaborationId: string,
  participantId: string,
  newRole: ParticipantRole,
): Promise<Participant> {
  const db = getSupabaseClient();

  const permissions = ROLE_PERMISSIONS[newRole];

  const { data, error } = await db
    .from('collaboration_participants')
    .update({ role: newRole, permissions })
    .eq('id', participantId)
    .eq('collaboration_id', collaborationId)
    .eq('tenant_id', tenantId)
    .select('*')
    .limit(1);

  if (error || !data?.[0]) {
    throw new Error(`更新参与者角色失败: ${error?.message ?? '未知错误'}`);
  }

  return mapRowToParticipant(data[0]);
}

export async function activateParticipant(
  tenantId: string,
  collaborationId: string,
  participantId: string,
): Promise<Participant> {
  const db = getSupabaseClient();

  const { data, error } = await db
    .from('collaboration_participants')
    .update({ status: 'active' })
    .eq('id', participantId)
    .eq('collaboration_id', collaborationId)
    .eq('tenant_id', tenantId)
    .select('*')
    .limit(1);

  if (error || !data?.[0]) {
    throw new Error(`激活参与者失败: ${error?.message ?? '未知错误'}`);
  }

  return mapRowToParticipant(data[0]);
}

export async function deactivateParticipant(
  tenantId: string,
  collaborationId: string,
  participantId: string,
): Promise<Participant> {
  const db = getSupabaseClient();

  const { data, error } = await db
    .from('collaboration_participants')
    .update({ status: 'inactive' })
    .eq('id', participantId)
    .eq('collaboration_id', collaborationId)
    .eq('tenant_id', tenantId)
    .select('*')
    .limit(1);

  if (error || !data?.[0]) {
    throw new Error(`停用参与者失败: ${error?.message ?? '未知错误'}`);
  }

  return mapRowToParticipant(data[0]);
}

export async function listParticipants(
  tenantId: string,
  filter: ParticipantFilter,
): Promise<Participant[]> {
  const db = getSupabaseClient();

  let query = db
    .from('collaboration_participants')
    .select('*')
    .eq('tenant_id', tenantId);

  if (filter.collaborationId) {
    query = query.eq('collaboration_id', filter.collaborationId);
  }
  if (filter.participantType) {
    query = query.eq('participant_type', filter.participantType);
  }
  if (filter.role) {
    query = query.eq('role', filter.role);
  }
  if (filter.status) {
    query = query.eq('status', filter.status);
  }
  if (filter.nativeEntityId) {
    query = query.eq('native_entity_id', filter.nativeEntityId);
  }

  query = query.order('joined_at', { ascending: true });

  const { data } = await query;

  return (data ?? []).map(mapRowToParticipant);
}

export async function getParticipantsByCollaboration(
  tenantId: string,
  collaborationId: string,
): Promise<Participant[]> {
  return listParticipants(tenantId, { collaborationId, status: 'active' });
}

export async function getParticipantById(
  tenantId: string,
  participantId: string,
): Promise<Participant | null> {
  const db = getSupabaseClient();

  const { data } = await db
    .from('collaboration_participants')
    .select('*')
    .eq('id', participantId)
    .eq('tenant_id', tenantId)
    .limit(1);

  if (!data?.[0]) return null;

  return mapRowToParticipant(data[0]);
}

export function getRolePermissions(role: ParticipantRole): string[] {
  return ROLE_PERMISSIONS[role];
}

export function getRoleDescription(role: ParticipantRole): string {
  return ROLE_DESCRIPTIONS[role];
}

export function getParticipantTypeDescription(type: ParticipantType): string {
  return PARTICIPANT_TYPE_DESCRIPTIONS[type];
}

export function hasPermission(participant: Participant, permission: string): boolean {
  return participant.permissions.includes('*') || participant.permissions.includes(permission);
}

/* ============================================================
 * 内部工具函数
 * ============================================================ */

function mapRowToParticipant(row: Record<string, unknown>): Participant {
  return {
    id: row.id as string,
    tenantId: row.tenant_id as string,
    collaborationId: row.collaboration_id as string,
    participantType: row.participant_type as ParticipantType,
    nativeEntityId: row.native_entity_id as string,
    role: row.role as ParticipantRole,
    permissions: (row.permissions as string[]) ?? [],
    status: row.status as ParticipantStatus,
    joinedAt: row.joined_at as string,
  };
}