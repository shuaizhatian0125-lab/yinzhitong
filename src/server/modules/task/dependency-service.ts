import { getSupabaseClient } from '@/storage/database/supabase-client';
import type { SessionUser } from '@/lib/auth';

export type DependencyType = 'finish_to_start' | 'start_to_start' | 'finish_to_finish' | 'start_to_finish';

export type TaskDependency = {
  id: string;
  taskId: string;
  dependsOnId: string;
  type: DependencyType;
  createdAt: string;
};

type Row = Record<string, unknown>;

function toDependency(row: Row): TaskDependency {
  return {
    id: row.id as string,
    taskId: row.task_id as string,
    dependsOnId: row.depends_on_id as string,
    type: row.type as DependencyType,
    createdAt: row.created_at as string,
  };
}

export async function createDependency(
  user: SessionUser,
  taskId: string,
  dependsOnId: string,
  type: DependencyType = 'finish_to_start',
): Promise<TaskDependency> {
  if (taskId === dependsOnId) {
    throw new Error('任务不能依赖自身');
  }

  const hasCycle = await detectCycle(user, taskId, dependsOnId);
  if (hasCycle) {
    throw new Error('检测到循环依赖，无法创建依赖关系');
  }

  const db = await getSupabaseClient();
  const id = crypto.randomUUID();

  const { data, error } = await db.from('task_dependency').insert({
    id,
    tenant_id: user.tenantId,
    task_id: taskId,
    depends_on_id: dependsOnId,
    type,
  }).select('*').single();

  if (error) throw new Error(`创建依赖关系失败：${error.message}`);
  return toDependency(data as Row);
}

export async function listDependencies(
  user: SessionUser,
  taskId: string,
): Promise<TaskDependency[]> {
  const db = await getSupabaseClient();
  const { data, error } = await db.from('task_dependency')
    .select('*')
    .eq('task_id', taskId)
    .eq('tenant_id', user.tenantId);

  if (error) throw new Error(`查询依赖关系失败：${error.message}`);
  return (data ?? []).map((row) => toDependency(row as Row));
}

export async function deleteDependency(
  user: SessionUser,
  dependencyId: string,
): Promise<void> {
  const db = await getSupabaseClient();
  const { error } = await db.from('task_dependency')
    .delete()
    .eq('id', dependencyId)
    .eq('tenant_id', user.tenantId);

  if (error) throw new Error(`删除依赖关系失败：${error.message}`);
}

export async function checkDependencyBlocked(
  user: SessionUser,
  taskId: string,
): Promise<{ blocked: boolean; reason: string | null }> {
  const dependencies = await listDependencies(user, taskId);

  if (dependencies.length === 0) {
    return { blocked: false, reason: null };
  }

  const db = await getSupabaseClient();
  const dependsOnIds = dependencies.map((d) => d.dependsOnId);

  const { data } = await db.from('task')
    .select('id,status,title')
    .in('id', dependsOnIds)
    .eq('tenant_id', user.tenantId);

  const tasks = (data ?? []) as { id: string; status: string; title: string }[];

  for (const dep of dependencies) {
    if (dep.type === 'finish_to_start') {
      const predTask = tasks.find((t) => t.id === dep.dependsOnId);
      if (predTask && predTask.status !== 'done') {
        return {
          blocked: true,
          reason: `前置任务「${predTask.title}」尚未完成`,
        };
      }
    }
    if (dep.type === 'start_to_start') {
      const predTask = tasks.find((t) => t.id === dep.dependsOnId);
      if (predTask && predTask.status === 'draft') {
        return {
          blocked: true,
          reason: `前置任务「${predTask.title}」尚未启动`,
        };
      }
    }
  }

  return { blocked: false, reason: null };
}

async function detectCycle(
  user: SessionUser,
  taskId: string,
  dependsOnId: string,
): Promise<boolean> {
  const visited = new Set<string>();
  const stack = [dependsOnId];

  while (stack.length > 0) {
    const current = stack.pop()!;
    if (current === taskId) return true;
    if (visited.has(current)) continue;
    visited.add(current);

    const db = await getSupabaseClient();
    const { data } = await db.from('task_dependency')
      .select('depends_on_id')
      .eq('task_id', current)
      .eq('tenant_id', user.tenantId);

    for (const row of (data ?? []) as { depends_on_id: string }[]) {
      stack.push(row.depends_on_id);
    }
  }

  return false;
}