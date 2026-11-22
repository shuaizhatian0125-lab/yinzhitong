import { NextRequest } from 'next/server';
import { z } from 'zod';
import { success, error, ErrorCode, jsonResponse } from '@/lib/api-response';
import { getCurrentUserFromJwt } from '@/lib/auth';
import {
  generateDocumentOutline,
  generateDocumentSection,
  aiWriteOperation,
  type AiWriteOperation,
} from '@/server/modules/office/ai-writer-service';

const generateSchema = z.object({
  action: z.enum(['outline', 'section', 'write']),
  documentType: z.string().optional(),
  context: z.string().optional(),
  sectionIndex: z.number().int().min(0).optional(),
  operation: z.enum([
    'continue', 'expand', 'condense', 'rewrite',
    'polish', 'adjust_tone', 'correct', 'optimize_logic',
  ]).optional(),
  selectedText: z.string().optional(),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const user = await getCurrentUserFromJwt(request);
  if (!user) {
    return jsonResponse(error(ErrorCode.UNAUTHORIZED, '未登录或登录已过期'), 401);
  }

  const { id } = await params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonResponse(error(ErrorCode.BAD_REQUEST, '请求体格式错误'), 400);
  }

  const parsed = generateSchema.safeParse(body);
  if (!parsed.success) {
    return jsonResponse(
      error(ErrorCode.BAD_REQUEST, '参数校验失败', {
        issues: parsed.error.issues.map((i) => ({ path: i.path, message: i.message })),
      }),
      400,
    );
  }

  try {
    const { action, documentType, context, sectionIndex, operation, selectedText } = parsed.data;

    if (action === 'outline') {
      const result = await generateDocumentOutline(
        user.tenantId,
        documentType ?? 'report',
        context,
      );
      return jsonResponse(success(result));
    }

    if (action === 'section') {
      if (sectionIndex === undefined) {
        return jsonResponse(error(ErrorCode.BAD_REQUEST, 'sectionIndex 不能为空'), 400);
      }
      const result = await generateDocumentSection(user.tenantId, id, sectionIndex);
      return jsonResponse(success(result));
    }

    if (action === 'write') {
      if (!operation || !selectedText) {
        return jsonResponse(error(ErrorCode.BAD_REQUEST, 'operation 和 selectedText 不能为空'), 400);
      }
      const result = await aiWriteOperation(
        user.tenantId,
        id,
        operation as AiWriteOperation,
        selectedText,
        context,
      );
      return jsonResponse(success(result));
    }

    return jsonResponse(error(ErrorCode.BAD_REQUEST, '未知的 action 类型'), 400);
  } catch (err) {
    return jsonResponse(
      error(ErrorCode.INTERNAL_ERROR, err instanceof Error ? err.message : 'AI生成失败'),
      500,
    );
  }
}