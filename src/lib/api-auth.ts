import { cookies, headers } from 'next/headers';
import { verifyToken, type JwtClaims } from '@/server/platform/auth/jwt';
import { getCurrentUser, type SessionUser } from '@/lib/auth';
import { error, ErrorCode, jsonResponse } from '@/lib/api-response';

function extractBearerToken(authHeader: string | null): string | null {
  if (!authHeader) return null;
  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  return match?.[1] ?? null;
}

export async function getApiUser(request: Request): Promise<SessionUser | null> {
  const authHeader = request.headers.get('authorization');
  const token = extractBearerToken(authHeader);

  if (token) {
    try {
      const claims = await verifyToken(token);
      return await resolveUserFromClaims(claims);
    } catch {
      return null;
    }
  }

  return getCurrentUser();
}

export async function requireApiUser(request: Request): Promise<SessionUser | null> {
  const user = await getApiUser(request);
  if (!user) {
    return null;
  }
  return user;
}

export async function requireApiPermission(
  request: Request,
  permission: string,
): Promise<{ user: SessionUser; allowed: boolean } | null> {
  const user = await getApiUser(request);
  if (!user) {
    return null;
  }
  return {
    user,
    allowed: user.permissions.includes('*') || user.permissions.includes(permission),
  };
}

export function unauthorizedResponse() {
  return jsonResponse(error(ErrorCode.UNAUTHORIZED, '未认证或认证已过期'), 401);
}

export function forbiddenResponse() {
  return jsonResponse(error(ErrorCode.FORBIDDEN, '无权限访问该资源'), 403);
}

async function resolveUserFromClaims(claims: JwtClaims): Promise<SessionUser | null> {
  const { getSupabaseClient } = await import('@/storage/database/supabase-client');
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