import { NextRequest } from 'next/server';
import { z } from 'zod';
import { success, error, ErrorCode, jsonResponse } from '@/lib/api-response';
import { getCurrentUserFromJwt } from '@/lib/auth';
import { addMember, removeMember } from '@/server/modules/collab/collaboration-service';

const addSchema = z.object({
  user_id: z.string().min(1, '用户ID不能为空'),
  role: z.string().optional(),
});

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
    return jsonResponse(error(ErrorCode.BAD_REQUEST, '请求体格式错误'), 400);
  }

  const parsed = addSchema.safeParse(body);
  if (!parsed.success) {
    return jsonResponse(
      error(ErrorCode.BAD_REQUEST, '参数校验失败', {
        issues: parsed.error.issues.map((i) => ({ path: i.path, message: i.message })),
      }),
      400,
    );
  }

  try {
    const member = await addMember(user.tenantId, id, parsed.data.user_id, parsed.data.role ?? 'member');
    if (!member) {
      return jsonResponse(error(ErrorCode.CONFLICT, '该用户已是协同事项成员'), 409);
    }
    return jsonResponse(success(member), 201);
  } catch (err) {
    const message = err instanceof Error ? err.message : '添加成员失败';
    return jsonResponse(error(ErrorCode.INTERNAL_ERROR, message), 500);
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const user = await getCurrentUserFromJwt(request);
  if (!user) {
    return jsonResponse(error(ErrorCode.UNAUTHORIZED, '未登录或登录已过期'), 401);
  }

  const { id } = await params;
  const userId = request.nextUrl.searchParams.get('user_id');

  if (!userId) {
    return jsonResponse(error(ErrorCode.BAD_REQUEST, '缺少 user_id 参数'), 400);
  }

  const ok = await removeMember(user.tenantId, id, userId);
  if (!ok) {
    return jsonResponse(error(ErrorCode.BAD_REQUEST, '移除成员失败，可能是所有者无法移除'), 400);
  }

  return jsonResponse(success({ removed: true }));
}