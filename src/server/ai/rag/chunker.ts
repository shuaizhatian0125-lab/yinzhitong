export type ChunkMetadata = {
  docId: string;
  kbId: string;
  heading: string | null;
  pageNo: number | null;
  section: string | null;
  department: string | null;
  sensitivity: string | null;
  validUntil: string | null;
  source: string | null;
  seq: number;
};

export type KnowledgeChunk = {
  id: string;
  content: string;
  tokens: number;
  metadata: ChunkMetadata;
};

const TARGET_TOKENS = 512;
const MIN_TOKENS = 384;
const MAX_TOKENS = 640;
const OVERLAP_RATIO = 0.15;

function estimateTokens(text: string): number {
  return Math.ceil(text.length / 3.5);
}

function detectHeading(line: string): string | null {
  const headingPatterns = [
    /^#{1,6}\s+(.+)$/,
    /^第[一二三四五六七八九十]+[章节条]\s*(.+)$/,
    /^\d+(\.\d+)*\s+(.+)$/,
    /^[一二三四五六七八九十]+、\s*(.+)$/,
  ];

  for (const pattern of headingPatterns) {
    const match = line.match(pattern);
    if (match) {
      return match[1] || match[0];
    }
  }

  if (line.length < 50 && line.trim().length > 0 && !line.endsWith('。') && !line.endsWith('，')) {
    return line.trim();
  }

  return null;
}

function splitByHeadings(content: string): Array<{ text: string; heading: string | null }> {
  const lines = content.split('\n');
  const sections: Array<{ text: string; heading: string | null }> = [];
  let currentHeading: string | null = null;
  let currentLines: string[] = [];

  for (const line of lines) {
    const heading = detectHeading(line);
    if (heading) {
      if (currentLines.length > 0) {
        sections.push({
          text: currentLines.join('\n'),
          heading: currentHeading,
        });
      }
      currentHeading = heading;
      currentLines = [line];
    } else {
      currentLines.push(line);
    }
  }

  if (currentLines.length > 0) {
    sections.push({
      text: currentLines.join('\n'),
      heading: currentHeading,
    });
  }

  return sections;
}

function splitByTokenSize(
  text: string,
  heading: string | null,
  metadata: Partial<ChunkMetadata>,
): KnowledgeChunk[] {
  const tokens = estimateTokens(text);

  if (tokens <= MAX_TOKENS) {
    return [
      {
        id: crypto.randomUUID(),
        content: text.trim(),
        tokens,
        metadata: {
          docId: metadata.docId ?? '',
          kbId: metadata.kbId ?? '',
          heading,
          pageNo: metadata.pageNo ?? null,
          section: metadata.section ?? null,
          department: metadata.department ?? null,
          sensitivity: metadata.sensitivity ?? null,
          validUntil: metadata.validUntil ?? null,
          source: metadata.source ?? null,
          seq: metadata.seq ?? 0,
        },
      },
    ];
  }

  const chunks: KnowledgeChunk[] = [];
  const sentences = text.split(/(?<=[。！？；\n])/);
  let currentChunk = '';
  let currentTokens = 0;
  const overlapTokens = Math.floor(TARGET_TOKENS * OVERLAP_RATIO);

  for (const sentence of sentences) {
    const sentenceTokens = estimateTokens(sentence);

    if (currentTokens + sentenceTokens > MAX_TOKENS && currentChunk) {
      chunks.push({
        id: crypto.randomUUID(),
        content: currentChunk.trim(),
        tokens: currentTokens,
        metadata: {
          docId: metadata.docId ?? '',
          kbId: metadata.kbId ?? '',
          heading,
          pageNo: metadata.pageNo ?? null,
          section: metadata.section ?? null,
          department: metadata.department ?? null,
          sensitivity: metadata.sensitivity ?? null,
          validUntil: metadata.validUntil ?? null,
          source: metadata.source ?? null,
          seq: metadata.seq ?? 0,
        },
      });

      const overlapText = currentChunk.slice(-Math.floor(overlapTokens * 3.5));
      currentChunk = overlapText + sentence;
      currentTokens = estimateTokens(currentChunk);
    } else {
      currentChunk += sentence;
      currentTokens += sentenceTokens;
    }
  }

  if (currentChunk.trim()) {
    chunks.push({
      id: crypto.randomUUID(),
      content: currentChunk.trim(),
      tokens: currentTokens,
      metadata: {
        docId: metadata.docId ?? '',
        kbId: metadata.kbId ?? '',
        heading,
        pageNo: metadata.pageNo ?? null,
        section: metadata.section ?? null,
        department: metadata.department ?? null,
        sensitivity: metadata.sensitivity ?? null,
        validUntil: metadata.validUntil ?? null,
        source: metadata.source ?? null,
        seq: metadata.seq ?? 0,
      },
    });
  }

  return chunks;
}

export function chunkText(
  content: string,
  metadata: {
    docId: string;
    kbId: string;
    department?: string | null;
    sensitivity?: string | null;
    validUntil?: string | null;
    source?: string | null;
    pageNo?: number | null;
  },
): KnowledgeChunk[] {
  if (!content || content.trim().length === 0) {
    return [];
  }

  const sections = splitByHeadings(content);
  const allChunks: KnowledgeChunk[] = [];
  let seq = 0;

  for (const section of sections) {
    const sectionChunks = splitByTokenSize(section.text, section.heading, {
      docId: metadata.docId,
      kbId: metadata.kbId,
      department: metadata.department ?? null,
      sensitivity: metadata.sensitivity ?? null,
      validUntil: metadata.validUntil ?? null,
      source: metadata.source ?? null,
      pageNo: metadata.pageNo ?? null,
      section: section.heading,
      seq,
    });

    for (const chunk of sectionChunks) {
      chunk.metadata.seq = seq++;
      allChunks.push(chunk);
    }
  }

  return allChunks;
}