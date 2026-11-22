import { NextRequest } from 'next/server';
import { z } from 'zod';
import { getSupabaseClient } from '@/storage/database/supabase-client';
import { createSession } from '@/lib/auth';
import { signAccessToken, signRefreshToken } from '@/server/platform/auth/jwt';
import { success, error, ErrorCode, jsonResponse } from '@/lib/api-response';
import { isDemoMode, wechatConfig } from '@/lib/config';
import { CENTERS } from '@/lib/permissions';
import { enabledModules } from '@/lib/config';
import { findDemoUser, demoUserToSessionUser } from '@/lib/demo-users';
import { writeAudit } from '@/lib/audit';

const wechatLoginSchema = z.object({
  code: z.string().min(1, '微信code不能为空'),
});

interface WechatSessionResponse {
  openid: string;
  session_key: string;
  unionid?: string;
}

async function getWechatOpenid(code: string): Promise<WechatSessionResponse | null> {
  if (!wechatConfig.appid || !wechatConfig.secret) {
    return null;
  }

  const url = `https://api.weixin.qq.com/sns/jscode2session?appid=${wechatConfig.appid}&secret=${wechatConfig.secret}&js_code=${code}&grant_type=authorization_code`;

  try {
    const res = await fetch(url);
    const data = (await res.json()) as WechatSessionResponse & { errcode?: number; errmsg?: string };
    if (data.errcode) {
      console.error('[WeChat] jscode2session error:', data.errcode, data.errmsg);
      return null;
    }
    return data;
  } catch (err) {
    console.error('[WeChat] jscode2session fetch failed:', err);
    return null;
  }
}

export async function POST(request: NextRequest): Promise<Response> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonResponse(error(ErrorCode.BAD_REQUEST, '请求体格式错误'), 400);
  }

  const parsed = wechatLoginSchema.safeParse(body);
  if (!parsed.success) {
    return jsonResponse(
      error(ErrorCode.BAD_REQUEST, '参数校验失败', {
        issues: parsed.error.issues.map((i) => ({ path: i.path, message: i.message })),
      }),
      400,
    );
  }

  const { code } = parsed.data;

  if (isDemoMode) {
    const demoUser = findDemoUser('admin', 'admin123');
    if (!demoUser) {
      return jsonResponse(error(ErrorCode.INTERNAL_ERROR, '演示用户不存在'), 500);
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
        token: accessToken,
        refreshToken,
        user: {
          id: sessionUser.id,
          name: sessionUser.displayName,
          roleCode: sessionUser.roleCode,
          department: sessionUser.orgName,
        },
        menus,
      }),
    );
  }

  const wechatSession = await getWechatOpenid(code);
  if (!wechatSession || !wechatSession.openid) {
    return jsonResponse(error(ErrorCode.UNAUTHORIZED, '微信登录失败：无法获取openid'), 401);
  }

  const db = await getSupabaseClient();

  const { data: existingLinks } = await db
    .from('wechat_user_link')
    .select('user_id')
    .eq('openid', wechatSession.openid)
    .limit(1);

  let userId: string;
  let isNewUser = false;

  if (existingLinks && existingLinks.length > 0) {
    userId = existingLinks[0].user_id;
  } else {
    const { data: newUser } = await db
      .from('app_user')
      .insert({
        username: `wx_${wechatSession.openid.substring(0, 12)}`,
        display_name: '微信用户',
        role_code: 'staff',
        tenant_id: 'default',
        status: 'active',
      })
      .select('id')
      .single();

    if (!newUser) {
      return jsonResponse(error(ErrorCode.INTERNAL_ERROR, '创建用户失败'), 500);
    }

    userId = newUser.id;
    isNewUser = true;

    await db.from('wechat_user_link').insert({
      openid: wechatSession.openid,
      unionid: wechatSession.unionid ?? null,
      user_id: userId,
    });
  }

  const { data: users } = await db
    .from('app_user')
    .select('*')
    .eq('id', userId)
    .limit(1);

  const user = users?.[0];
  if (!user || user.status !== 'active') {
    return jsonResponse(error(ErrorCode.FORBIDDEN, '账号已被禁用'), 403);
  }

  const [{ data: tenants }, { data: roles }] = await Promise.all([
    db.from('tenant').select('id,name,short_name').eq('id', user.tenant_id).limit(1),
    db.from('role').select('code,name,data_scope,id').eq('tenant_id', user.tenant_id),
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
      orgName: null,
      dataScope: roleRow?.data_scope ?? 'self',
      permissions,
    },
    action: 'login',
    resourceType: 'auth',
    detail: { method: 'wechat', isNewUser, openid: wechatSession.openid.substring(0, 8) },
    ip: (request.headers.get('x-forwarded-for') ?? '').split(',')[0].trim() || null,
  });

  return jsonResponse(
    success({
      token: accessToken,
      refreshToken,
      user: {
        id: user.id,
        name: user.display_name,
        roleCode: user.role_code,
        department: null,
      },
      menus,
    }),
  );
}