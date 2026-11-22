import { NextRequest } from 'next/server';
import { z } from 'zod';
import { success, error, ErrorCode, jsonResponse } from '@/lib/api-response';
import { getCurrentUserFromJwt } from '@/lib/auth';
import {
  getDocumentContent,
  updateDocumentContent,
  type DocumentBlock,
} from '@/server/modules/office/document-service';

const blockSchema = z.object({
  type: z.enum(['heading', 'paragraph', 'list', 'table', 'image', 'chart', 'quote', 'code']),
  attrs: z.record(z.string(), z.unknown()).default({}),
  text: z.string().default(''),
});

const putSchema = z.object({
  blocks: z.array(blockSchema).min(0),
});

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const user = await getCurrentUserFromJwt(request);
  if (!user) {
    return jsonResponse(error(ErrorCode.UNAUTHORIZED, '未登录或登录已过期'), 401);
  }

  const { id } = await params;

  try {
    const content = await getDocumentContent(user.tenantId, id);
    if (!content) {
      return jsonResponse(error(ErrorCode.NOT_FOUND, '文档内容不存在'), 404);
    }
    return jsonResponse(success(content));
  } catch (err) {
    return jsonResponse(
      error(ErrorCode.INTERNAL_ERROR, err instanceof Error ? err.message : '获取文档内容失败'),
      500,
    );
  }
}

export async function PUT(
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

  const parsed = putSchema.safeParse(body);
  if (!parsed.success) {
    return jsonResponse(
      error(ErrorCode.BAD_REQUEST, '参数校验失败', {
        issues: parsed.error.issues.map((i) => ({ path: i.path, message: i.message })),
      }),
      400,
    );
  }

  try {
    const content = await updateDocumentContent(
      user.tenantId,
      user.id,
      id,
      parsed.data.blocks as DocumentBlock[],
    );
    return jsonResponse(success(content));
  } catch (err) {
    return jsonResponse(
      error(ErrorCode.INTERNAL_ERROR, err instanceof Error ? err.message : '更新文档内容失败'),
      500,
    );
  }
}