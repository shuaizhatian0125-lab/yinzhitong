import { getSupabaseClient } from '@/storage/database/supabase-client';
import type { DocumentBlock } from './document-service';

export type VersionRow = {
  id: string;
  tenantId: string;
  documentId: string;
  versionNo: number;
  title: string;
  editorId: string | null;
  changeNote: string | null;
  wordCount: number;
  createdAt: string;
};

export async function saveVersion(
  tenantId: string,
  userId: string,
  documentId: string,
  blocks: DocumentBlock[],
  changeNote?: string,
): Promise<VersionRow> {
  const db = getSupabaseClient();

  const { data: latestVersion } = await db
    .from('document_version')
    .select('version_no')
    .eq('document_id', documentId)
    .eq('tenant_id', tenantId)
    .order('version_no', { ascending: false })
    .limit(1);

  const nextVersionNo = ((latestVersion?.[0]?.version_no as number) ?? 0) + 1;

  const { data: doc } = await db
    .from('document')
    .select('title')
    .eq('id', documentId)
    .eq('tenant_id', tenantId)
    .limit(1);

  const title = doc?.[0]?.title as string;

  const versionId = crypto.randomUUID();
  const contentId = crypto.randomUUID();
  const plainText = blocks
    .map((b) => b.text)
    .join('\n');

  const { data: versionData, error: versionErr } = await db
    .from('document_version')
    .insert({
      id: versionId,
      tenant_id: tenantId,
      document_id: documentId,
      version_no: nextVersionNo,
      title,
      editor_id: userId,
      change_note: changeNote ?? null,
      word_count: plainText.length,
    })
    .select()
    .single();

  if (versionErr || !versionData) {
    throw new Error(`保存版本失败: ${versionErr?.message ?? '未知错误'}`);
  }

  await db.from('document_content').insert({
    id: contentId,
    tenant_id: tenantId,
    document_id: documentId,
    version_id: versionId,
    blocks,
    plain_text: plainText,
  });

  await db
    .from('document')
    .update({
      current_version_id: versionId,
      updated_at: new Date().toISOString(),
    })
    .eq('id', documentId);

  return mapVersionRow(versionData);
}

export async function listVersions(
  tenantId: string,
  documentId: string,
): Promise<VersionRow[]> {
  const db = getSupabaseClient();
  const { data } = await db
    .from('document_version')
    .select('*')
    .eq('document_id', documentId)
    .eq('tenant_id', tenantId)
    .order('version_no', { ascending: false });

  return (data ?? []).map(mapVersionRow);
}

export async function restoreVersion(
  tenantId: string,
  userId: string,
  documentId: string,
  versionNo: number,
): Promise<VersionRow> {
  const db = getSupabaseClient();

  const { data: targetVersion } = await db
    .from('document_version')
    .select('id, title')
    .eq('document_id', documentId)
    .eq('tenant_id', tenantId)
    .eq('version_no', versionNo)
    .limit(1);

  const targetVersionId = targetVersion?.[0]?.id as string | null;
  if (!targetVersionId) {
    throw new Error(`版本 ${versionNo} 不存在`);
  }

  const { data: targetContent } = await db
    .from('document_content')
    .select('blocks')
    .eq('version_id', targetVersionId)
    .eq('tenant_id', tenantId)
    .limit(1);

  const targetBlocks = (targetContent?.[0]?.blocks as DocumentBlock[]) ?? [];

  return saveVersion(
    tenantId,
    userId,
    documentId,
    targetBlocks,
    `恢复至版本 ${versionNo}`,
  );
}

function mapVersionRow(row: Record<string, unknown>): VersionRow {
  return {
    id: row.id as string,
    tenantId: row.tenant_id as string,
    documentId: row.document_id as string,
    versionNo: row.version_no as number,
    title: row.title as string,
    editorId: row.editor_id as string | null,
    changeNote: row.change_note as string | null,
    wordCount: row.word_count as number,
    createdAt: row.created_at as string,
  };
}