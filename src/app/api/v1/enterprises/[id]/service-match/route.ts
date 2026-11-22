import { NextRequest } from 'next/server';
import { success, error, ErrorCode, jsonResponse } from '@/lib/api-response';
import { getCurrentUserFromJwt } from '@/lib/auth';
import { matchServices } from '@/server/modules/enterprise/service-match-service';

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
    body = {};
  }

  const analysisId = (body as { analysisId?: string })?.analysisId;

  try {
    const results = await matchServices(user.tenantId, id, analysisId);
    return jsonResponse(success(results));
  } catch (err) {
    const message = err instanceof Error ? err.message : '服务匹配失败';
    return jsonResponse(error(ErrorCode.INTERNAL_ERROR, message), 500);
  }
}