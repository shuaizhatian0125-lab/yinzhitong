import { NextRequest } from 'next/server';
import { z } from 'zod';
import { success, error, ErrorCode, jsonResponse } from '@/lib/api-response';
import { getCurrentUserFromJwt } from '@/lib/auth';
import { getCustomer360, getCustomer, updateCustomer } from '@/server/modules/customer/customer-service';

const updateSchema = z.object({
  name: z.string().min(1).optional(),
  type: z.enum(['corp', 'retail']).optional(),
  level: z.enum(['A', 'B', 'C', 'D']).optional(),
  status: z.enum(['active', 'inactive']).optional(),
  profile: z.record(z.string(), z.unknown()).optional(),
  tags: z.array(z.string()).optional(),
});

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const user = await getCurrentUserFromJwt(request);
  if (!user) {
    return jsonResponse(error(ErrorCode.UNAUTHORIZED, '未登录或登录已过期'), 401);
  }

  const { id } = await params;
  const result = await getCustomer360(user.tenantId, id);

  if (!result) {
    return jsonResponse(error(ErrorCode.NOT_FOUND, '客户不存在'), 404);
  }

  return jsonResponse(success(result));
}

export async function PATCH(
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

  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return jsonResponse(
      error(ErrorCode.BAD_REQUEST, '参数校验失败', {
        issues: parsed.error.issues.map((i) => ({ path: i.path, message: i.message })),
      }),
      400,
    );
  }

  try {
    const existing = await getCustomer(user.tenantId, id);
    if (!existing) {
      return jsonResponse(error(ErrorCode.NOT_FOUND, '客户不存在'), 404);
    }

    const updated = await updateCustomer(user.tenantId, id, {
      name: parsed.data.name,
      type: parsed.data.type,
      level: parsed.data.level,
      status: parsed.data.status,
      profile: parsed.data.profile,
      tags: parsed.data.tags,
    });

    if (!updated) {
      return jsonResponse(error(ErrorCode.NOT_FOUND, '客户不存在'), 404);
    }

    return jsonResponse(success(updated));
  } catch (err) {
    const message = err instanceof Error ? err.message : '更新客户失败';
    return jsonResponse(error(ErrorCode.INTERNAL_ERROR, message), 500);
  }
}