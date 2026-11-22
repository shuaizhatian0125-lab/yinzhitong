import { NextRequest } from 'next/server';
import { z } from 'zod';
import { success, error, ErrorCode, jsonResponse } from '@/lib/api-response';
import { getCurrentUserFromJwt } from '@/lib/auth';
import { getConflict, resolveConflict, escalateConflict } from '@/server/modules/collab/conflict-service';

const patchSchema = z.object({
  action: z.enum(['RESOLVE', 'ESCALATE']),
  resolution: z.string().optional(),
  reason: z.string().optional(),
});

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; confId: string }> },
): Promise<Response> {
  const user = await getCurrentUserFromJwt(request);
  if (!user) {
    return jsonResponse(error(ErrorCode.UNAUTHORIZED, '未登录或登录已过期'), 401);
  }

  const { confId } = await params;
  const conflict = await getConflict(user.tenantId, confId);

  if (!conflict) {
    return jsonResponse(error(ErrorCode.NOT_FOUND, '冲突不存在'), 404);
  }

  return jsonResponse(success(conflict));
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; confId: string }> },
): Promise<Response> {
  const user = await getCurrentUserFromJwt(request);
  if (!user) {
    return jsonResponse(error(ErrorCode.UNAUTHORIZED, '未登录或登录已过期'), 401);
  }

  const { confId } = await params;

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

  try {
    let conflict;
    if (parsed.data.action === 'RESOLVE') {
      if (!parsed.data.resolution) {
        return jsonResponse(error(ErrorCode.BAD_REQUEST, 'RESOLVE 需要 resolution'), 400);
      }
      conflict = await resolveConflict(user.tenantId, confId, parsed.data.resolution, user);
    } else {
      if (!parsed.data.reason) {
        return jsonResponse(error(ErrorCode.BAD_REQUEST, 'ESCALATE 需要 reason'), 400);
      }
      conflict = await escalateConflict(user.tenantId, confId, parsed.data.reason);
    }

    return jsonResponse(success(conflict));
  } catch (err) {
    const message = err instanceof Error ? err.message : '更新冲突失败';
    return jsonResponse(error(ErrorCode.INTERNAL_ERROR, message), 500);
  }
}