import { NextRequest } from 'next/server';
import { success, error, ErrorCode, jsonResponse } from '@/lib/api-response';
import { getCurrentUserFromJwt } from '@/lib/auth';
import { restoreVersion } from '@/server/modules/office/version-service';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; no: string }> },
): Promise<Response> {
  const user = await getCurrentUserFromJwt(request);
  if (!user) {
    return jsonResponse(error(ErrorCode.UNAUTHORIZED, '未登录或登录已过期'), 401);
  }

  const { id, no } = await params;
  const versionNo = parseInt(no, 10);

  if (isNaN(versionNo) || versionNo < 1) {
    return jsonResponse(error(ErrorCode.BAD_REQUEST, '版本号无效'), 400);
  }

  try {
    const version = await restoreVersion(user.tenantId, user.id, id, versionNo);
    return jsonResponse(success(version));
  } catch (err) {
    return jsonResponse(
      error(ErrorCode.INTERNAL_ERROR, err instanceof Error ? err.message : '恢复版本失败'),
      500,
    );
  }
}