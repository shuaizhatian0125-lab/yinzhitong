import { NextRequest } from 'next/server';
import { z } from 'zod';
import { getSupabaseClient } from '@/storage/database/supabase-client';
import { verifyToken, signAccessToken, signRefreshToken } from '@/server/platform/auth/jwt';
import { success, error, ErrorCode, jsonResponse } from '@/lib/api-response';

const refreshSchema = z.object({
  refresh_token: z.string().min(1, 'refresh_token 不能为空'),
});

export async function POST(request: NextRequest): Promise<Response> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonResponse(error(ErrorCode.BAD_REQUEST, '请求体格式错误'), 400);
  }

  const parsed = refreshSchema.safeParse(body);
  if (!parsed.success) {
    return jsonResponse(
      error(ErrorCode.BAD_REQUEST, '参数校验失败', {
        issues: parsed.error.issues.map((i) => ({ path: i.path, message: i.message })),
      }),
      400,
    );
  }

  const { refresh_token } = parsed.data;

  let claims;
  try {
    claims = await verifyToken(refresh_token);
  } catch {
    return jsonResponse(error(ErrorCode.UNAUTHORIZED, 'refresh_token 无效或已过期'), 401);
  }

  const db = await getSupabaseClient();
  const { data: users } = await db
    .from('app_user')
    .select('id,tenant_id,role_code,status')
    .eq('id', claims.userId)
    .limit(1);

  const user = users?.[0];
  if (!user || user.status !== 'active') {
    return jsonResponse(error(ErrorCode.UNAUTHORIZED, '用户不存在或已被禁用'), 401);
  }

  const { data: roles } = await db
    .from('role')
    .select('code,name,data_scope,id')
    .eq('tenant_id', user.tenant_id);

  const roleRow = (roles ?? []).find((r) => r.code === user.role_code);
  let permissions: string[] = [];
  if (roleRow) {
    const { data: perms } = await db
      .from('role_permission')
      .select('permission_code')
      .eq('role_id', roleRow.id);
    permissions = (perms ?? []).map((p) => p.permission_code as string);
  }

  const accessToken = await signAccessToken({
    userId: user.id,
    tenantId: user.tenant_id,
    roleCode: user.role_code,
    permissions,
  });

  const newRefreshToken = await signRefreshToken({
    userId: user.id,
    tenantId: user.tenant_id,
  });

  return jsonResponse(
    success({
      access_token: accessToken,
      refresh_token: newRefreshToken,
    }),
  );
}