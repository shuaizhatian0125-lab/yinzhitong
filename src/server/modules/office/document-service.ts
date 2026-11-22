import { getSupabaseClient } from '@/storage/database/supabase-client';

export type DocumentBlock = {
  type: 'heading' | 'paragraph' | 'list' | 'table' | 'image' | 'chart' | 'quote' | 'code';
  attrs: Record<string, unknown>;
  text: string;
};

export type DocumentRow = {
  id: string;
  tenantId: string;
  code: string;
  title: string;
  docType: string;
  module: string;
  ownerId: string;
  orgUnitId: string | null;
  status: string;
  visibility: string;
  templateId: string | null;
  currentVersionId: string | null;
  aiRunId: string | null;
  qualityScore: number | null;
  tags: string[];
  createdAt: string;
  updatedAt: string;
};

export type DocumentContentRow = {
  id: string;
  tenantId: string;
  documentId: string;
  versionId: string;
  blocks: DocumentBlock[];
  plainText: string;
  updatedAt: string;
};

export async function createDocument(
  tenantId: string,
  userId: string,
  title: string,
  docType: string,
  templateId?: string,
): Promise<{ document: DocumentRow; content: DocumentContentRow }> {
  const db = getSupabaseClient();
  const docId = crypto.randomUUID();
  const code = `doc_${Date.now().toString(36)}`;

  let initialBlocks: DocumentBlock[] = [];
  if (templateId) {
    const template = await getTemplateBlocks(tenantId, templateId);
    if (template) {
      initialBlocks = template;
    }
  }

  if (initialBlocks.length === 0) {
    initialBlocks = [
      { type: 'heading', attrs: { level: 1 }, text: title },
      { type: 'paragraph', attrs: {}, text: '' },
    ];
  }

  const { data: docData, error: docErr } = await db
    .from('document')
    .insert({
      id: docId,
      tenant_id: tenantId,
      code,
      title,
      doc_type: docType,
      module: 'office',
      owner_id: userId,
      status: 'draft',
      visibility: 'org',
      template_id: templateId ?? null,
    })
    .select()
    .single();

  if (docErr || !docData) {
    throw new Error(`创建文档失败: ${docErr?.message ?? '未知错误'}`);
  }

  const versionId = crypto.randomUUID();
  const contentId = crypto.randomUUID();
  const plainText = blocksToPlainText(initialBlocks);

  const { data: versionData, error: versionErr } = await db
    .from('document_version')
    .insert({
      id: versionId,
      tenant_id: tenantId,
      document_id: docId,
      version_no: 1,
      title,
      editor_id: userId,
      word_count: plainText.length,
    })
    .select()
    .single();

  if (versionErr || !versionData) {
    throw new Error(`创建文档版本失败: ${versionErr?.message ?? '未知错误'}`);
  }

  const { data: contentData, error: contentErr } = await db
    .from('document_content')
    .insert({
      id: contentId,
      tenant_id: tenantId,
      document_id: docId,
      version_id: versionId,
      blocks: initialBlocks,
      plain_text: plainText,
    })
    .select()
    .single();

  if (contentErr || !contentData) {
    throw new Error(`创建文档内容失败: ${contentErr?.message ?? '未知错误'}`);
  }

  await db
    .from('document')
    .update({ current_version_id: versionId })
    .eq('id', docId);

  return {
    document: mapDocRow(docData),
    content: mapContentRow(contentData),
  };
}

export async function listDocuments(tenantId: string, userId: string): Promise<DocumentRow[]> {
  const db = getSupabaseClient();
  const { data } = await db
    .from('document')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('owner_id', userId)
    .is('deleted_at', null)
    .order('updated_at', { ascending: false });

  return (data ?? []).map(mapDocRow);
}

export async function getDocument(
  tenantId: string,
  docId: string,
): Promise<DocumentRow | null> {
  const db = getSupabaseClient();
  const { data } = await db
    .from('document')
    .select('*')
    .eq('id', docId)
    .eq('tenant_id', tenantId)
    .is('deleted_at', null)
    .limit(1);

  return data?.[0] ? mapDocRow(data[0]) : null;
}

export async function getDocumentContent(
  tenantId: string,
  docId: string,
): Promise<DocumentContentRow | null> {
  const db = getSupabaseClient();
  const { data: doc } = await db
    .from('document')
    .select('current_version_id')
    .eq('id', docId)
    .eq('tenant_id', tenantId)
    .limit(1);

  const versionId = doc?.[0]?.current_version_id as string | null;
  if (!versionId) return null;

  const { data: content } = await db
    .from('document_content')
    .select('*')
    .eq('version_id', versionId)
    .eq('tenant_id', tenantId)
    .limit(1);

  return content?.[0] ? mapContentRow(content[0]) : null;
}

export async function updateDocumentContent(
  tenantId: string,
  userId: string,
  docId: string,
  blocks: DocumentBlock[],
): Promise<DocumentContentRow> {
  const db = getSupabaseClient();
  const plainText = blocksToPlainText(blocks);

  const { data: doc } = await db
    .from('document')
    .select('current_version_id, title')
    .eq('id', docId)
    .eq('tenant_id', tenantId)
    .limit(1);

  const currentVersionId = doc?.[0]?.current_version_id as string | null;
  const title = doc?.[0]?.title as string;

  if (currentVersionId) {
    await db
      .from('document_content')
      .update({
        blocks,
        plain_text: plainText,
        updated_at: new Date().toISOString(),
      })
      .eq('version_id', currentVersionId)
      .eq('tenant_id', tenantId);

    await db
      .from('document_version')
      .update({ word_count: plainText.length })
      .eq('id', currentVersionId);

    const { data: content } = await db
      .from('document_content')
      .select('*')
      .eq('version_id', currentVersionId)
      .eq('tenant_id', tenantId)
      .limit(1);

    if (content?.[0]) {
      return mapContentRow(content[0]);
    }
  }

  const versionId = crypto.randomUUID();
  const contentId = crypto.randomUUID();

  await db.from('document_version').insert({
    id: versionId,
    tenant_id: tenantId,
    document_id: docId,
    version_no: 1,
    title,
    editor_id: userId,
    word_count: plainText.length,
  });

  await db.from('document_content').insert({
    id: contentId,
    tenant_id: tenantId,
    document_id: docId,
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
    .eq('id', docId);

  const { data: newContent } = await db
    .from('document_content')
    .select('*')
    .eq('version_id', versionId)
    .eq('tenant_id', tenantId)
    .limit(1);

  return mapContentRow(newContent![0]);
}

export async function updateDocumentMeta(
  tenantId: string,
  docId: string,
  updates: { title?: string; status?: string; tags?: string[] },
): Promise<DocumentRow | null> {
  const db = getSupabaseClient();
  const updateData: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };

  if (updates.title !== undefined) updateData.title = updates.title;
  if (updates.status !== undefined) updateData.status = updates.status;
  if (updates.tags !== undefined) updateData.tags = updates.tags;

  const { data } = await db
    .from('document')
    .update(updateData)
    .eq('id', docId)
    .eq('tenant_id', tenantId)
    .select()
    .limit(1);

  return data?.[0] ? mapDocRow(data[0]) : null;
}

function blocksToPlainText(blocks: DocumentBlock[]): string {
  return blocks
    .map((block) => {
      switch (block.type) {
        case 'heading':
          return `${'#'.repeat((block.attrs.level as number) ?? 1)} ${block.text}`;
        case 'list':
          return block.text;
        case 'table':
          return block.text;
        case 'code':
          return block.text;
        case 'quote':
          return `> ${block.text}`;
        default:
          return block.text;
      }
    })
    .join('\n');
}

async function getTemplateBlocks(tenantId: string, templateId: string): Promise<DocumentBlock[] | null> {
  const db = getSupabaseClient();
  const { data } = await db
    .from('document_template')
    .select('definition')
    .eq('id', templateId)
    .eq('tenant_id', tenantId)
    .eq('status', 'active')
    .limit(1);

  const definition = data?.[0]?.definition as { blocks?: DocumentBlock[] } | null;
  return definition?.blocks ?? null;
}

function mapDocRow(row: Record<string, unknown>): DocumentRow {
  return {
    id: row.id as string,
    tenantId: row.tenant_id as string,
    code: row.code as string,
    title: row.title as string,
    docType: row.doc_type as string,
    module: row.module as string,
    ownerId: row.owner_id as string,
    orgUnitId: row.org_unit_id as string | null,
    status: row.status as string,
    visibility: row.visibility as string,
    templateId: row.template_id as string | null,
    currentVersionId: row.current_version_id as string | null,
    aiRunId: row.ai_run_id as string | null,
    qualityScore: row.quality_score as number | null,
    tags: (row.tags as string[]) ?? [],
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

function mapContentRow(row: Record<string, unknown>): DocumentContentRow {
  return {
    id: row.id as string,
    tenantId: row.tenant_id as string,
    documentId: row.document_id as string,
    versionId: row.version_id as string,
    blocks: (row.blocks as DocumentBlock[]) ?? [],
    plainText: row.plain_text as string,
    updatedAt: row.updated_at as string,
  };
}