import { getSupabaseClient } from '@/storage/database/supabase-client';
import { embedQuery, cosineSimilarity } from './embedder';

export type RetrievalResult = {
  chunkId: string;
  docId: string;
  content: string;
  score: number;
  heading: string | null;
  pageNo: number | null;
  docTitle: string;
  metadata: Record<string, unknown>;
};

export type HybridRetrieveParams = {
  query: string;
  knowledgeBaseId: string;
  tenantId: string;
  topK?: number;
};

const VECTOR_RECALL_TOP = 20;
const KEYWORD_RECALL_TOP = 20;

function extractKeywords(query: string): string[] {
  const cleaned = query.replace(/[^\u4e00-\u9fa5a-zA-Z0-9\s]/g, ' ');
  const words = cleaned.split(/\s+/).filter((w) => w.length >= 2);
  return words;
}

async function vectorRecall(
  queryEmbedding: number[],
  kbId: string,
  tenantId: string,
): Promise<RetrievalResult[]> {
  const db = getSupabaseClient();
  const { data: chunks } = await db
    .from('knowledge_chunk')
    .select(`
      id,
      content,
      embedding,
      heading,
      page_no,
      doc_id,
      metadata,
      knowledge_doc!inner(title)
    `)
    .eq('kb_id', kbId)
    .eq('tenant_id', tenantId)
    .not('embedding', 'is', null)
    .limit(500);

  if (!chunks || chunks.length === 0) return [];

  const scored = chunks
    .map((chunk) => {
      const embedding = chunk.embedding as number[] | null;
      if (!embedding || embedding.length === 0) return null;

      const score = cosineSimilarity(queryEmbedding, embedding);
      const docJoin = chunk.knowledge_doc as unknown as { title: string } | { title: string }[];
      const docTitle = Array.isArray(docJoin) ? (docJoin[0]?.title ?? '') : (docJoin?.title ?? '');

      return {
        chunkId: chunk.id as string,
        docId: chunk.doc_id as string,
        content: chunk.content as string,
        score,
        heading: chunk.heading as string | null,
        pageNo: chunk.page_no as number | null,
        docTitle,
        metadata: (chunk.metadata as Record<string, unknown>) ?? {},
      };
    })
    .filter((r): r is RetrievalResult => r !== null)
    .sort((a, b) => b.score - a.score)
    .slice(0, VECTOR_RECALL_TOP);

  return scored;
}

async function keywordRecall(
  keywords: string[],
  kbId: string,
  tenantId: string,
): Promise<RetrievalResult[]> {
  if (keywords.length === 0) return [];

  const db = getSupabaseClient();
  const conditions = keywords.map((kw) => `content.ilike.%${kw}%`);

  const { data: chunks } = await db
    .from('knowledge_chunk')
    .select(`
      id,
      content,
      heading,
      page_no,
      doc_id,
      metadata,
      knowledge_doc!inner(title)
    `)
    .eq('kb_id', kbId)
    .eq('tenant_id', tenantId)
    .or(conditions.join(','))

    .limit(KEYWORD_RECALL_TOP * 2);

  if (!chunks || chunks.length === 0) return [];

  const scored = chunks
    .map((chunk) => {
      const content = chunk.content as string;
      let matchCount = 0;
      for (const kw of keywords) {
        if (content.toLowerCase().includes(kw.toLowerCase())) {
          matchCount++;
        }
      }
      const score = matchCount / keywords.length;
      const docJoin = chunk.knowledge_doc as unknown as { title: string } | { title: string }[];
      const docTitle = Array.isArray(docJoin) ? (docJoin[0]?.title ?? '') : (docJoin?.title ?? '');

      return {
        chunkId: chunk.id as string,
        docId: chunk.doc_id as string,
        content,
        score,
        heading: chunk.heading as string | null,
        pageNo: chunk.page_no as number | null,
        docTitle,
        metadata: (chunk.metadata as Record<string, unknown>) ?? {},
      };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, KEYWORD_RECALL_TOP);

  return scored;
}

function dedupAndRerank(
  vectorResults: RetrievalResult[],
  keywordResults: RetrievalResult[],
  topK: number,
): RetrievalResult[] {
  const merged = new Map<string, RetrievalResult>();

  for (const r of vectorResults) {
    const existing = merged.get(r.chunkId);
    if (existing) {
      existing.score = Math.max(existing.score, r.score * 0.7);
    } else {
      merged.set(r.chunkId, { ...r, score: r.score * 0.7 });
    }
  }

  for (const r of keywordResults) {
    const existing = merged.get(r.chunkId);
    if (existing) {
      existing.score = existing.score + r.score * 0.3;
    } else {
      merged.set(r.chunkId, { ...r, score: r.score * 0.3 });
    }
  }

  return Array.from(merged.values())
    .sort((a, b) => b.score - a.score)
    .slice(0, topK);
}

export async function hybridRetrieve(params: HybridRetrieveParams): Promise<RetrievalResult[]> {
  const { query, knowledgeBaseId, tenantId, topK = 6 } = params;

  if (!query.trim()) return [];

  let queryEmbedding: number[];
  try {
    queryEmbedding = await embedQuery(query, tenantId);
  } catch {
    queryEmbedding = [];
  }

  const keywords = extractKeywords(query);

  const [vectorResults, keywordResults] = await Promise.all([
    queryEmbedding.length > 0
      ? vectorRecall(queryEmbedding, knowledgeBaseId, tenantId)
      : Promise.resolve([]),
    keywordRecall(keywords, knowledgeBaseId, tenantId),
  ]);

  const finalResults = dedupAndRerank(vectorResults, keywordResults, Math.max(topK, 6));

  return finalResults;
}

export function formatRetrievalContext(results: RetrievalResult[]): string {
  if (results.length === 0) {
    return '知识库中未找到依据';
  }

  const contextParts = results.map((r, idx) => {
    const heading = r.heading ? ` [${r.heading}]` : '';
    const page = r.pageNo ? ` (第${r.pageNo}页)` : '';
    return `[引用${idx + 1}] 《${r.docTitle}》${heading}${page}:\n${r.content}`;
  });

  return contextParts.join('\n\n---\n\n');
}

export function formatReferences(results: RetrievalResult[]): Array<{
  docTitle: string;
  heading: string | null;
  pageNo: number | null;
  snippet: string;
  score: number;
}> {
  return results.map((r) => ({
    docTitle: r.docTitle,
    heading: r.heading,
    pageNo: r.pageNo,
    snippet: r.content.slice(0, 200) + (r.content.length > 200 ? '...' : ''),
    score: r.score,
  }));
}