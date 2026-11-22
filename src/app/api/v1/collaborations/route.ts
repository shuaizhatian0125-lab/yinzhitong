import { NextRequest } from 'next/server';
import { z } from 'zod';
import { success, error, ErrorCode, jsonResponse } from '@/lib/api-response';
import { getCurrentUserFromJwt } from '@/lib/auth';
import { listCollaborations, createCollaboration, type CollaborationType } from '@/server/modules/collab/collaboration-service';

const listSchema = z.object({
  status: z.string().optional(),
  type: z.string().optional(),
  keyword: z.string().optional(),
  member_id: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  page_size: z.coerce.number().int().min(1).max(100).default(20),
});

const createSchema = z.object({
  title: z.string().min(1, '协同事项标题不能为空'),
  description: z.string().optional(),
  type: z.string().optional(),
  member_ids: z.array(z.string()).optional(),
});

export async function GET(request: NextRequest): Promise<Response> {
  const user = await getCurrentUserFromJwt(request);
  if (!user) {
    return jsonResponse(error(ErrorCode.UNAUTHORIZED, '未登录或登录已过期'), 401);
  }

  const params = Object.fromEntries(request.nextUrl.searchParams.entries());
  const parsed = listSchema.safeParse(params);
  if (!parsed.success) {
    return jsonResponse(
      error(ErrorCode.BAD_REQUEST, '参数校验失败', {
        issues: parsed.error.issues.map((i) => ({ path: i.path, message: i.message })),
      }),
      400,
    );
  }

  const result = await listCollaborations(user.tenantId, {
    status: parsed.data.status,
    type: parsed.data.type,
    keyword: parsed.data.keyword,
    memberId: parsed.data.member_id,
    page: parsed.data.page,
    pageSize: parsed.data.page_size,
  });

  return jsonResponse(
    success({
      items: result.items,
      total: result.total,
      page: parsed.data.page,
      page_size: parsed.data.page_size,
    }),
  );
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
    const collaboration = await createCollaboration(user.tenantId, user.id, {
      title: parsed.data.title,
      description: parsed.data.description,
      type: parsed.data.type as CollaborationType | undefined,
      memberIds: parsed.data.member_ids,
    });

    return jsonResponse(success(collaboration), 201);
  } catch (err) {
    const message = err instanceof Error ? err.message : '创建协同事项失败';
    return jsonResponse(error(ErrorCode.INTERNAL_ERROR, message), 500);
  }
}