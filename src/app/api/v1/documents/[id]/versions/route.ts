import { NextRequest } from 'next/server';
import { success, error, ErrorCode, jsonResponse } from '@/lib/api-response';
import { getCurrentUserFromJwt } from '@/lib/auth';
import { listVersions } from '@/server/modules/office/version-service';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const user = await getCurrentUserFromJwt(request);
  if (!user) {
    return jsonResponse(error(ErrorCode.UNAUTHORIZED, '未登录或登录已过期'), 401);
  }

  const { id } = await params;

  try {
    const versions = await listVersions(user.tenantId, id);
    return jsonResponse(success(versions));
  } catch (err) {
    return jsonResponse(
      error(ErrorCode.INTERNAL_ERROR, err instanceof Error ? err.message : '获取版本列表失败'),
      500,
    );
  }
}