import { NextRequest } from 'next/server';
import { success, error, ErrorCode, jsonResponse } from '@/lib/api-response';
import { getCurrentUserFromJwt } from '@/lib/auth';
import { analyzeSegment } from '@/server/modules/marketing/marketing-service';

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
    const analysis = await analyzeSegment(user.tenantId, id);
    if (!analysis) {
      return jsonResponse(error(ErrorCode.NOT_FOUND, '客群不存在'), 404);
    }
    return jsonResponse(success(analysis));
  } catch (err) {
    const message = err instanceof Error ? err.message : '客群分析失败';
    return jsonResponse(error(ErrorCode.INTERNAL_ERROR, message), 500);
  }
}