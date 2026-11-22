import { NextRequest } from 'next/server';
import { success, error, ErrorCode, jsonResponse } from '@/lib/api-response';
import { getCurrentUserFromJwt } from '@/lib/auth';
import { generateIndustryReport } from '@/server/modules/research/research-service';

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
    const report = await generateIndustryReport(user.tenantId, id);
    return jsonResponse(success(report));
  } catch (err) {
    const message = err instanceof Error ? err.message : '行业研究失败';
    return jsonResponse(error(ErrorCode.INTERNAL_ERROR, message), 500);
  }
}