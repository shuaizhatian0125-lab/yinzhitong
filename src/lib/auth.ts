import { createHash, randomBytes, randomUUID, scryptSync, timingSafeEqual } from 'node:crypto';
import { cookies, headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { getSupabaseClient } from '@/storage/database/supabase-client';
import { verifyToken, type JwtClaims } from '@/server/platform/auth/jwt';
import { isDemoMode } from '@/lib/config';
import { getDemoUserById, demoUserToSessionUser, DEMO_USERS } from '@/lib/demo-users';

export const SESSION_COOKIE = 'bz_session';
const SESSION_TTL_MS = 8 * 60 * 60 * 1000; // 银行工作台 8 小时

export type SessionUser = {
  id: string;
  tenantId: string;
  tenantName: string;
  username: string;
  displayName: string;
  title: string | null;
  roleCode: string;
  roleName: string;
  orgUnitId: string | null;
  orgName: string | null;
  dataScope: string;
  permissions: string[];
};

/* ---------- 口令 ---------- */

export function hashPassword(password: string): string {
  const salt = randomBytes(16);
  const hash = scryptSync(password, salt, 64);
  return `scrypt$16384$8$1$${salt.toString('hex')}$${hash.toString('hex')}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  try {
    const [algo, n, r, p, saltHex, hashHex] = stored.split('$');
    if (algo !== 'scrypt') return false;
    const salt = Buffer.from(saltHex, 'hex');
    const expected = Buffer.from(hashHex, 'hex');
    const actual = scryptSync(password, salt, expected.length, {
      N: Number(n),
      r: Number(r),
      p: Number(p),
    });
    return actual.length === expected.length && timingSafeEqual(actual, expected);
  } catch {
    return false;
  }
}

const sha256 = (v: string) => createHash('sha256').update(v).digest('hex');

/* ---------- 会话 ---------- */

export async function createSession(userId: string, tenantId: string): Promise<void> {
  const db = await getSupabaseClient();
  const token = randomBytes(32).toString('hex');
  const hdrs = await headers();
  const ip = (hdrs.get('x-forwarded-for') ?? '').split(',')[0].trim() || null;
  const ua = hdrs.get('user-agent') ?? null;

  await db.from('session').insert({
    id: randomUUID(),
    tenant_id: tenantId,
    user_id: userId,
    token_hash: sha256(token),
    ip,
    user_agent: ua,
    expires_at: new Date(Date.now() + SESSION_TTL_MS).toISOString(),
  });

  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: SESSION_TTL_MS / 1000,
  });
}

export async function destroySession(): Promise<void> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (token) {
    const db = await getSupabaseClient();
    await db
      .from('session')
      .update({ revoked_at: new Date().toISOString() })
      .eq('token_hash', sha256(token));
  }
  store.delete(SESSION_COOKIE);
}

export async function getCurrentUserFromJwt(request: Request): Promise<SessionUser | null> {
  const authHeader = request.headers.get('authorization');
  if (!authHeader) return null;

  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  const token = match?.[1];
  if (!token) return null;

  try {
    const claims = await verifyToken(token);

    if (isDemoMode) {
      const demoUser = getDemoUserById(claims.userId);
      if (demoUser) return demoUserToSessionUser(demoUser);
    }

    return resolveUserFromClaims(claims);
  } catch {
    return null;
  }
}

async function resolveUserFromClaims(claims: JwtClaims): Promise<SessionUser | null> {
  const db = await getSupabaseClient();

  const { data: users } = await db
    .from('app_user')
    .select('*')
    .eq('id', claims.userId)
    .limit(1);
  const user = users?.[0];
  if (!user || user.status !== 'active') return null;

  const [{ data: tenants }, { data: roles }, { data: orgs }] = await Promise.all([
    db.from('tenant').select('id,name,short_name').eq('id', user.tenant_id).limit(1),
    db.from('role').select('code,name,data_scope,id').eq('tenant_id', user.tenant_id),
    user.org_unit_id
      ? db.from('org_unit').select('id,name').eq('id', user.org_unit_id).limit(1)
      : Promise.resolve({ data: [] as { id: string; name: string }[] }),
  ]);

  const roleRow = (roles ?? []).find((r) => r.code === user.role_code);
  let permissions: string[] = claims.permissions ?? [];
  if (roleRow && permissions.length === 0) {
    const { data: perms } = await db
      .from('role_permission')
      .select('permission_code')
      .eq('role_id', roleRow.id);
    permissions = (perms ?? []).map((p) => p.permission_code as string);
  }

  return {
    id: user.id,
    tenantId: user.tenant_id,
    tenantName: tenants?.[0]?.short_name || tenants?.[0]?.name || '银智通',
    username: user.username,
    displayName: user.display_name,
    title: user.title,
    roleCode: user.role_code,
    roleName: roleRow?.name ?? user.role_code,
    orgUnitId: user.org_unit_id,
    orgName: orgs?.[0]?.name ?? null,
    dataScope: roleRow?.data_scope ?? 'self',
    permissions,
  };
}

export async function getCurrentUser(): Promise<SessionUser | null> {
  const hdrs = await headers();
  const authHeader = hdrs.get('authorization');

  if (authHeader) {
    const match = authHeader.match(/^Bearer\s+(.+)$/i);
    const token = match?.[1];
    if (token) {
      try {
        const claims = await verifyToken(token);

        if (isDemoMode) {
          const demoUser = getDemoUserById(claims.userId);
          if (demoUser) return demoUserToSessionUser(demoUser);
        }

        return resolveUserFromClaims(claims);
      } catch {
        // JWT 无效，fallback 到 cookie session
      }
    }
  }

  if (isDemoMode) {
    const store = await cookies();
    const demoRole = store.get('demo_role')?.value;
    if (demoRole) {
      const demoUser = DEMO_USERS.find((u) => u.roleCode === demoRole);
      if (demoUser) return demoUserToSessionUser(demoUser);
    }
    const defaultDemo = DEMO_USERS[0];
    return demoUserToSessionUser(defaultDemo);
  }

  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const db = await getSupabaseClient();
  const { data: sessions } = await db
    .from('session')
    .select('id,user_id,tenant_id,expires_at,revoked_at')
    .eq('token_hash', sha256(token))
    .limit(1);

  const session = sessions?.[0];
  if (!session) return null;
  if (session.revoked_at) return null;
  if (new Date(session.expires_at).getTime() < Date.now()) return null;

  const { data: users } = await db
    .from('app_user')
    .select('*')
    .eq('id', session.user_id)
    .limit(1);
  const user = users?.[0];
  if (!user || user.status !== 'active') return null;

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

  return {
    id: user.id,
    tenantId: user.tenant_id,
    tenantName: tenants?.[0]?.short_name || tenants?.[0]?.name || '银智通',
    username: user.username,
    displayName: user.display_name,
    title: user.title,
    roleCode: user.role_code,
    roleName: roleRow?.name ?? user.role_code,
    orgUnitId: user.org_unit_id,
    orgName: orgs?.[0]?.name ?? null,
    dataScope: roleRow?.data_scope ?? 'self',
    permissions,
  };
}

export async function requireUser(): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  return user;
}

export function can(user: SessionUser, permission: string): boolean {
  return user.permissions.includes('*') || user.permissions.includes(permission);
}
export async function authenticateUser(
  username: string,
  password: string,
): Promise<SessionUser | null> {
  if (isDemoMode) {
    const { findDemoUser, demoUserToSessionUser } = await import('@/lib/demo-users');
    const demoUser = findDemoUser(username, password);
    if (demoUser) return demoUserToSessionUser(demoUser);
    return null;
  }

  const db = await getSupabaseClient();
  const { data: users } = await db
    .from('app_user')
    .select('id,tenant_id,username,display_name,title,role_code,org_unit_id,password_hash,status')
    .eq('username', username)
    .limit(1);

  const user = users?.[0];
  if (!user || user.status !== 'active') return null;
  if (!user.password_hash || !verifyPassword(password, user.password_hash)) return null;

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

  return {
    id: user.id,
    tenantId: user.tenant_id,
    tenantName: tenants?.[0]?.short_name || tenants?.[0]?.name || '银智通',
    username: user.username,
    displayName: user.display_name,
    title: user.title,
    roleCode: user.role_code,
    roleName: roleRow?.name ?? user.role_code,
    orgUnitId: user.org_unit_id,
    orgName: orgs?.[0]?.name ?? null,
    dataScope: roleRow?.data_scope ?? 'self',
    permissions,
  };
}
