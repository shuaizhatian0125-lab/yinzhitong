import { NextRequest } from 'next/server';
import { z } from 'zod';
import { success, error, ErrorCode, jsonResponse } from '@/lib/api-response';
import { getApiUser, unauthorizedResponse } from '@/lib/api-auth';
import { getSupabaseClient } from '@/storage/database/supabase-client';
import { createTask } from '@/lib/tasks';

const toTaskSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().optional(),
  priority: z.string().optional(),
  assigneeId: z.string().optional(),
  dueAt: z.string().optional(),
  module: z.string().optional(),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const user = await getApiUser(request);
  if (!user) return unauthorizedResponse();

  const { id: runId } = await params;
  const db = await getSupabaseClient();

  const { data: run } = await db.from('ai_run')
    .select('id,goal,result,status')
    .eq('id', runId)
    .eq('tenant_id', user.tenantId)
    .single();

  if (!run) {
    return jsonResponse(error(ErrorCode.NOT_FOUND, 'AI执行记录不存在'), 404);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    body = {};
  }

  const parsed = toTaskSchema.safeParse(body);
  if (!parsed.success) {
    return jsonResponse(
      error(ErrorCode.BAD_REQUEST, '参数校验失败', {
        issues: parsed.error.issues.map((i) => ({ path: i.path, message: i.message })),
      }),
      400,
    );
  }

  const task = await createTask(user, {
    title: parsed.data.title,
    description: parsed.data.description ?? (run.goal as string),
    priority: parsed.data.priority ?? 'P2',
    assigneeId: parsed.data.assigneeId ?? null,
    dueAt: parsed.data.dueAt ?? null,
    module: parsed.data.module ?? 'general',
    source: 'ai_imported',
    tags: [`ai_run:${runId}`],
  });

  return jsonResponse(success({ task }), 201);
}