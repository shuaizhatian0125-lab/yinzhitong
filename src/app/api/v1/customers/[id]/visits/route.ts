import { NextRequest } from 'next/server';
import { z } from 'zod';
import { success, error, ErrorCode, jsonResponse } from '@/lib/api-response';
import { getCurrentUserFromJwt } from '@/lib/auth';
import { createVisit, listVisits } from '@/server/modules/customer/visit-record-service';

const createSchema = z.object({
  visited_at: z.string().min(1, '拜访日期不能为空'),
  purpose: z.string().min(1, '拜访目的不能为空'),
  summary: z.string().optional(),
  next_action: z.string().optional(),
});

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const user = await getCurrentUserFromJwt(request);
  if (!user) {
    return jsonResponse(error(ErrorCode.UNAUTHORIZED, '未登录或登录已过期'), 401);
  }

  const { id: customerId } = await params;

  try {
    const visits = await listVisits(user.tenantId, customerId);
    return jsonResponse(success(visits));
  } catch (err) {
    const message = err instanceof Error ? err.message : '查询拜访记录失败';
    return jsonResponse(error(ErrorCode.INTERNAL_ERROR, message), 500);
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const user = await getCurrentUserFromJwt(request);
  if (!user) {
    return jsonResponse(error(ErrorCode.UNAUTHORIZED, '未登录或登录已过期'), 401);
  }

  const { id: customerId } = await params;

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
    const visit = await createVisit(user.tenantId, {
      customerId,
      userId: user.id,
      visitedAt: parsed.data.visited_at,
      purpose: parsed.data.purpose,
      summary: parsed.data.summary,
      nextAction: parsed.data.next_action,
    });
    return jsonResponse(success(visit), 201);
  } catch (err) {
    const message = err instanceof Error ? err.message : '创建拜访记录失败';
    return jsonResponse(error(ErrorCode.INTERNAL_ERROR, message), 500);
  }
}