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

  const { data: events } = await db.from('task_event')
    .select('*')
    .eq('task_id', id)
    .eq('tenant_id', user.tenantId)
    .order('created_at', { ascending: true });

  return jsonResponse(success({ items: events ?? [] }));
}