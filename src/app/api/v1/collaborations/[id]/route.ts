import { NextRequest } from 'next/server';
import { success, error, ErrorCode, jsonResponse } from '@/lib/api-response';
import { getCurrentUserFromJwt } from '@/lib/auth';
import { getCollaboration } from '@/server/modules/collab/collaboration-service';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const user = await getCurrentUserFromJwt(request);
  if (!user) {
    return jsonResponse(error(ErrorCode.UNAUTHORIZED, '未登录或登录已过期'), 401);
  }

  const { id } = await params;
  const result = await getCollaboration(user.tenantId, id);

  if (!result) {
    return jsonResponse(error(ErrorCode.NOT_FOUND, '协同事项不存在'), 404);
  }

  return jsonResponse(success(result));
}