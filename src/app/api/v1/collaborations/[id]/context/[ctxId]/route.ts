import { NextRequest } from 'next/server';
import { success, error, ErrorCode, jsonResponse } from '@/lib/api-response';
import { getCurrentUserFromJwt } from '@/lib/auth';
import { updateContextStatus } from '@/server/modules/collab/shared-context-service';

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; ctxId: string }> },
): Promise<Response> {
  const user = await getCurrentUserFromJwt(request);
  if (!user) {
    return jsonResponse(error(ErrorCode.UNAUTHORIZED, '未登录或登录已过期'), 401);
  }

  const { ctxId } = await params;

  try {
    await updateContextStatus(user.tenantId, ctxId, 'SUPERSEDED');
    return jsonResponse(success({ deleted: true }));
  } catch (err) {
    const message = err instanceof Error ? err.message : '删除 Context 失败';
    return jsonResponse(error(ErrorCode.INTERNAL_ERROR, message), 500);
  }
}