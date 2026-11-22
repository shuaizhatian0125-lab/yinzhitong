import { NextRequest } from 'next/server';
import { z } from 'zod';
import { success, error, ErrorCode, jsonResponse } from '@/lib/api-response';
import { getApiUser, unauthorizedResponse } from '@/lib/api-auth';
import { getSupabaseClient } from '@/storage/database/supabase-client';

const toDocumentSchema = z.object({
  title: z.string().min(1).max(255),
  docType: z.string().optional(),
  content: z.string().optional(),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const user = await getApiUser(request);
  if (!user) return unauthorizedResponse();

  const { id: runId } = await params;
  const db = await getSupabaseClient();

  const { data: run } = await db.from('ai_run')
    .select('id,goal,result,status')
    .eq('id', runId)
    .eq('tenant_id', user.tenantId)
    .single();

  if (!run) {
    return jsonResponse(error(ErrorCode.NOT_FOUND, 'AI执行记录不存在'), 404);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    body = {};
  }

  const parsed = toDocumentSchema.safeParse(body);
  if (!parsed.success) {
    return jsonResponse(
      error(ErrorCode.BAD_REQUEST, '参数校验失败', {
        issues: parsed.error.issues.map((i) => ({ path: i.path, message: i.message })),
      }),
      400,
    );
  }

  const docId = crypto.randomUUID();
  const versionId = crypto.randomUUID();
  const now = new Date().toISOString();

  const contentText = parsed.data.content ?? JSON.stringify(run.result ?? {});

  const { error: docError } = await db.from('document').insert({
    id: docId,
    tenant_id: user.tenantId,
    code: `DOC-${Date.now()}`,
    title: parsed.data.title,
    doc_type: parsed.data.docType ?? 'report',
    module: 'office',
    owner_id: user.id,
    status: 'draft',
    ai_run_id: runId,
    created_at: now,
    updated_at: now,
  });
  if (docError) {
    return jsonResponse(error(ErrorCode.INTERNAL_ERROR, `创建文档失败：${docError.message}`), 500);
  }

  const { error: versionError } = await db.from('document_version').insert({
    id: versionId,
    tenant_id: user.tenantId,
    document_id: docId,
    version_no: 1,
    title: parsed.data.title,
    editor_id: user.id,
    created_at: now,
  });
  if (versionError) {
    return jsonResponse(error(ErrorCode.INTERNAL_ERROR, `创建文档版本失败：${versionError.message}`), 500);
  }

  const { error: contentError } = await db.from('document_content').insert({
    id: crypto.randomUUID(),
    tenant_id: user.tenantId,
    document_id: docId,
    version_id: versionId,
    blocks: [],
    plain_text: contentText,
    updated_at: now,
  });
  if (contentError) {
    return jsonResponse(error(ErrorCode.INTERNAL_ERROR, `创建文档内容失败：${contentError.message}`), 500);
  }

  await db.from('document').update({ current_version_id: versionId }).eq('id', docId);

  return jsonResponse(success({ documentId: docId, versionId, status: 'draft' }), 201);
}