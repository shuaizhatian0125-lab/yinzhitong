import { NextRequest } from 'next/server';
import { z } from 'zod';
import { success, error, ErrorCode, jsonResponse } from '@/lib/api-response';
import { getCurrentUserFromJwt } from '@/lib/auth';
import { listWorkstreams, createWorkstream, type WorkstreamStatus } from '@/server/modules/collab/workstream-service';

const createSchema = z.object({
  name: z.string().min(1, '工作线名称不能为空'),
  phase: z.string().min(1, '阶段不能为空'),
  objectives: z.array(z.string()).default([]),
  milestone: z.object({
    name: z.string(),
    checkDate: z.string().optional(),
  }).optional(),
  dependencies: z.array(z.string()).default([]),
});

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const user = await getCurrentUserFromJwt(request);
  if (!user) {
    return jsonResponse(error(ErrorCode.UNAUTHORIZED, '未登录或登录已过期'), 401);
  }

  const { id } = await params;
  const result = await listWorkstreams(user.tenantId, id);

  return jsonResponse(success({
    workstreams: result.workstreams,
    phases: result.phases,
  }));
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const user = await getCurrentUserFromJwt(request);
  if (!user) {
    return jsonResponse(error(ErrorCode.UNAUTHORIZED, '未登录或登录已过期'), 401);
  }

  const { id } = await params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonResponse(error(ErrorCode.BAD_REQUEST, '请求体格式错误'), 400);
  }

  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return jsonResponse(
      error(ErrorCode.BAD_REQUEST, '参数校验失败', {
        issues: parsed.error.issues.map((i) => ({ path: i.path, message: i.message })),
      }),
      400,
    );
  }

  try {
    const workstream = await createWorkstream(user.tenantId, {
      collaborationId: id,
      name: parsed.data.name,
      phase: parsed.data.phase,
      objectives: parsed.data.objectives,
      milestone: parsed.data.milestone,
      dependencies: parsed.data.dependencies,
    });

    return jsonResponse(success(workstream), 201);
  } catch (err) {
    const message = err instanceof Error ? err.message : '创建工作线失败';
    return jsonResponse(error(ErrorCode.INTERNAL_ERROR, message), 500);
  }
}