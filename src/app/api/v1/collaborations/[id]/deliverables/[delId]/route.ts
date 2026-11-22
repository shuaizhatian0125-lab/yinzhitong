import { NextRequest } from 'next/server';
import { z } from 'zod';
import { success, error, ErrorCode, jsonResponse } from '@/lib/api-response';
import { getCurrentUserFromJwt } from '@/lib/auth';
import { getDeliverable, updateDeliverableStatus, type DeliverableAction } from '@/server/modules/collab/deliverable-service';

const patchSchema = z.object({
  action: z.enum(['SUBMIT', 'REVIEW', 'APPROVE', 'REJECT', 'DELIVER', 'REVISE']),
});

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; delId: string }> },
): Promise<Response> {
  const user = await getCurrentUserFromJwt(request);
  if (!user) {
    return jsonResponse(error(ErrorCode.UNAUTHORIZED, '未登录或登录已过期'), 401);
  }

  const { delId } = await params;
  const deliverable = await getDeliverable(user.tenantId, delId);

  if (!deliverable) {
    return jsonResponse(error(ErrorCode.NOT_FOUND, '成果不存在'), 404);
  }

  return jsonResponse(success(deliverable));
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; delId: string }> },
): Promise<Response> {
  const user = await getCurrentUserFromJwt(request);
  if (!user) {
    return jsonResponse(error(ErrorCode.UNAUTHORIZED, '未登录或登录已过期'), 401);
  }

  const { delId } = await params;

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
    const deliverable = await updateDeliverableStatus(
      user.tenantId,
      delId,
      parsed.data.action as DeliverableAction,
      user,
    );

    return jsonResponse(success(deliverable));
  } catch (err) {
    const message = err instanceof Error ? err.message : '更新成果状态失败';
    return jsonResponse(error(ErrorCode.INTERNAL_ERROR, message), 500);
  }
}