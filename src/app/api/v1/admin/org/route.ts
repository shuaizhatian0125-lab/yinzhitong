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
    .from('org_unit')
    .select('id,name,code,parent_id,type,level,path,sort,status')
    .eq('tenant_id', user.tenantId)
    .order('sort', { ascending: true });

  const items = (data ?? []).map((row) => ({
    id: row.id as string,
    name: row.name as string,
    code: row.code as string,
    parentId: (row.parent_id as string) ?? null,
    type: row.type as string,
    level: row.level as number,
    path: row.path as string,
    sort: row.sort as number,
    status: row.status as string,
  }));

  return jsonResponse(success({ items }));
}