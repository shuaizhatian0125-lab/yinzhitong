import { NextRequest } from 'next/server';
import { z } from 'zod';
import { getSupabaseClient } from '@/storage/database/supabase-client';
import { verifyPassword, createSession } from '@/lib/auth';
import { signAccessToken, signRefreshToken } from '@/server/platform/auth/jwt';
import { success, error, ErrorCode, jsonResponse } from '@/lib/api-response';
import { writeAudit } from '@/lib/audit';
import { enabledModules, isDemoMode } from '@/lib/config';
import { CENTERS } from '@/lib/permissions';
import { findDemoUser, demoUserToSessionUser } from '@/lib/demo-users';

const loginSchema = z.object({
  username: z.string().min(1, '用户名不能为空'),
  password: z.string().min(1, '密码不能为空'),
});

export async function POST(request: NextRequest): Promise<Response> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonResponse(error(ErrorCode.BAD_REQUEST, '请求体格式错误'), 400);
  }

  const parsed = loginSchema.safeParse(body);
  if (!parsed.success) {
    return jsonResponse(
      error(ErrorCode.BAD_REQUEST, '参数校验失败', {
        issues: parsed.error.issues.map((i) => ({ path: i.path, message: i.message })),
      }),
      400,
    );
  }

  const { username, password } = parsed.data;

  if (isDemoMode) {
    const demoUser = findDemoUser(username, password);
    if (!demoUser) {
      return jsonResponse(error(ErrorCode.UNAUTHORIZED, '用户名或密码错误'), 401);
    }

    const sessionUser = demoUserToSessionUser(demoUser);
    const accessToken = await signAccessToken({
      userId: sessionUser.id,
      tenantId: sessionUser.tenantId,
      roleCode: sessionUser.roleCode,
      permissions: sessionUser.permissions,
    });
    const refreshToken = await signRefreshToken({
      userId: sessionUser.id,
      tenantId: sessionUser.tenantId,
    });

    const menus = CENTERS.filter((c) => enabledModules.includes(c.code));

    return jsonResponse(
      success({
        access_token: accessToken,
        refresh_token: refreshToken,
        user: {
          id: sessionUser.id,
          tenantId: sessionUser.tenantId,
          tenantName: sessionUser.tenantName,
          username: sessionUser.username,
          displayName: sessionUser.displayName,
          title: sessionUser.title,
          roleCode: sessionUser.roleCode,
          roleName: sessionUser.roleName,
          orgUnitId: sessionUser.orgUnitId,
          orgName: sessionUser.orgName,
          dataScope: sessionUser.dataScope,
        },
        permissions: sessionUser.permissions,
        menus,
      }),
    );
  }

  const db = await getSupabaseClient();
  const { data: users } = await db
    .from('app_user')
    .select('*')
    .eq('username', username)
    .limit(1);

  const user = users?.[0];
  if (!user) {
    await writeAudit({
      tenantId: 'unknown',
      action: 'login',
      resourceType: 'auth',
      result: 'failure',
      detail: { username, reason: 'user_not_found' },
      ip: (request.headers.get('x-forwarded-for') ?? '').split(',')[0].trim() || null,
    });
    return jsonResponse(error(ErrorCode.UNAUTHORIZED, '用户名或密码错误'), 401);
  }

  if (user.status !== 'active') {
    return jsonResponse(error(ErrorCode.FORBIDDEN, '账号已被禁用'), 403);
  }

  const passwordValid = verifyPassword(password, user.password_hash);
  if (!passwordValid) {
    await writeAudit({
      tenantId: user.tenant_id,
      user: null,
      action: 'login',
      resourceType: 'auth',
      result: 'failure',
      detail: { username, reason: 'wrong_password' },
      ip: (request.headers.get('x-forwarded-for') ?? '').split(',')[0].trim() || null,
    });
    return jsonResponse(error(ErrorCode.UNAUTHORIZED, '用户名或密码错误'), 401);
  }

  const [{ data: tenants }, { data: roles }, { data: orgs }] = await Promise.all([
    db.from('tenant').select('id,name,short_name').eq('id', user.tenant_id).limit(1),
    db.from('role').select('code,name,data_scope,id').eq('tenant_id', user.tenant_id),
    user.org_unit_id
      ? db.from('org_unit').select('id,name').eq('id', user.org_unit_id).limit(1)
      : Promise.resolve({ data: [] as { id: string; name: string }[] }),
  ]);

  const roleRow = (roles ?? []).find((r) => r.code === user.role_code);
  let permissions: string[] = [];
  if (roleRow) {
    const { data: perms } = await db
      .from('role_permission')
      .select('permission_code')
      .eq('role_id', roleRow.id);
    permissions = (perms ?? []).map((p) => p.permission_code as string);
  }

  const tenantName = tenants?.[0]?.short_name || tenants?.[0]?.name || '银智通';
  const orgName = orgs?.[0]?.name ?? null;
  const dataScope = roleRow?.data_scope ?? 'self';

  const accessToken = await signAccessToken({
    userId: user.id,
    tenantId: user.tenant_id,
    roleCode: user.role_code,
    permissions,
  });

  const refreshToken = await signRefreshToken({
    userId: user.id,
    tenantId: user.tenant_id,
  });

  await createSession(user.id, user.tenant_id);

  await db
    .from('app_user')
    .update({ last_login_at: new Date().toISOString() })
    .eq('id', user.id);

  const menus = CENTERS.filter((c) => enabledModules.includes(c.code));

  await writeAudit({
    tenantId: user.tenant_id,
    user: {
      id: user.id,
      tenantId: user.tenant_id,
      tenantName,
      username: user.username,
      displayName: user.display_name,
      title: user.title,
      roleCode: user.role_code,
      roleName: roleRow?.name ?? user.role_code,
      orgUnitId: user.org_unit_id,
      orgName,
      dataScope,
      permissions,
    },
    action: 'login',
    resourceType: 'auth',
    detail: { method: 'password' },
    ip: (request.headers.get('x-forwarded-for') ?? '').split(',')[0].trim() || null,
  });

  return jsonResponse(
    success({
      access_token: accessToken,
      refresh_token: refreshToken,
      user: {
        id: user.id,
        tenantId: user.tenant_id,
        tenantName,
        username: user.username,
        displayName: user.display_name,
        title: user.title,
        roleCode: user.role_code,
        roleName: roleRow?.name ?? user.role_code,
        orgUnitId: user.org_unit_id,
        orgName,
        dataScope,
      },
      permissions,
      menus,
    }),
  );
}