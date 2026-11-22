import { NextRequest } from 'next/server';
import { success, error, ErrorCode, jsonResponse } from '@/lib/api-response';
import { getCurrentUserFromJwt } from '@/lib/auth';
import { getDocument, listDocuments } from '@/server/modules/knowledge/knowledge-service';
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
    const doc = await getDocument(user.tenantId, id);
    if (!doc) {
      return jsonResponse(error(ErrorCode.NOT_FOUND, '文档不存在'), 404);
    }

    const db = getSupabaseClient();
    const { data: chunks } = await db
      .from('knowledge_chunk')
      .select('id, seq, content, heading, page_no, tokens')
      .eq('doc_id', id)
      .eq('tenant_id', user.tenantId)
      .order('seq', { ascending: true });

    return jsonResponse(success({ document: doc, chunks: chunks ?? [] }));
  } catch (err) {
    return jsonResponse(
      error(ErrorCode.INTERNAL_ERROR, err instanceof Error ? err.message : '获取文档详情失败'),
      500,
    );
  }
}