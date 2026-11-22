import { NextRequest } from 'next/server';
import { z } from 'zod';
import { success, error, ErrorCode, jsonResponse } from '@/lib/api-response';
import { getCurrentUserFromJwt } from '@/lib/auth';
import { updateVisit } from '@/server/modules/customer/visit-record-service';

const updateSchema = z.object({
  visited_at: z.string().min(1).optional(),
  purpose: z.string().min(1).optional(),
  summary: z.string().optional(),
  next_action: z.string().optional(),
});

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; visitId: string }> },
): Promise<Response> {
  const user = await getCurrentUserFromJwt(request);
  if (!user) {
    return jsonResponse(error(ErrorCode.UNAUTHORIZED, '未登录或登录已过期'), 401);
  }

  const { visitId } = await params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonResponse(error(ErrorCode.BAD_REQUEST, '请求体格式错误'), 400);
  }

  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return jsonResponse(
      error(ErrorCode.BAD_REQUEST, '参数校验失败', {
        issues: parsed.error.issues.map((i) => ({ path: i.path, message: i.message })),
      }),
      400,
    );
  }

  try {
    const updated = await updateVisit(user.tenantId, visitId, {
      visitedAt: parsed.data.visited_at,
      purpose: parsed.data.purpose,
      summary: parsed.data.summary,
      nextAction: parsed.data.next_action,
    });

    if (!updated) {
      return jsonResponse(error(ErrorCode.NOT_FOUND, '拜访记录不存在'), 404);
    }

    return jsonResponse(success(updated));
  } catch (err) {
    const message = err instanceof Error ? err.message : '更新拜访记录失败';
    return jsonResponse(error(ErrorCode.INTERNAL_ERROR, message), 500);
  }
}