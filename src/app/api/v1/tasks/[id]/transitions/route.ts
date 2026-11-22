import { NextRequest } from 'next/server';
import { z } from 'zod';
import { success, error, ErrorCode, jsonResponse } from '@/lib/api-response';
import { getApiUser, unauthorizedResponse } from '@/lib/api-auth';
import { transitionTask, getTask, TASK_STATUS } from '@/lib/tasks';
import type { TaskStatus } from '@/lib/tasks';

const transitionSchema = z.object({
  to: z.enum(['draft', 'pending', 'in_progress', 'blocked', 'done', 'cancelled']),
  note: z.string().max(500).optional(),
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

  const parsed = transitionSchema.safeParse(body);
  if (!parsed.success) {
    return jsonResponse(
      error(ErrorCode.BAD_REQUEST, '参数校验失败', {
        issues: parsed.error.issues.map((i) => ({ path: i.path, message: i.message })),
      }),
      400,
    );
  }

  try {
    await transitionTask(user, id, parsed.data.to as TaskStatus, parsed.data.note);
    const refreshed = await getTask(user, id);
    return jsonResponse(success(refreshed));
  } catch (err) {
    const message = err instanceof Error ? err.message : '状态流转失败';
    return jsonResponse(error(ErrorCode.CONFLICT, message), 409);
  }
}