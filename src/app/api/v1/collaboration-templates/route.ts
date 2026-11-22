import { NextRequest } from 'next/server';
import { success, error, ErrorCode, jsonResponse } from '@/lib/api-response';
import { getCurrentUserFromJwt } from '@/lib/auth';
import { listTemplates } from '@/server/modules/collab/template-service';

export async function GET(request: NextRequest): Promise<Response> {
  const user = await getCurrentUserFromJwt(request);
  if (!user) {
    return jsonResponse(error(ErrorCode.UNAUTHORIZED, '未登录或登录已过期'), 401);
  }

  const collaborationType = request.nextUrl.searchParams.get('type') ?? undefined;

  try {
    const templates = await listTemplates(user.tenantId, collaborationType);
    return jsonResponse(success({ items: templates }));
  } catch (err) {
    const message = err instanceof Error ? err.message : '获取模板列表失败';
    return jsonResponse(error(ErrorCode.INTERNAL_ERROR, message), 500);
  }
}