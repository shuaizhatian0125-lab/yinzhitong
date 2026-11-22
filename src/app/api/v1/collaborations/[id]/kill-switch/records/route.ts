import { NextRequest } from 'next/server';
import { success, error, ErrorCode, jsonResponse } from '@/lib/api-response';
import { getCurrentUserFromJwt } from '@/lib/auth';
import { getSupabaseClient } from '@/storage/database/supabase-client';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const user = await getCurrentUserFromJwt(request);
  if (!user) {
    return jsonResponse(error(ErrorCode.UNAUTHORIZED, '未登录或登录已过期'), 401);
  }

  const { id } = await params;

  try {
    const db = await getSupabaseClient();
    const { data } = await db.from('audit_log')
      .select('id,action,detail,created_at,user_id,username')
      .eq('tenant_id', user.tenantId)
      .eq('resource_id', id)
      .like('action', 'kill_switch:%')
      .order('created_at', { ascending: false })
      .limit(50);

    return jsonResponse(success({ items: data ?? [] }));
  } catch (err) {
    const message = err instanceof Error ? err.message : '获取 Kill Switch 记录失败';
    return jsonResponse(error(ErrorCode.INTERNAL_ERROR, message), 500);
  }
}