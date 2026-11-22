import { NextRequest } from 'next/server';
import { z } from 'zod';
import { success, error, ErrorCode, jsonResponse } from '@/lib/api-response';
import { getCurrentUserFromJwt } from '@/lib/auth';
import {
  createKnowledgeBase,
  listKnowledgeBases,
} from '@/server/modules/knowledge/knowledge-service';

const createSchema = z.object({
  name: z.string().min(1, '名称不能为空').max(128),
  description: z.string().max(500).optional(),
});

export async function GET(request: NextRequest): Promise<Response> {
  const user = await getCurrentUserFromJwt(request);
  if (!user) {
    return jsonResponse(error(ErrorCode.UNAUTHORIZED, '未登录或登录已过期'), 401);
  }

  try {
    const bases = await listKnowledgeBases(user.tenantId);
    return jsonResponse(success(bases));
  } catch (err) {
    return jsonResponse(
      error(ErrorCode.INTERNAL_ERROR, err instanceof Error ? err.message : '获取知识库列表失败'),
      500,
    );
  }
}

export async function POST(request: NextRequest): Promise<Response> {
  const user = await getCurrentUserFromJwt(request);
  if (!user) {
    return jsonResponse(error(ErrorCode.UNAUTHORIZED, '未登录或登录已过期'), 401);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonResponse(error(ErrorCode.BAD_REQUEST, '请求体格式错误'), 400);
  }

  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return jsonResponse(
      error(ErrorCode.BAD_REQUEST, '参数校验失败', {
        issues: parsed.error.issues.map((i) => ({ path: i.path, message: i.message })),
      }),
      400,
    );
  }

  try {
    const kb = await createKnowledgeBase(
      user.tenantId,
      user.id,
      parsed.data.name,
      parsed.data.description,
    );
    return jsonResponse(success(kb), 201);
  } catch (err) {
    return jsonResponse(
      error(ErrorCode.INTERNAL_ERROR, err instanceof Error ? err.message : '创建知识库失败'),
      500,
    );
  }
}