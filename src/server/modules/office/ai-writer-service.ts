import { getGateway, type ChatMessage } from '@/server/ai/gateway';
import { getSupabaseClient } from '@/storage/database/supabase-client';
import type { DocumentBlock } from './document-service';

export type AiWriteOperation =
  | 'continue'
  | 'expand'
  | 'condense'
  | 'rewrite'
  | 'polish'
  | 'adjust_tone'
  | 'correct'
  | 'optimize_logic';

export type GenerateOutlineResult = {
  outline: string[];
  blocks: DocumentBlock[];
};

export type GenerateSectionResult = {
  blocks: DocumentBlock[];
  text: string;
};

export type AiWriteResult = {
  originalText: string;
  modifiedText: string;
  operation: AiWriteOperation;
  preview: string;
};

const DOC_TYPE_OUTLINES: Record<string, string[]> = {
  report: ['概述', '背景分析', '核心内容', '数据支撑', '结论与建议'],
  analysis: ['企业概况', '行业地位', '财务分析', '核心竞争力', '风险因素', '价值评估结论'],
  research: ['行业概述', '市场规模与增长', '竞争格局', '政策环境', '发展趋势', '投资建议'],
  minutes: ['会议信息', '参会人员', '议题与讨论', '决议事项', '后续行动项'],
  plan: ['目标', '背景', '策略', '议程安排', '预期成果', '后续跟进'],
  weekly_report: ['本周工作概述', '主要工作进展', '问题与风险', '下周计划'],
  monthly_report: ['月度工作总结', '关键指标完成情况', '重点事项回顾', '问题分析与改进', '下月工作计划'],
};

const OPERATION_PROMPTS: Record<AiWriteOperation, string> = {
  continue: '请续写以下内容，保持风格一致，自然延伸：',
  expand: '请扩写以下内容，增加更多细节和论述，保持原意不变：',
  condense: '请缩写以下内容，保留核心信息，去除冗余：',
  rewrite: '请改写以下内容，用不同的表达方式传达相同含义：',
  polish: '请润色以下内容，提升文字质量和可读性，但保持原意不变：',
  adjust_tone: '请调整以下内容的语气，使其更加专业正式：',
  correct: '请纠正以下内容中的语法、用词和表达错误：',
  optimize_logic: '请优化以下内容的逻辑结构，使论述更加清晰有条理：',
};

export async function generateDocumentOutline(
  tenantId: string,
  documentType: string,
  context?: string,
): Promise<GenerateOutlineResult> {
  const presetOutline = DOC_TYPE_OUTLINES[documentType] ?? DOC_TYPE_OUTLINES.report;

  const gateway = getGateway();
  const systemPrompt = `你是一个专业的文档大纲生成助手。请根据文档类型和上下文生成一份结构化大纲。

要求：
1. 大纲应包含4-8个主要章节
2. 每个章节标题简洁明确
3. 返回JSON格式：{"outline": ["章节1", "章节2", ...]}`;

  const userContent = `文档类型: ${documentType}\n上下文: ${context ?? '无'}\n预设大纲参考: ${presetOutline.join('、')}`;

  const messages: ChatMessage[] = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userContent },
  ];

  try {
    const result = await gateway.chat({
      tenantId,
      taskType: 'document_outline',
      chatParams: {
        messages,
        temperature: 0.5,
        maxTokens: 512,
      },
    });

    const outline = parseOutlineFromResponse(result.text, presetOutline);
    const blocks: DocumentBlock[] = [
      { type: 'heading', attrs: { level: 1 }, text: context ?? documentType },
      ...outline.map((section) => ({
        type: 'heading' as const,
        attrs: { level: 2 },
        text: section,
      })),
      { type: 'paragraph', attrs: {}, text: '' },
    ];

    return { outline, blocks };
  } catch {
    const blocks: DocumentBlock[] = [
      { type: 'heading', attrs: { level: 1 }, text: context ?? documentType },
      ...presetOutline.map((section) => ({
        type: 'heading' as const,
        attrs: { level: 2 },
        text: section,
      })),
      { type: 'paragraph', attrs: {}, text: '' },
    ];

    return { outline: presetOutline, blocks };
  }
}

export async function generateDocumentSection(
  tenantId: string,
  documentId: string,
  sectionIndex: number,
): Promise<GenerateSectionResult> {
  const db = getSupabaseClient();

  const { data: doc } = await db
    .from('document')
    .select('current_version_id, title, doc_type')
    .eq('id', documentId)
    .limit(1);

  const versionId = doc?.[0]?.current_version_id as string | null;
  const docTitle = doc?.[0]?.title as string;
  const docType = doc?.[0]?.doc_type as string;

  if (!versionId) {
    throw new Error('文档当前版本不存在');
  }

  const { data: content } = await db
    .from('document_content')
    .select('blocks')
    .eq('version_id', versionId)
    .limit(1);

  const blocks = (content?.[0]?.blocks as DocumentBlock[]) ?? [];
  const headings = blocks.filter((b) => b.type === 'heading');
  const targetHeading = headings[sectionIndex];

  if (!targetHeading) {
    throw new Error(`章节索引 ${sectionIndex} 不存在`);
  }

  const sectionTitle = targetHeading.text;
  const previousContent = blocks
    .slice(0, sectionIndex + 1)
    .map((b) => `${b.type === 'heading' ? `## ${b.text}` : b.text}`)
    .join('\n');

  const gateway = getGateway();
  const systemPrompt = `你是一个专业的文档内容生成助手。请为指定章节生成内容。

要求：
1. 内容紧扣章节标题，专业准确
2. 字数200-500字
3. 保持与文档整体风格一致
4. 如果涉及数据，标注"需核实"`;

  const userContent = `文档标题: ${docTitle}\n文档类型: ${docType}\n章节标题: ${sectionTitle}\n已有内容:\n${previousContent}`;

  const messages: ChatMessage[] = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userContent },
  ];

  const result = await gateway.chat({
    tenantId,
    taskType: 'document_section',
    chatParams: {
      messages,
      temperature: 0.6,
      maxTokens: 800,
    },
  });

  const newBlocks: DocumentBlock[] = [
    targetHeading,
    { type: 'paragraph', attrs: {}, text: result.text },
  ];

  return { blocks: newBlocks, text: result.text };
}

export async function aiWriteOperation(
  tenantId: string,
  documentId: string,
  operation: AiWriteOperation,
  selectedText: string,
  context?: string,
): Promise<AiWriteResult> {
  if (!selectedText.trim()) {
    throw new Error('选中文本不能为空');
  }

  const db = getSupabaseClient();

  let fullContext = '';
  if (documentId) {
    const { data: doc } = await db
      .from('document')
      .select('current_version_id, title')
      .eq('id', documentId)
      .limit(1);

    const versionId = doc?.[0]?.current_version_id as string | null;
    const docTitle = doc?.[0]?.title as string;

    if (versionId) {
      const { data: content } = await db
        .from('document_content')
        .select('blocks')
        .eq('version_id', versionId)
        .limit(1);

      const blocks = (content?.[0]?.blocks as DocumentBlock[]) ?? [];
      fullContext = blocks
        .map((b) => `${b.type === 'heading' ? `## ${b.text}` : b.text}`)
        .join('\n');
    }

    fullContext = `文档标题: ${docTitle}\n完整内容:\n${fullContext}`;
  }

  if (context) {
    fullContext += `\n附加上下文: ${context}`;
  }

  const gateway = getGateway();
  const operationPrompt = OPERATION_PROMPTS[operation];

  const systemPrompt = `你是一个专业的文档编辑助手。${operationPrompt}

要求：
1. 必须接收完整上下文来理解文档背景
2. 修改后的内容保持与原文风格一致
3. 只返回修改后的文本，不要包含解释说明
4. 保留原文的核心含义和关键信息`;

  const userContent = `完整上下文:\n${fullContext}\n\n需要${operationPrompt}\n\n选中文本:\n${selectedText}`;

  const messages: ChatMessage[] = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userContent },
  ];

  const result = await gateway.chat({
    tenantId,
    taskType: 'document_write',
    chatParams: {
      messages,
      temperature: 0.5,
      maxTokens: 1024,
    },
  });

  return {
    originalText: selectedText,
    modifiedText: result.text,
    operation,
    preview: result.text,
  };
}

function parseOutlineFromResponse(text: string, fallback: string[]): string[] {
  try {
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      if (Array.isArray(parsed.outline)) {
        return parsed.outline as string[];
      }
    }
  } catch {
    // JSON解析失败，尝试按行解析
  }

  const lines = text.split('\n')
    .map((line) => line.replace(/^\d+[\.\)]\s*/, '').replace(/^[-*]\s*/, '').trim())
    .filter((line) => line.length > 0 && line.length < 50);

  if (lines.length >= 3) {
    return lines;
  }

  return fallback;
}