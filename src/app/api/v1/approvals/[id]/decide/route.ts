import { NextRequest } from 'next/server';
import { z } from 'zod';
import { success, error, ErrorCode, jsonResponse } from '@/lib/api-response';
import { getCurrentUserFromJwt } from '@/lib/auth';
import { decideApproval } from '@/server/modules/collab/approval-service';

const decideSchema = z.object({
  decision: z.enum(['approved', 'rejected']),
  comment: z.string().optional(),
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

  const parsed = decideSchema.safeParse(body);
  if (!parsed.success) {
    return jsonResponse(
      error(ErrorCode.BAD_REQUEST, '参数校验失败', {
        issues: parsed.error.issues.map((i) => ({ path: i.path, message: i.message })),
      }),
      400,
    );
  }

  try {
    const approval = await decideApproval(user.tenantId, user.id, id, {
      decision: parsed.data.decision,
      comment: parsed.data.comment,
    });

    return jsonResponse(success(approval));
  } catch (err) {
    const message = err instanceof Error ? err.message : '审批操作失败';
    return jsonResponse(error(ErrorCode.INTERNAL_ERROR, message), 500);
  }
}