import { getCurrentUser } from '@/lib/auth';
import { markAsRead } from '@/server/platform/notification/service';
import { success, error, jsonResponse, ErrorCode } from '@/lib/api-response';

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const user = await getCurrentUser();
  if (!user) {
    return jsonResponse(error(ErrorCode.UNAUTHORIZED, '未登录'), 401);
  }

  const { id } = await params;
  const ok = await markAsRead(id);
  if (!ok) {
    return jsonResponse(error(ErrorCode.NOT_FOUND, '通知不存在或已读'), 404);
  }

  return jsonResponse(success(null, '已标记为已读'));
}