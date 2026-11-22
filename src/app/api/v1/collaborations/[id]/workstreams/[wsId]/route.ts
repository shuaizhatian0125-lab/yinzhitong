import { NextRequest } from 'next/server';
import { z } from 'zod';
import { success, error, ErrorCode, jsonResponse } from '@/lib/api-response';
import { getCurrentUserFromJwt } from '@/lib/auth';
import { getWorkstream, updateWorkstream, type WorkstreamStatus, type UpdateWorkstreamInput } from '@/server/modules/collab/workstream-service';

const updateSchema = z.object({
  name: z.string().optional(),
  phase: z.string().optional(),
  objectives: z.array(z.string()).optional(),
  status: z.enum(['PLANNED', 'ACTIVE', 'PAUSED', 'COMPLETED', 'FAILED']).optional(),
  progress: z.number().min(0).max(100).optional(),
  milestone: z.object({
    name: z.string(),
    checkDate: z.string().optional(),
  }).optional(),
  dependencies: z.array(z.string()).optional(),
  dynamicAdjustment: z.object({
    type: z.enum(['SPLIT', 'MERGE', 'REPLACE', 'DEPENDENCY_CHANGE']),
    description: z.string(),
    reason: z.string(),
    appliedAt: z.string(),
  }).optional(),
});

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; wsId: string }> },
): Promise<Response> {
  const user = await getCurrentUserFromJwt(request);
  if (!user) {
    return jsonResponse(error(ErrorCode.UNAUTHORIZED, '未登录或登录已过期'), 401);
  }

  const { wsId } = await params;
  const workstream = await getWorkstream(user.tenantId, wsId);

  if (!workstream) {
    return jsonResponse(error(ErrorCode.NOT_FOUND, '工作线不存在'), 404);
  }

  return jsonResponse(success(workstream));
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; wsId: string }> },
): Promise<Response> {
  const user = await getCurrentUserFromJwt(request);
  if (!user) {
    return jsonResponse(error(ErrorCode.UNAUTHORIZED, '未登录或登录已过期'), 401);
  }

  const { wsId } = await params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonResponse(error(ErrorCode.BAD_REQUEST, '请求体格式错误'), 400);
  }

  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return jsonResponse(
      error(ErrorCode.BAD_REQUEST, '参数校验失败', {
        issues: parsed.error.issues.map((i) => ({ path: i.path, message: i.message })),
      }),
      400,
    );
  }

  try {
    const patch: UpdateWorkstreamInput = {};
    if (parsed.data.name !== undefined) patch.name = parsed.data.name;
    if (parsed.data.phase !== undefined) patch.phase = parsed.data.phase;
    if (parsed.data.objectives !== undefined) patch.objectives = parsed.data.objectives;
    if (parsed.data.status !== undefined) patch.status = parsed.data.status as WorkstreamStatus;
    if (parsed.data.progress !== undefined) patch.progress = parsed.data.progress;
    if (parsed.data.milestone !== undefined) patch.milestone = parsed.data.milestone;
    if (parsed.data.dependencies !== undefined) patch.dependencies = parsed.data.dependencies;
    if (parsed.data.dynamicAdjustment !== undefined) patch.dynamicAdjustment = parsed.data.dynamicAdjustment;

    const workstream = await updateWorkstream(user.tenantId, wsId, patch);
    return jsonResponse(success(workstream));
  } catch (err) {
    const message = err instanceof Error ? err.message : '更新工作线失败';
    return jsonResponse(error(ErrorCode.INTERNAL_ERROR, message), 500);
  }
}