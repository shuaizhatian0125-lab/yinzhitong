import { NextRequest } from 'next/server';
import { z } from 'zod';
import { success, error, ErrorCode, jsonResponse } from '@/lib/api-response';
import { getCurrentUserFromJwt } from '@/lib/auth';
import { getDashboardData } from '@/server/modules/cockpit/cockpit-service';

const codeSchema = z.string().min(1, '驾驶舱代码不能为空');

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ code: string }> },
): Promise<Response> {
  const user = await getCurrentUserFromJwt(request);
  if (!user) {
    return jsonResponse(error(ErrorCode.UNAUTHORIZED, '未登录或登录已过期'), 401);
  }

  const { code } = await params;
  const parsed = codeSchema.safeParse(code);
  if (!parsed.success) {
    return jsonResponse(
      error(ErrorCode.BAD_REQUEST, '参数校验失败', {
        issues: parsed.error.issues.map((i) => ({ path: i.path, message: i.message })),
      }),
      400,
    );
  }

  const hasPermission =
    user.permissions.includes('*') ||
    user.permissions.includes('cockpit:view') ||
    user.permissions.includes('cockpit:read');

  if (!hasPermission) {
    return jsonResponse(error(ErrorCode.FORBIDDEN, '无权限访问该资源'), 403);
  }

  try {
    const data = await getDashboardData(user, parsed.data);
    if (!data) {
      return jsonResponse(error(ErrorCode.NOT_FOUND, '驾驶舱数据不存在'), 404);
    }
    return jsonResponse(success(data));
  } catch (err) {
    const message = err instanceof Error ? err.message : '获取驾驶舱数据失败';
    return jsonResponse(error(ErrorCode.INTERNAL_ERROR, message), 500);
  }
}