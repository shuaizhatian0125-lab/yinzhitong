import { NextRequest } from 'next/server';
import { z } from 'zod';
import { success, error, ErrorCode, jsonResponse } from '@/lib/api-response';
import { getCurrentUserFromJwt } from '@/lib/auth';
import { ackAlert, resolveAlert, markFalsePositive } from '@/server/modules/risk/risk-service';

const ackSchema = z.object({
  action: z.enum(['ack', 'resolve', 'false_positive']),
  resolution: z.string().optional(),
  reason: z.string().optional(),
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

  const parsed = ackSchema.safeParse(body);
  if (!parsed.success) {
    return jsonResponse(
      error(ErrorCode.BAD_REQUEST, '参数校验失败', {
        issues: parsed.error.issues.map((i) => ({ path: i.path, message: i.message })),
      }),
      400,
    );
  }

  try {
    let alert;
    if (parsed.data.action === 'ack') {
      alert = await ackAlert(user.tenantId, id, user.id);
    } else if (parsed.data.action === 'resolve') {
      alert = await resolveAlert(user.tenantId, id, parsed.data.resolution ?? '', user.id);
    } else {
      alert = await markFalsePositive(user.tenantId, id, parsed.data.reason ?? '', user.id);
    }

    return jsonResponse(success(alert));
  } catch (err) {
    const message = err instanceof Error ? err.message : '预警操作失败';
    return jsonResponse(error(ErrorCode.INTERNAL_ERROR, message), 500);
  }
}