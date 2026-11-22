import { NextRequest } from 'next/server';
import { z } from 'zod';
import { success, error, ErrorCode, jsonResponse } from '@/lib/api-response';
import { getCurrentUserFromJwt } from '@/lib/auth';
import { generateVisitPlan } from '@/server/modules/customer/customer-service';

const bodySchema = z.object({
  visit_date: z.string().min(1, '拜访日期不能为空'),
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

  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return jsonResponse(
      error(ErrorCode.BAD_REQUEST, '参数校验失败', {
        issues: parsed.error.issues.map((i) => ({ path: i.path, message: i.message })),
      }),
      400,
    );
  }

  try {
    const plan = await generateVisitPlan(user.tenantId, id, parsed.data.visit_date);
    if (!plan) {
      return jsonResponse(error(ErrorCode.NOT_FOUND, '客户不存在'), 404);
    }
    return jsonResponse(success(plan));
  } catch (err) {
    const message = err instanceof Error ? err.message : '生成拜访方案失败';
    return jsonResponse(error(ErrorCode.INTERNAL_ERROR, message), 500);
  }
}