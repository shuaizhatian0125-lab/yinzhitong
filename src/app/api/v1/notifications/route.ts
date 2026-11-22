import { NextRequest } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { listNotifications, getUnreadCount } from '@/server/platform/notification/service';
import { success, error, jsonResponse, ErrorCode } from '@/lib/api-response';

export async function GET(request: NextRequest): Promise<Response> {
  const user = await getCurrentUser();
  if (!user) {
    return jsonResponse(error(ErrorCode.UNAUTHORIZED, '未登录'), 401);
  }

  const searchParams = request.nextUrl.searchParams;
  const unread = searchParams.get('unread') === 'true';
  const type = searchParams.get('type') ?? undefined;
  const limitParam = searchParams.get('limit');
  const limit = limitParam ? Number(limitParam) : undefined;

  const [notifications, unreadCount] = await Promise.all([
    listNotifications(user.id, { unread, type: type as never, limit }),
    getUnreadCount(user.id),
  ]);

  return jsonResponse(
    success({ items: notifications, unreadCount }),
  );
}