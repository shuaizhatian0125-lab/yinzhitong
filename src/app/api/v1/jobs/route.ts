import { NextRequest } from 'next/server';
import { z } from 'zod';
import { success, error, ErrorCode, jsonResponse } from '@/lib/api-response';
import { getApiUser, unauthorizedResponse } from '@/lib/api-auth';
import { createJob, listJobs, type JobFilter } from '@/server/platform/job/service';

const createJobSchema = z.object({
  kind: z.string().min(1).max(48),
  payload: z.record(z.string(), z.unknown()).default({}),
});

const listFilterSchema = z.object({
  status: z.enum(['queued', 'running', 'succeeded', 'failed', 'cancelled']).optional(),
  kind: z.string().optional(),
  limit: z.string().optional(),
  offset: z.string().optional(),
});

export async function GET(request: NextRequest): Promise<Response> {
  const user = await getApiUser(request);
  if (!user) return unauthorizedResponse();

  const sp = request.nextUrl.searchParams;
  const filter: Record<string, string | undefined> = {};
  for (const key of ['status', 'kind', 'limit', 'offset']) {
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

  const jobFilter: JobFilter = {
    status: parsed.data.status,
    kind: parsed.data.kind,
    limit: parsed.data.limit ? Number(parsed.data.limit) : 50,
    offset: parsed.data.offset ? Number(parsed.data.offset) : 0,
  };

  const result = await listJobs(user.tenantId, jobFilter);
  return jsonResponse(success(result));
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

  const parsed = createJobSchema.safeParse(body);
  if (!parsed.success) {
    return jsonResponse(
      error(ErrorCode.BAD_REQUEST, '参数校验失败', {
        issues: parsed.error.issues.map((i) => ({ path: i.path, message: i.message })),
      }),
      400,
    );
  }

  const job = await createJob(user.tenantId, parsed.data.kind, parsed.data.payload, user.id);
  return jsonResponse(success(job), 201);
}