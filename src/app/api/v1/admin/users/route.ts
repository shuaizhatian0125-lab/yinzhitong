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
  const { data } = await db
    .from('app_user')
    .select('id,username,display_name,role_code,org_unit_id,status,title,last_login_at,created_at')
    .eq('tenant_id', user.tenantId)
    .order('created_at', { ascending: false });

  const items = (data ?? []).map((row) => ({
    id: row.id as string,
    username: row.username as string,
    displayName: row.display_name as string,
    roleCode: row.role_code as string,
    orgUnitId: (row.org_unit_id as string) ?? null,
    status: row.status as string,
    title: (row.title as string) ?? null,
    lastLoginAt: (row.last_login_at as string) ?? null,
    createdAt: row.created_at as string,
  }));

  return jsonResponse(success({ items }));
}