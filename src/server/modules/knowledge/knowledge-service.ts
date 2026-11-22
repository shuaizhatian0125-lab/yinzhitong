import { getSupabaseClient } from '@/storage/database/supabase-client';
import { getGateway, type ChatMessage } from '@/server/ai/gateway';
import { parseDocument, type UploadedFile } from '@/server/ai/rag/parser';
import { chunkText, type KnowledgeChunk } from '@/server/ai/rag/chunker';
import { embedChunks } from '@/server/ai/rag/embedder';
import {
  hybridRetrieve,
  formatRetrievalContext,
  formatReferences,
  type RetrievalResult,
} from '@/server/ai/rag/retriever';

export type KnowledgeBaseRow = {
  id: string;
  tenantId: string;
  code: string;
  name: string;
  description: string | null;
  ownerId: string | null;
  orgUnitId: string | null;
  visibility: string;
  embeddingModel: string;
  status: string;
  createdAt: string;
};

export type KnowledgeDocRow = {
  id: string;
  tenantId: string;
  kbId: string;
  fileId: string | null;
  title: string;
  sourceType: string;
  sourceUrl: string | null;
  status: string;
  chunkCount: number;
  error: string | null;
  metadata: Record<string, unknown>;
  createdBy: string | null;
  createdAt: string;
};

export type QueryResult = {
  answer: string;
  confidence: 'high' | 'medium' | 'low';
  references: Array<{
    docTitle: string;
    heading: string | null;
    pageNo: number | null;
    snippet: string;
    score: number;
  }>;
  hasKnowledgeBasis: boolean;
};

export async function createKnowledgeBase(
  tenantId: string,
  userId: string,
  name: string,
  description?: string,
): Promise<KnowledgeBaseRow> {
  const db = getSupabaseClient();
  const id = crypto.randomUUID();
  const code = `kb_${Date.now().toString(36)}`;

  const { data, error: err } = await db
    .from('knowledge_base')
    .insert({
      id,
      tenant_id: tenantId,
      code,
      name,
      description: description ?? null,
      owner_id: userId,
      visibility: 'org',
      embedding_model: 'default',
      status: 'active',
    })
    .select()
    .single();

  if (err || !data) {
    throw new Error(`创建知识库失败: ${err?.message ?? '未知错误'}`);
  }

  return mapKbRow(data);
}

export async function listKnowledgeBases(tenantId: string): Promise<KnowledgeBaseRow[]> {
  const db = getSupabaseClient();
  const { data } = await db
    .from('knowledge_base')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('status', 'active')
    .order('created_at', { ascending: false });

  return (data ?? []).map(mapKbRow);
}

export async function getKnowledgeBase(
  tenantId: string,
  id: string,
): Promise<KnowledgeBaseRow | null> {
  const db = getSupabaseClient();
  const { data } = await db
    .from('knowledge_base')
    .select('*')
    .eq('id', id)
    .eq('tenant_id', tenantId)
    .limit(1);

  return data?.[0] ? mapKbRow(data[0]) : null;
}

export async function listDocuments(
  tenantId: string,
  kbId: string,
): Promise<KnowledgeDocRow[]> {
  const db = getSupabaseClient();
  const { data } = await db
    .from('knowledge_doc')
    .select('*')
    .eq('kb_id', kbId)
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false });

  return (data ?? []).map(mapDocRow);
}

export async function getDocument(
  tenantId: string,
  docId: string,
): Promise<KnowledgeDocRow | null> {
  const db = getSupabaseClient();
  const { data } = await db
    .from('knowledge_doc')
    .select('*')
    .eq('id', docId)
    .eq('tenant_id', tenantId)
    .limit(1);

  return data?.[0] ? mapDocRow(data[0]) : null;
}

export async function uploadDocument(
  tenantId: string,
  userId: string,
  kbId: string,
  file: UploadedFile,
): Promise<KnowledgeDocRow> {
  const db = getSupabaseClient();
  const docId = crypto.randomUUID();

  const { data: docRow, error: insertErr } = await db
    .from('knowledge_doc')
    .insert({
      id: docId,
      tenant_id: tenantId,
      kb_id: kbId,
      title: file.name,
      source_type: 'upload',
      status: 'pending',
      chunk_count: 0,
      metadata: {},
      created_by: userId,
    })
    .select()
    .single();

  if (insertErr || !docRow) {
    throw new Error(`创建知识文档记录失败: ${insertErr?.message ?? '未知错误'}`);
  }

  try {
    const parseResult = await parseDocument(file);

    if (parseResult.status === 'failed') {
      await db
        .from('knowledge_doc')
        .update({
          status: 'failed',
          error: parseResult.error ?? '解析失败',
          metadata: parseResult.metadata,
        })
        .eq('id', docId);

      return mapDocRow({
        ...docRow,
        status: 'failed',
        error: parseResult.error,
        metadata: parseResult.metadata,
      });
    }

    const chunks = chunkText(parseResult.content, {
      docId,
      kbId,
      source: file.name,
      pageNo: parseResult.metadata.pageCount > 1 ? 1 : null,
    });

    if (chunks.length === 0) {
      await db
        .from('knowledge_doc')
        .update({
          status: 'failed',
          error: '文档切片后无有效内容',
          metadata: parseResult.metadata,
        })
        .eq('id', docId);

      return mapDocRow({
        ...docRow,
        status: 'failed',
        error: '文档切片后无有效内容',
        metadata: parseResult.metadata,
      });
    }

    const embedResults = await embedChunks(chunks, tenantId);

    const chunkRows = chunks.map((chunk, idx) => ({
      id: chunk.id,
      tenant_id: tenantId,
      kb_id: kbId,
      doc_id: docId,
      seq: idx,
      content: chunk.content,
      tokens: chunk.tokens,
      heading: chunk.metadata.heading,
      page_no: chunk.metadata.pageNo,
      embedding: embedResults[idx]?.success ? embedResults[idx].embedding : null,
      metadata: {
        ...chunk.metadata,
        sourceFile: file.name,
        sourceType: parseResult.metadata.sourceType,
      },
    }));

    const { error: chunkInsertErr } = await db
      .from('knowledge_chunk')
      .insert(chunkRows);

    if (chunkInsertErr) {
      throw new Error(`切片存储失败: ${chunkInsertErr.message}`);
    }

    const successCount = embedResults.filter((r) => r.success).length;
    const finalStatus = successCount === chunks.length ? 'ready' : 'partial';

    await db
      .from('knowledge_doc')
      .update({
        status: finalStatus,
        chunk_count: chunks.length,
        metadata: {
          ...parseResult.metadata,
          embedSuccess: successCount,
          embedTotal: chunks.length,
        },
        error: successCount < chunks.length
          ? `${chunks.length - successCount}个切片向量化失败`
          : null,
      })
      .eq('id', docId);

    return mapDocRow({
      ...docRow,
      status: finalStatus,
      chunk_count: chunks.length,
      metadata: {
        ...parseResult.metadata,
        embedSuccess: successCount,
        embedTotal: chunks.length,
      },
    });
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : '文档处理过程中发生未知错误';
    await db
      .from('knowledge_doc')
      .update({
        status: 'failed',
        error: errorMsg,
      })
      .eq('id', docId);

    return mapDocRow({
      ...docRow,
      status: 'failed',
      error: errorMsg,
    });
  }
}

export async function queryKnowledge(
  tenantId: string,
  userId: string,
  kbId: string,
  question: string,
): Promise<QueryResult> {
  const db = getSupabaseClient();

  const results = await hybridRetrieve({
    query: question,
    knowledgeBaseId: kbId,
    tenantId,
    topK: 6,
  });

  await db.from('knowledge_qa_log').insert({
    id: crypto.randomUUID(),
    tenant_id: tenantId,
    kb_id: kbId,
    user_id: userId,
    question,
    refs: formatReferences(results),
    created_at: new Date().toISOString(),
  });

  if (results.length === 0) {
    return {
      answer: '知识库中未找到与您问题相关的依据。请尝试更换关键词或上传更多相关文档。',
      confidence: 'low',
      references: [],
      hasKnowledgeBasis: false,
    };
  }

  const context = formatRetrievalContext(results);
  const references = formatReferences(results);

  const hasHighScoreResults = results.some((r) => r.score > 0.5);
  const confidence: 'high' | 'medium' | 'low' = hasHighScoreResults ? 'high' : 'medium';

  const gateway = getGateway();
  const systemPrompt = `你是一个专业的知识库问答助手。请基于以下检索到的知识库内容回答用户问题。

要求：
1. 回答必须基于检索到的内容，不得编造信息
2. 如果检索内容无法回答问题，明确说明"知识库中未找到依据"
3. 回答时标注引用来源（文档名+页码）
4. 保持专业、准确、简洁

检索到的知识库内容：
${context}`;

  const messages: ChatMessage[] = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: question },
  ];

  try {
    const chatResult = await gateway.chat({
      tenantId,
      taskType: 'knowledge_qa',
      chatParams: {
        messages,
        temperature: 0.3,
        maxTokens: 1024,
      },
    });

    await db
      .from('knowledge_qa_log')
      .update({ answer: chatResult.text })
      .eq('kb_id', kbId)
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(1);

    return {
      answer: chatResult.text,
      confidence,
      references,
      hasKnowledgeBasis: true,
    };
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : 'AI服务调用失败';
    return {
      answer: `知识库检索到了相关内容，但AI生成回答时出错: ${errorMsg}`,
      confidence: 'low',
      references,
      hasKnowledgeBasis: true,
    };
  }
}

function mapKbRow(row: Record<string, unknown>): KnowledgeBaseRow {
  return {
    id: row.id as string,
    tenantId: row.tenant_id as string,
    code: row.code as string,
    name: row.name as string,
    description: row.description as string | null,
    ownerId: row.owner_id as string | null,
    orgUnitId: row.org_unit_id as string | null,
    visibility: row.visibility as string,
    embeddingModel: row.embedding_model as string,
    status: row.status as string,
    createdAt: row.created_at as string,
  };
}

function mapDocRow(row: Record<string, unknown>): KnowledgeDocRow {
  return {
    id: row.id as string,
    tenantId: row.tenant_id as string,
    kbId: row.kb_id as string,
    fileId: row.file_id as string | null,
    title: row.title as string,
    sourceType: row.source_type as string,
    sourceUrl: row.source_url as string | null,
    status: row.status as string,
    chunkCount: row.chunk_count as number,
    error: row.error as string | null,
    metadata: (row.metadata as Record<string, unknown>) ?? {},
    createdBy: row.created_by as string | null,
    createdAt: row.created_at as string,
  };
}