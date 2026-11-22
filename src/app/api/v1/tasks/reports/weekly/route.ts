import { NextRequest } from 'next/server';
import { success, error, ErrorCode, jsonResponse } from '@/lib/api-response';
import { getApiUser, unauthorizedResponse } from '@/lib/api-auth';
import { listTasks, resolveScope } from '@/lib/tasks';
import { getSupabaseClient } from '@/storage/database/supabase-client';

export async function GET(request: NextRequest): Promise<Response> {
  const user = await getApiUser(request);
  if (!user) return unauthorizedResponse();

  const scope = request.nextUrl.searchParams.get('scope') ?? 'personal';
  const now = new Date();
  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() - now.getDay() + 1);
  weekStart.setHours(0, 0, 0, 0);
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 6);
  weekEnd.setHours(23, 59, 59, 999);

  const tasks = await listTasks(user, { limit: 500 });

  const weekTasks = tasks.filter((t) => {
    const created = new Date(t.createdAt);
    return created >= weekStart && created <= weekEnd;
  });

  const completed = weekTasks.filter((t) => t.status === 'done');
  const inProgress = weekTasks.filter((t) => t.status === 'in_progress');
  const blocked = weekTasks.filter((t) => t.status === 'blocked');
  const pending = weekTasks.filter((t) => t.status === 'pending');

  const byModule: Record<string, number> = {};
  for (const t of weekTasks) {
    byModule[t.module] = (byModule[t.module] ?? 0) + 1;
  }

  const byPriority: Record<string, number> = {};
  for (const t of weekTasks) {
    byPriority[t.priority] = (byPriority[t.priority] ?? 0) + 1;
  }

  let userName = user.displayName;
  let deptName = user.orgName ?? '个人';

  if (scope === 'department' && user.orgUnitId) {
    const db = await getSupabaseClient();
    const { data: deptTasks } = await db.from('task')
      .select('id,title,status,priority,module,assignee_id,created_at,completed_at')
      .eq('tenant_id', user.tenantId)
      .eq('org_unit_id', user.orgUnitId)
      .is('deleted_at', null)
      .gte('created_at', weekStart.toISOString())
      .lte('created_at', weekEnd.toISOString());

    const deptRows = (deptTasks ?? []) as Record<string, unknown>[];
    const deptCompleted = deptRows.filter((r) => r.status === 'done').length;
    const deptInProgress = deptRows.filter((r) => r.status === 'in_progress').length;
    const deptBlocked = deptRows.filter((r) => r.status === 'blocked').length;

    return jsonResponse(success({
      scope: 'department',
      userName,
      deptName,
      weekStart: weekStart.toISOString(),
      weekEnd: weekEnd.toISOString(),
      summary: {
        total: deptRows.length,
        completed: deptCompleted,
        inProgress: deptInProgress,
        blocked: deptBlocked,
        completionRate: deptRows.length > 0 ? Math.round((deptCompleted / deptRows.length) * 100) : 0,
      },
      byModule,
      byPriority,
      highlights: deptRows.slice(0, 10).map((r) => ({
        title: r.title as string,
        status: r.status as string,
        priority: r.priority as string,
      })),
    }));
  }

  return jsonResponse(success({
    scope: 'personal',
    userName,
    deptName,
    weekStart: weekStart.toISOString(),
    weekEnd: weekEnd.toISOString(),
    summary: {
      total: weekTasks.length,
      completed: completed.length,
      inProgress: inProgress.length,
      blocked: blocked.length,
      pending: pending.length,
      completionRate: weekTasks.length > 0 ? Math.round((completed.length / weekTasks.length) * 100) : 0,
    },
    byModule,
    byPriority,
    highlights: weekTasks.slice(0, 10).map((t) => ({
      title: t.title,
      status: t.status,
      priority: t.priority,
    })),
  }));
}