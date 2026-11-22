import { NextRequest } from 'next/server';
import { success, error, ErrorCode, jsonResponse } from '@/lib/api-response';
import { getApiUser, unauthorizedResponse } from '@/lib/api-auth';
import { getSupabaseClient } from '@/storage/database/supabase-client';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const user = await getApiUser(request);
  if (!user) return unauthorizedResponse();

  const { id } = await params;
  const db = await getSupabaseClient();

  const { data: run } = await db.from('ai_run')
    .select('*')
    .eq('id', id)
    .eq('tenant_id', user.tenantId)
    .single();

  if (!run) {
    return jsonResponse(error(ErrorCode.NOT_FOUND, 'AI执行记录不存在'), 404);
  }

  const { data: steps } = await db.from('ai_run_step')
    .select('*')
    .eq('run_id', id)
    .eq('tenant_id', user.tenantId)
    .order('seq');

  const { data: toolCalls } = await db.from('ai_tool_call')
    .select('*')
    .eq('run_id', id)
    .eq('tenant_id', user.tenantId)
    .order('created_at');

  return jsonResponse(success({
    run,
    steps: steps ?? [],
    toolCalls: toolCalls ?? [],
  }));
}