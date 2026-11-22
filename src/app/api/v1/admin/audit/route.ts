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

  const sp = request.nextUrl.searchParams;
  const resultFilter = sp.get('result');

  const db = await getSupabaseClient();
  let query = db
    .from('audit_log')
    .select('id,user_id,username,action,resource_type,resource_id,result,created_at,detail')
    .eq('tenant_id', user.tenantId)
    .order('created_at', { ascending: false })
    .limit(200);

  if (resultFilter) {
    query = query.eq('result', resultFilter);
  }

  const { data } = await query;

  const items = (data ?? []).map((row) => ({
    id: row.id as number,
    userId: (row.user_id as string) ?? null,
    username: (row.username as string) ?? null,
    action: row.action as string,
    resourceType: row.resource_type as string,
    resourceId: (row.resource_id as string) ?? null,
    result: row.result as string,
    createdAt: row.created_at as string,
    detail: (row.detail as Record<string, unknown>) ?? null,
  }));

  return jsonResponse(success({ items }));
}