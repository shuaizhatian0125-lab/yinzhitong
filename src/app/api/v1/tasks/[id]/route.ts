import { NextRequest } from 'next/server';
import { z } from 'zod';
import { success, error, ErrorCode, jsonResponse } from '@/lib/api-response';
import { getApiUser, unauthorizedResponse } from '@/lib/api-auth';
import { getTask } from '@/lib/tasks';
import { getSupabaseClient } from '@/storage/database/supabase-client';

const patchSchema = z.object({
  title: z.string().max(200).optional(),
  description: z.string().optional(),
  module: z.string().optional(),
  priority: z.enum(['P0', 'P1', 'P2', 'P3']).optional(),
  dueAt: z.string().nullable().optional(),
  tags: z.array(z.string()).optional(),
  assigneeId: z.string().nullable().optional(),
});

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const user = await getApiUser(request);
  if (!user) return unauthorizedResponse();

  const { id } = await params;
  const result = await getTask(user, id);
  if (!result) {
    return jsonResponse(error(ErrorCode.NOT_FOUND, '任务不存在'), 404);
  }

  return jsonResponse(success(result));
}

export async function PATCH(
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

  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return jsonResponse(
      error(ErrorCode.BAD_REQUEST, '参数校验失败', {
        issues: parsed.error.issues.map((i) => ({ path: i.path, message: i.message })),
      }),
      400,
    );
  }

  const db = await getSupabaseClient();
  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (parsed.data.title !== undefined) updates.title = parsed.data.title;
  if (parsed.data.description !== undefined) updates.description = parsed.data.description;
  if (parsed.data.module !== undefined) updates.module = parsed.data.module;
  if (parsed.data.priority !== undefined) updates.priority = parsed.data.priority;
  if (parsed.data.dueAt !== undefined) updates.due_at = parsed.data.dueAt;
  if (parsed.data.tags !== undefined) updates.tags = parsed.data.tags;
  if (parsed.data.assigneeId !== undefined) updates.assignee_id = parsed.data.assigneeId;

  const { error: updateError } = await db.from('task')
    .update(updates)
    .eq('id', id)
    .eq('tenant_id', user.tenantId);

  if (updateError) {
    return jsonResponse(error(ErrorCode.INTERNAL_ERROR, `更新失败：${updateError.message}`), 500);
  }

  const refreshed = await getTask(user, id);
  return jsonResponse(success(refreshed));
}

export async function DELETE(
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

  const db = await getSupabaseClient();
  const { error: deleteError } = await db.from('task')
    .update({ deleted_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('tenant_id', user.tenantId);

  if (deleteError) {
    return jsonResponse(error(ErrorCode.INTERNAL_ERROR, `删除失败：${deleteError.message}`), 500);
  }

  return jsonResponse(success({ deleted: true }));
}