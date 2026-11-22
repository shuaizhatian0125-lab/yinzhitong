import { randomUUID } from 'node:crypto';
import { getSupabaseClient } from '@/storage/database/supabase-client';
import type { SessionUser } from '@/lib/auth';

export const TASK_STATUS = {
  draft: { label: '草稿', tone: 'gray' },
  pending: { label: '待处理', tone: 'blue' },
  in_progress: { label: '进行中', tone: 'blue' },
  blocked: { label: '受阻', tone: 'danger' },
  done: { label: '已完成', tone: 'ok' },
  cancelled: { label: '已取消', tone: 'gray' },
} as const;

export type TaskStatus = keyof typeof TASK_STATUS;

export const STATUS_FLOW: Record<TaskStatus, TaskStatus[]> = {
  draft: ['pending', 'cancelled'],
  pending: ['in_progress', 'cancelled'],
  in_progress: ['blocked', 'done', 'cancelled'],
  blocked: ['in_progress', 'cancelled'],
  done: ['in_progress'],
  cancelled: [],
};

export type Task = {
  id: string;
  code: string;
  title: string;
  description: string | null;
  module: string;
  priority: string;
  status: TaskStatus;
  ownerId: string;
  assigneeId: string | null;
  assigneeName: string | null;
  orgUnitId: string | null;
  parentId: string | null;
  tags: string[];
  dueAt: string | null;
  progress: number;
  source: string;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
};

export type TaskEvent = {
  id: number;
  action: string;
  fromStatus: string | null;
  toStatus: string | null;
  note: string | null;
  actorName: string | null;
  createdAt: string;
};

type Row = Record<string, unknown>;

function toTask(row: Row, names: Map<string, string>): Task {
  return {
    id: row.id as string,
    code: row.code as string,
    title: row.title as string,
    description: (row.description as string) ?? null,
    module: (row.module as string) ?? 'general',
    priority: (row.priority as string) ?? 'P2',
    status: (row.status as TaskStatus) ?? 'draft',
    ownerId: row.owner_id as string,
    assigneeId: (row.assignee_id as string) ?? null,
    assigneeName: row.assignee_id ? (names.get(row.assignee_id as string) ?? null) : null,
    orgUnitId: (row.org_unit_id as string) ?? null,
    parentId: (row.parent_id as string) ?? null,
    tags: (row.tags as string[]) ?? [],
    dueAt: (row.due_at as string) ?? null,
    progress: (row.progress as number) ?? 0,
    source: (row.source as string) ?? 'manual',
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
    completedAt: (row.completed_at as string) ?? null,
  };
}

/** 数据范围：把角色数据范围翻译成可见的组织集合 */
export async function resolveScope(user: SessionUser): Promise<{ all: boolean; orgIds: string[] }> {
  if (user.dataScope === 'all') return { all: true, orgIds: [] };
  const db = await getSupabaseClient();
  const { data } = await db
    .from('org_unit')
    .select('id,parent_id')
    .eq('tenant_id', user.tenantId);

  const rows = (data ?? []) as { id: string; parent_id: string | null }[];
  if (user.dataScope === 'org_tree' && user.orgUnitId) {
    const children = new Map<string, string[]>();
    rows.forEach((r) => {
      if (!r.parent_id) return;
      const list = children.get(r.parent_id) ?? [];
      list.push(r.id);
      children.set(r.parent_id, list);
    });
    const ids = new Set<string>([user.orgUnitId]);
    const stack = [user.orgUnitId];
    while (stack.length) {
      const current = stack.pop()!;
      (children.get(current) ?? []).forEach((c) => {
        if (!ids.has(c)) {
          ids.add(c);
          stack.push(c);
        }
      });
    }
    return { all: false, orgIds: [...ids] };
  }
  if (user.dataScope === 'org' && user.orgUnitId) {
    return { all: false, orgIds: [user.orgUnitId] };
  }
  return { all: false, orgIds: [] };
}

export async function userDirectory(user: SessionUser): Promise<{ id: string; name: string; title: string | null }[]> {
  const db = await getSupabaseClient();
  const { data } = await db
    .from('app_user')
    .select('id,display_name,title')
    .eq('tenant_id', user.tenantId)
    .eq('status', 'active')
    .order('created_at', { ascending: true });
  return (data ?? []).map((u) => ({
    id: u.id as string,
    name: u.display_name as string,
    title: (u.title as string) ?? null,
  }));
}

export async function listTasks(
  user: SessionUser,
  filter: { status?: string; mine?: boolean; keyword?: string; limit?: number } = {},
): Promise<Task[]> {
  const db = await getSupabaseClient();
  const scope = await resolveScope(user);

  let query = db
    .from('task')
    .select('*')
    .eq('tenant_id', user.tenantId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(filter.limit ?? 100);

  if (filter.status && filter.status !== 'all') query = query.eq('status', filter.status);
  if (filter.mine) query = query.or(`owner_id.eq.${user.id},assignee_id.eq.${user.id}`);
  if (filter.keyword) query = query.ilike('title', `%${filter.keyword}%`);
  if (!scope.all) {
    if (scope.orgIds.length === 0) {
      query = query.or(`owner_id.eq.${user.id},assignee_id.eq.${user.id}`);
    } else {
      query = query.or(`org_unit_id.in.(${scope.orgIds.join(',')}),owner_id.eq.${user.id}`);
    }
  }

  const { data, error } = await query;
  if (error) throw new Error(`查询任务失败：${error.message}`);

  const names = new Map((await userDirectory(user)).map((u) => [u.id, u.name]));
  return (data ?? []).map((row) => toTask(row as Row, names));
}

export async function getTask(
  user: SessionUser,
  id: string,
): Promise<{ task: Task; events: TaskEvent[] } | null> {
  const db = await getSupabaseClient();
  const { data } = await db.from('task').select('*').eq('id', id).eq('tenant_id', user.tenantId).limit(1);
  const row = data?.[0];
  if (!row) return null;

  const names = new Map((await userDirectory(user)).map((u) => [u.id, u.name]));
  const { data: events } = await db
    .from('task_event')
    .select('*')
    .eq('task_id', id)
    .order('created_at', { ascending: true });

  return {
    task: toTask(row as Row, names),
    events: (events ?? []).map((e) => ({
      id: e.id as number,
      action: e.action as string,
      fromStatus: (e.from_status as string) ?? null,
      toStatus: (e.to_status as string) ?? null,
      note: (e.note as string) ?? null,
      actorName: e.actor_id ? (names.get(e.actor_id as string) ?? null) : null,
      createdAt: e.created_at as string,
    })),
  };
}

export async function createTask(
  user: SessionUser,
  input: {
    title: string;
    description?: string;
    module?: string;
    priority?: string;
    assigneeId?: string | null;
    dueAt?: string | null;
    source?: string;
    parentId?: string | null;
    tags?: string[];
  },
): Promise<Task> {
  const db = await getSupabaseClient();
  const seq = await nextTaskCode(user);
  const id = randomUUID();
  const now = new Date().toISOString();

  const { data, error } = await db
    .from('task')
    .insert({
      id,
      tenant_id: user.tenantId,
      code: seq,
      title: input.title,
      description: input.description ?? null,
      module: input.module ?? 'general',
      priority: input.priority ?? 'P2',
      status: 'draft',
      owner_id: user.id,
      assignee_id: input.assigneeId ?? user.id,
      org_unit_id: user.orgUnitId,
      due_at: input.dueAt ?? null,
      progress: 0,
      source: input.source ?? 'manual',
      tags: input.tags ?? [],
      parent_id: input.parentId ?? null,
      created_at: now,
      updated_at: now,
    })
    .select('*');

  if (error || !data?.[0]) throw new Error(`创建任务失败：${error?.message ?? 'unknown'}`);

  await db.from('task_event').insert({
    tenant_id: user.tenantId,
    task_id: id,
    actor_id: user.id,
    action: 'create',
    from_status: null,
    to_status: 'todo',
    note: '任务创建',
  });

  const names = new Map((await userDirectory(user)).map((u) => [u.id, u.name]));
  return toTask(data[0] as Row, names);
}

async function nextTaskCode(user: SessionUser): Promise<string> {
  const db = await getSupabaseClient();
  const { count } = await db
    .from('task')
    .select('id', { count: 'exact', head: true })
    .eq('tenant_id', user.tenantId);
  const seq = (count ?? 0) + 1;
  const d = new Date();
  const ym = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}`;
  return `T${ym}-${String(seq).padStart(4, '0')}`;
}

export async function transitionTask(
  user: SessionUser,
  taskId: string,
  to: TaskStatus,
  note?: string,
): Promise<void> {
  const current = await getTask(user, taskId);
  if (!current) throw new Error('任务不存在或无权访问');
  const from = current.task.status;
  if (!STATUS_FLOW[from].includes(to)) {
    throw new Error(`不允许从「${TASK_STATUS[from].label}」流转到「${TASK_STATUS[to].label}」`);
  }

  const db = await getSupabaseClient();
  const progress = to === 'done' ? 100 : to === 'in_progress' ? Math.max(current.task.progress, 20) : current.task.progress;
  const now = new Date().toISOString();

  const { error } = await db
    .from('task')
    .update({
      status: to,
      progress,
      updated_at: now,
      completed_at: to === 'done' ? now : null,
    })
    .eq('id', taskId)
    .eq('tenant_id', user.tenantId);
  if (error) throw new Error(`任务流转失败：${error.message}`);

  const action = from === 'done' && to === 'in_progress' ? 'reopen' : 'transition';
  await db.from('task_event').insert({
    tenant_id: user.tenantId,
    task_id: taskId,
    actor_id: user.id,
    action,
    from_status: from,
    to_status: to,
    note: note ?? `状态变更为「${TASK_STATUS[to].label}」`,
  });
}

export async function taskStats(user: SessionUser): Promise<{
  mineOpen: number;
  teamOpen: number;
  review: number;
  doneThisWeek: number;
}> {
  const tasks = await listTasks(user, { limit: 500 });
  const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const open = tasks.filter((t) => t.status !== 'done' && t.status !== 'cancelled');
  return {
    mineOpen: open.filter((t) => t.assigneeId === user.id || t.ownerId === user.id).length,
    teamOpen: open.length,
    review: tasks.filter((t) => t.status === 'pending').length,
    doneThisWeek: tasks.filter(
      (t) => t.status === 'done' && t.completedAt && new Date(t.completedAt).getTime() >= weekAgo,
    ).length,
  };
}
