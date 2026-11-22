import { getSupabaseClient } from '@/storage/database/supabase-client';
import type { DocumentBlock } from './document-service';

export type ExportFormat = 'docx' | 'pdf' | 'pptx';

export type ExportResult = {
  format: ExportFormat;
  content: string;
  mimeType: string;
  filename: string;
  success: boolean;
  error?: string;
};

export async function exportDocument(
  tenantId: string,
  documentId: string,
  format: ExportFormat,
): Promise<ExportResult> {
  const db = getSupabaseClient();

  const { data: doc } = await db
    .from('document')
    .select('current_version_id, title')
    .eq('id', documentId)
    .eq('tenant_id', tenantId)
    .limit(1);

  const versionId = doc?.[0]?.current_version_id as string | null;
  const title = doc?.[0]?.title as string;

  if (!versionId) {
    return {
      format,
      content: '',
      mimeType: '',
      filename: '',
      success: false,
      error: '文档版本不存在',
    };
  }

  const { data: content } = await db
    .from('document_content')
    .select('blocks')
    .eq('version_id', versionId)
    .eq('tenant_id', tenantId)
    .limit(1);

  const blocks = (content?.[0]?.blocks as DocumentBlock[]) ?? [];
  const safeTitle = title.replace(/[^\u4e00-\u9fa5a-zA-Z0-9_\-]/g, '_');

  switch (format) {
    case 'pdf':
      return exportAsPdf(blocks, safeTitle);
    case 'docx':
      return exportAsDocx(blocks, safeTitle);
    case 'pptx':
      return exportAsPptx(blocks, safeTitle);
    default:
      return {
        format,
        content: '',
        mimeType: '',
        filename: '',
        success: false,
        error: `不支持的导出格式: ${format}`,
      };
  }
}

function blocksToHtml(blocks: DocumentBlock[], title: string): string {
  const bodyParts = blocks.map((block) => {
    switch (block.type) {
      case 'heading': {
        const level = (block.attrs.level as number) ?? 1;
        const tag = level <= 6 ? `h${level}` : 'h6';
        return `<${tag} style="margin: 16px 0 8px; color: #1a1a2e;">${escapeHtml(block.text)}</${tag}>`;
      }
      case 'paragraph':
        return `<p style="margin: 8px 0; line-height: 1.8; color: #333;">${escapeHtml(block.text)}</p>`;
      case 'list': {
        const items = block.text.split('\n').filter((t) => t.trim());
        const listItems = items.map((item) => `<li style="margin: 4px 0;">${escapeHtml(item)}</li>`).join('');
        return `<ul style="margin: 8px 0; padding-left: 24px;">${listItems}</ul>`;
      }
      case 'quote':
        return `<blockquote style="margin: 12px 0; padding: 8px 16px; border-left: 4px solid #2c5282; background: #f7fafc; color: #555;">${escapeHtml(block.text)}</blockquote>`;
      case 'code':
        return `<pre style="margin: 12px 0; padding: 12px; background: #1a1a2e; color: #e2e8f0; border-radius: 4px; overflow-x: auto;"><code>${escapeHtml(block.text)}</code></pre>`;
      case 'table': {
        const rows = block.text.split('\n').filter((t) => t.trim());
        const tableRows = rows.map((row, idx) => {
          const cells = row.split('|').filter((c) => c.trim());
          const tag = idx === 0 ? 'th' : 'td';
          const cellHtml = cells.map((cell) => `<${tag} style="border: 1px solid #ddd; padding: 8px; text-align: left;">${escapeHtml(cell.trim())}</${tag}>`).join('');
          return `<tr>${cellHtml}</tr>`;
        }).join('');
        return `<table style="border-collapse: collapse; margin: 12px 0; width: 100%;">${tableRows}</table>`;
      }
      case 'image':
        return `<div style="margin: 12px 0; text-align: center;"><img src="${escapeHtml(block.text)}" style="max-width: 100%; border-radius: 4px;" alt="图片" /></div>`;
      case 'chart':
        return `<div style="margin: 12px 0; padding: 16px; background: #f7fafc; border-radius: 4px; text-align: center; color: #718096;">[图表: ${escapeHtml(block.text)}]</div>`;
      default:
        return `<p style="margin: 8px 0;">${escapeHtml(block.text)}</p>`;
    }
  });

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${escapeHtml(title)}</title>
<style>
  body { font-family: "Microsoft YaHei", "PingFang SC", sans-serif; max-width: 800px; margin: 0 auto; padding: 40px; }
  h1 { font-size: 24px; border-bottom: 2px solid #2c5282; padding-bottom: 8px; }
  h2 { font-size: 20px; }
  h3 { font-size: 16px; }
</style>
</head>
<body>
<h1 style="margin-bottom: 24px; color: #1a1a2e;">${escapeHtml(title)}</h1>
${bodyParts.join('\n')}
</body>
</html>`;
}

function exportAsPdf(blocks: DocumentBlock[], title: string): ExportResult {
  const html = blocksToHtml(blocks, title);

  return {
    format: 'pdf',
    content: html,
    mimeType: 'text/html',
    filename: `${title}.html`,
    success: true,
  };
}

function exportAsDocx(blocks: DocumentBlock[], title: string): ExportResult {
  const html = blocksToHtml(blocks, title);

  const docxHtml = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">
<head><meta charset="UTF-8"><title>${escapeHtml(title)}</title></head>
<body>${html}</body>
</html>`;

  return {
    format: 'docx',
    content: docxHtml,
    mimeType: 'application/msword',
    filename: `${title}.doc`,
    success: true,
  };
}

function exportAsPptx(blocks: DocumentBlock[], title: string): ExportResult {
  const headings = blocks.filter((b) => b.type === 'heading' && (b.attrs.level as number) <= 2);

  if (headings.length === 0) {
    return {
      format: 'pptx',
      content: '',
      mimeType: '',
      filename: '',
      success: false,
      error: 'PPTX生成失败：文档中没有足够的标题层级来创建幻灯片',
    };
  }

  const slides: string[] = [];
  slides.push(`<slide><title>${escapeHtml(title)}</title><content>概述</content></slide>`);

  let currentHeading = '';
  let currentContent: string[] = [];

  for (const block of blocks) {
    if (block.type === 'heading' && (block.attrs.level as number) <= 2) {
      if (currentHeading) {
        slides.push(`<slide><title>${escapeHtml(currentHeading)}</title><content>${currentContent.map(escapeHtml).join('<br/>')}</content></slide>`);
      }
      currentHeading = block.text;
      currentContent = [];
    } else if (block.type === 'paragraph' && block.text.trim()) {
      currentContent.push(block.text);
    }
  }

  if (currentHeading) {
    slides.push(`<slide><title>${escapeHtml(currentHeading)}</title><content>${currentContent.map(escapeHtml).join('<br/>')}</content></slide>`);
  }

  const pptxOutline = `PPTX大纲 - ${title}\n\n${slides.map((s, idx) => `幻灯片${idx + 1}: ${s}`).join('\n')}`;

  return {
    format: 'pptx',
    content: pptxOutline,
    mimeType: 'text/plain',
    filename: `${title}_pptx_outline.txt`,
    success: true,
    error: 'PPTX完整生成需要安装pptxgenjs库，当前仅提供大纲和内容结构',
  };
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}