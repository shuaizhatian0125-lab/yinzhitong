import { NextRequest } from 'next/server';
import { success, error, ErrorCode, jsonResponse } from '@/lib/api-response';
import { getCurrentUserFromJwt } from '@/lib/auth';
import { identifyOpportunity } from '@/server/modules/customer/customer-service';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const user = await getCurrentUserFromJwt(request);
  if (!user) {
    return jsonResponse(error(ErrorCode.UNAUTHORIZED, '未登录或登录已过期'), 401);
  }

  const { id } = await params;

  try {
    const suggestions = await identifyOpportunity(user.tenantId, id);
    if (!suggestions) {
      return jsonResponse(error(ErrorCode.NOT_FOUND, '客户不存在'), 404);
    }
    return jsonResponse(success(suggestions));
  } catch (err) {
    const message = err instanceof Error ? err.message : '商机识别失败';
    return jsonResponse(error(ErrorCode.INTERNAL_ERROR, message), 500);
  }
}