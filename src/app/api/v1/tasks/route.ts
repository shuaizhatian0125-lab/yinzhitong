import { NextRequest } from 'next/server';
import { z } from 'zod';
import { success, error, ErrorCode, jsonResponse } from '@/lib/api-response';
import { getApiUser, unauthorizedResponse, forbiddenResponse } from '@/lib/api-auth';
import { listTasks, createTask, resolveScope, userDirectory } from '@/lib/tasks';
import type { Task, TaskStatus } from '@/lib/tasks';

const listFilterSchema = z.object({
  status: z.string().optional(),
  mine: z.string().optional(),
  keyword: z.string().optional(),
  limit: z.string().optional(),
  sort: z.string().optional(),
  assigneeId: z.string().optional(),
  module: z.string().optional(),
});

const createTaskSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().optional(),
  module: z.string().optional(),
  priority: z.enum(['P0', 'P1', 'P2', 'P3']).optional(),
  assigneeId: z.string().optional(),
  dueAt: z.string().optional(),
  parentId: z.string().optional(),
  tags: z.array(z.string()).optional(),
  source: z.string().optional(),
});

export async function GET(request: NextRequest): Promise<Response> {
  const user = await getApiUser(request);
  if (!user) return unauthorizedResponse();

  const sp = request.nextUrl.searchParams;
  const filter: Record<string, string | undefined> = {};
  for (const key of ['status', 'mine', 'keyword', 'limit', 'sort', 'assigneeId', 'module']) {
    const val = sp.get(key);
    if (val) filter[key] = val;
  }

  const parsed = listFilterSchema.safeParse(filter);
  if (!parsed.success) {
    return jsonResponse(
      error(ErrorCode.BAD_REQUEST, '参数校验失败', {
        issues: parsed.error.issues.map((i) => ({ path: i.path, message: i.message })),
      }),
      400,
    );
  }

  const tasks = await listTasks(user, {
    status: parsed.data.status,
    mine: parsed.data.mine === 'true',
    keyword: parsed.data.keyword,
    limit: parsed.data.limit ? Number(parsed.data.limit) : 100,
  });

  let filtered = tasks;
  if (parsed.data.assigneeId) {
    filtered = filtered.filter((t) => t.assigneeId === parsed.data.assigneeId);
  }
  if (parsed.data.module) {
    filtered = filtered.filter((t) => t.module === parsed.data.module);
  }

  if (parsed.data.sort === 'priority') {
    const order = { P0: 0, P1: 1, P2: 2, P3: 3 };
    filtered = [...filtered].sort((a, b) => (order[a.priority as keyof typeof order] ?? 2) - (order[b.priority as keyof typeof order] ?? 2));
  }

  return jsonResponse(success({ items: filtered, total: filtered.length }));
}

export async function POST(request: NextRequest): Promise<Response> {
  const user = await getApiUser(request);
  if (!user) return unauthorizedResponse();

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonResponse(error(ErrorCode.BAD_REQUEST, '请求体格式错误'), 400);
  }

  const parsed = createTaskSchema.safeParse(body);
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
    description: parsed.data.description,
    module: parsed.data.module ?? 'general',
    priority: parsed.data.priority ?? 'P2',
    assigneeId: parsed.data.assigneeId ?? null,
    dueAt: parsed.data.dueAt ?? null,
    parentId: parsed.data.parentId ?? null,
    tags: parsed.data.tags ?? [],
    source: parsed.data.source ?? 'manual',
  });

  return jsonResponse(success(task), 201);
}