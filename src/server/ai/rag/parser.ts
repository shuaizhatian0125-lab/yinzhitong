import { randomUUID } from 'node:crypto';

export type ParseResult = {
  content: string;
  metadata: {
    title: string;
    sourceType: string;
    pageCount: number;
    fileSize: number;
    mimeType: string;
    [key: string]: unknown;
  };
  status: 'success' | 'failed' | 'partial';
  error?: string;
};

export type UploadedFile = {
  name: string;
  buffer: Buffer;
  mimeType: string;
  size: number;
};

async function parsePdf(buffer: Buffer): Promise<{ text: string; pageCount: number }> {
  const { PDFParse } = await import('pdf-parse');
  const parser = new PDFParse({ data: buffer });
  const result = await parser.getText();
  return {
    text: result.text ?? '',
    pageCount: result.total ?? 1,
  };
}

function parsePlainText(buffer: Buffer): string {
  return buffer.toString('utf-8');
}

function parseMarkdown(buffer: Buffer): string {
  return buffer.toString('utf-8');
}

async function parseImageOcr(buffer: Buffer, fileName: string): Promise<string> {
  return `[图片文件: ${fileName}] - OCR解析需要配置OCR服务，当前暂不支持图片文字提取`;
}

function detectFileType(mimeType: string, fileName: string): string {
  if (mimeType.includes('pdf')) return 'pdf';
  if (mimeType.includes('word') || fileName.endsWith('.docx') || fileName.endsWith('.doc')) return 'word';
  if (mimeType.includes('excel') || fileName.endsWith('.xlsx') || fileName.endsWith('.xls')) return 'excel';
  if (mimeType.includes('powerpoint') || fileName.endsWith('.pptx') || fileName.endsWith('.ppt')) return 'ppt';
  if (mimeType.startsWith('image/')) return 'image';
  if (mimeType.includes('markdown') || fileName.endsWith('.md')) return 'markdown';
  if (mimeType.includes('text') || fileName.endsWith('.txt')) return 'text';
  if (fileName.endsWith('.csv')) return 'csv';
  return 'unknown';
}

export async function parseDocument(file: UploadedFile): Promise<ParseResult> {
  const fileType = detectFileType(file.mimeType, file.name);
  const baseMetadata = {
    title: file.name,
    sourceType: fileType,
    pageCount: 1,
    fileSize: file.size,
    mimeType: file.mimeType,
    fileName: file.name,
  };

  try {
    switch (fileType) {
      case 'pdf': {
        const { text, pageCount } = await parsePdf(file.buffer);
        if (!text || text.trim().length === 0) {
          return {
            content: '',
            metadata: { ...baseMetadata, pageCount },
            status: 'failed',
            error: 'PDF解析成功但未提取到任何文本内容（可能是扫描件或图片型PDF）',
          };
        }
        return {
          content: text,
          metadata: { ...baseMetadata, pageCount },
          status: 'success',
        };
      }

      case 'text':
      case 'csv': {
        const text = parsePlainText(file.buffer);
        if (!text.trim()) {
          return {
            content: '',
            metadata: baseMetadata,
            status: 'failed',
            error: '文件内容为空',
          };
        }
        return {
          content: text,
          metadata: baseMetadata,
          status: 'success',
        };
      }

      case 'markdown': {
        const text = parseMarkdown(file.buffer);
        if (!text.trim()) {
          return {
            content: '',
            metadata: baseMetadata,
            status: 'failed',
            error: '文件内容为空',
          };
        }
        return {
          content: text,
          metadata: baseMetadata,
          status: 'success',
        };
      }

      case 'word':
      case 'excel':
      case 'ppt': {
        const text = parsePlainText(file.buffer);
        const hasReadableText = text.trim().length > 0 && !text.includes('\0');
        if (hasReadableText) {
          return {
            content: text,
            metadata: { ...baseMetadata, status: 'partial' },
            status: 'partial',
            error: `${fileType.toUpperCase}格式文档仅提取了部分文本，完整解析需要专用解析器`,
          };
        }
        return {
          content: '',
          metadata: baseMetadata,
          status: 'failed',
          error: `${fileType.toUpperCase()}格式文档无法直接解析，需要安装专用解析器（如mammoth、xlsx等）`,
        };
      }

      case 'image': {
        const ocrText = await parseImageOcr(file.buffer, file.name);
        return {
          content: ocrText,
          metadata: baseMetadata,
          status: 'partial',
          error: '图片OCR解析暂未配置，需要接入OCR服务',
        };
      }

      default: {
        const text = parsePlainText(file.buffer);
        if (text.trim() && !text.includes('\0')) {
          return {
            content: text,
            metadata: baseMetadata,
            status: 'partial',
            error: `未知文件类型(${file.mimeType})，尝试以纯文本方式解析`,
          };
        }
        return {
          content: '',
          metadata: baseMetadata,
          status: 'failed',
          error: `不支持的文件类型: ${file.mimeType}`,
        };
      }
    }
  } catch (err) {
    return {
      content: '',
      metadata: baseMetadata,
      status: 'failed',
      error: err instanceof Error ? err.message : '文档解析过程中发生未知错误',
    };
  }
}

export function generateDocId(): string {
  return randomUUID();
}