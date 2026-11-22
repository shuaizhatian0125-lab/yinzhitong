import { getGateway } from '@/server/ai/gateway';
import type { KnowledgeChunk } from './chunker';

export type EmbedResult = {
  chunkId: string;
  embedding: number[];
  success: boolean;
  error?: string;
};

export async function embedChunks(
  chunks: KnowledgeChunk[],
  tenantId: string,
): Promise<EmbedResult[]> {
  const gateway = getGateway();
  const results: EmbedResult[] = [];

  for (const chunk of chunks) {
    try {
      const embedding = await gateway.embed({
        tenantId,
        text: chunk.content,
        taskType: 'embed',
      });

      results.push({
        chunkId: chunk.id,
        embedding,
        success: true,
      });
    } catch (err) {
      results.push({
        chunkId: chunk.id,
        embedding: [],
        success: false,
        error: err instanceof Error ? err.message : '向量化失败',
      });
    }
  }

  return results;
}

export async function embedQuery(query: string, tenantId: string): Promise<number[]> {
  const gateway = getGateway();
  return gateway.embed({
    tenantId,
    text: query,
    taskType: 'embed',
  });
}

export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length === 0) return 0;

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  const denominator = Math.sqrt(normA) * Math.sqrt(normB);
  if (denominator === 0) return 0;

  return dotProduct / denominator;
}