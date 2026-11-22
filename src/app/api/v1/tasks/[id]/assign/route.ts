import { NextRequest } from 'next/server';
import { z } from 'zod';
import { success, error, ErrorCode, jsonResponse } from '@/lib/api-response';
import { getApiUser, unauthorizedResponse } from '@/lib/api-auth';
import { getTask } from '@/lib/tasks';
import { getSupabaseClient } from '@/storage/database/supabase-client';

const assignSchema = z.object({
  assigneeId: z.string().min(1),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const user = await getApiUser(request);
  if (!user) return unauthorizedResponse();

  const { id } = await params;
  const existing = await getTask(user, id);
  if (!existing) {
    return jsonResponse(error(ErrorCode.NOT_FOUND, '任务不存在'), 404);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonResponse(error(ErrorCode.BAD_REQUEST, '请求体格式错误'), 400);
  }

  const parsed = assignSchema.safeParse(body);
  if (!parsed.success) {
    return jsonResponse(
      error(ErrorCode.BAD_REQUEST, '参数校验失败', {
        issues: parsed.error.issues.map((i) => ({ path: i.path, message: i.message })),
      }),
      400,
    );
  }

  const db = await getSupabaseClient();
  const now = new Date().toISOString();

  const { error: updateError } = await db.from('task')
    .update({ assignee_id: parsed.data.assigneeId, updated_at: now })
    .eq('id', id)
    .eq('tenant_id', user.tenantId);

  if (updateError) {
    return jsonResponse(error(ErrorCode.INTERNAL_ERROR, `指派失败：${updateError.message}`), 500);
  }

  await db.from('task_event').insert({
    tenant_id: user.tenantId,
    task_id: id,
    actor_id: user.id,
    action: 'assign',
    from_status: existing.task.status,
    to_status: existing.task.status,
    note: `指派给新责任人`,
  });

  const refreshed = await getTask(user, id);
  return jsonResponse(success(refreshed));
}