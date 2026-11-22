import { NextRequest } from 'next/server';
import { success, error, ErrorCode, jsonResponse } from '@/lib/api-response';
import { getApiUser, unauthorizedResponse, forbiddenResponse } from '@/lib/api-auth';
import { getSupabaseClient } from '@/storage/database/supabase-client';

function requireAdmin(user: { permissions: string[] } | null): boolean {
  if (!user) return false;
  return user.permissions.includes('*') || user.permissions.includes('admin');
}

export async function GET(request: NextRequest): Promise<Response> {
  const user = await getApiUser(request);
  if (!user) return unauthorizedResponse();
  if (!requireAdmin(user)) return forbiddenResponse();

  const db = await getSupabaseClient();

  const { data: roles } = await db
    .from('role')
    .select('id,code,name,description,is_system,data_scope')
    .eq('tenant_id', user.tenantId)
    .order('is_system', { ascending: false });

  const roleIds = (roles ?? []).map((r) => r.id as string);

  let permissionMap = new Map<string, string[]>();
  if (roleIds.length > 0) {
    const { data: perms } = await db
      .from('role_permission')
      .select('role_id,permission_code')
      .in('role_id', roleIds);

    if (perms) {
      for (const p of perms) {
        const rid = p.role_id as string;
        const code = p.permission_code as string;
        const arr = permissionMap.get(rid) ?? [];
        arr.push(code);
        permissionMap.set(rid, arr);
      }
    }
  }

  const items = (roles ?? []).map((row) => ({
    id: row.id as string,
    code: row.code as string,
    name: row.name as string,
    description: (row.description as string) ?? null,
    isSystem: (row.is_system as boolean) ?? false,
    dataScope: row.data_scope as string,
    permissions: permissionMap.get(row.id as string) ?? [],
  }));

  return jsonResponse(success({ items }));
}