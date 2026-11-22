import { NextRequest } from 'next/server';
import { z } from 'zod';
import { success, error, ErrorCode, jsonResponse } from '@/lib/api-response';
import { getCurrentUserFromJwt } from '@/lib/auth';
import { createOpportunity } from '@/server/modules/customer/customer-service';

const createSchema = z.object({
  title: z.string().min(1, '商机标题不能为空'),
  stage: z.string().optional(),
  amount: z.number().int().min(0).optional(),
  probability: z.number().int().min(0).max(100).optional(),
  expected_close_at: z.string().optional(),
  owner_id: z.string().optional(),
});

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
    const opportunity = await createOpportunity(user.tenantId, {
      customerId,
      title: parsed.data.title,
      stage: parsed.data.stage,
      amount: parsed.data.amount,
      probability: parsed.data.probability,
      expectedCloseAt: parsed.data.expected_close_at,
      ownerId: parsed.data.owner_id ?? user.id,
    });

    return jsonResponse(success(opportunity), 201);
  } catch (err) {
    const message = err instanceof Error ? err.message : '创建商机失败';
    return jsonResponse(error(ErrorCode.INTERNAL_ERROR, message), 500);
  }
}