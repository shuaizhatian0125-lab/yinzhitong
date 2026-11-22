import { NextRequest } from 'next/server';
import { z } from 'zod';
import { success, error, ErrorCode, jsonResponse } from '@/lib/api-response';
import { getApiUser, unauthorizedResponse } from '@/lib/api-auth';
import { createTask } from '@/lib/tasks';

const batchSchema = z.object({
  tasks: z.array(
    z.object({
      title: z.string().min(1).max(200),
      description: z.string().optional(),
      module: z.string().optional(),
      priority: z.enum(['P0', 'P1', 'P2', 'P3']).optional(),
      assigneeId: z.string().optional(),
      dueAt: z.string().optional(),
      parentId: z.string().optional(),
      tags: z.array(z.string()).optional(),
    }),
  ).min(1).max(50),
  source: z.string().optional(),
});

export async function POST(request: NextRequest): Promise<Response> {
  const user = await getApiUser(request);
  if (!user) return unauthorizedResponse();

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonResponse(error(ErrorCode.BAD_REQUEST, '请求体格式错误'), 400);
  }

  const parsed = batchSchema.safeParse(body);
  if (!parsed.success) {
    return jsonResponse(
      error(ErrorCode.BAD_REQUEST, '参数校验失败', {
        issues: parsed.error.issues.map((i) => ({ path: i.path, message: i.message })),
      }),
      400,
    );
  }

  const created = [];
  for (const taskInput of parsed.data.tasks) {
    const task = await createTask(user, {
      title: taskInput.title,
      description: taskInput.description,
      module: taskInput.module ?? 'general',
      priority: taskInput.priority ?? 'P2',
      assigneeId: taskInput.assigneeId ?? null,
      dueAt: taskInput.dueAt ?? null,
      parentId: taskInput.parentId ?? null,
      tags: taskInput.tags ?? [],
      source: parsed.data.source ?? 'manual',
    });
    created.push(task);
  }

  return jsonResponse(success({ items: created, total: created.length }), 201);
}