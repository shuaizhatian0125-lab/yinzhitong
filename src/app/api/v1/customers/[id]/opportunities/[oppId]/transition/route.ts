import { NextRequest } from 'next/server';
import { z } from 'zod';
import { success, error, ErrorCode, jsonResponse } from '@/lib/api-response';
import { getCurrentUserFromJwt } from '@/lib/auth';
import { transitionStage, STAGE_LABELS } from '@/server/modules/customer/opportunity-stage-service';

const transitionSchema = z.object({
  target_stage: z.string().min(1, '目标阶段不能为空'),
  reason: z.string().optional(),
  lost_reason: z.string().optional(),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; oppId: string }> },
): Promise<Response> {
  const user = await getCurrentUserFromJwt(request);
  if (!user) {
    return jsonResponse(error(ErrorCode.UNAUTHORIZED, '未登录或登录已过期'), 401);
  }

  const { oppId } = await params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonResponse(error(ErrorCode.BAD_REQUEST, '请求体格式错误'), 400);
  }

  const parsed = transitionSchema.safeParse(body);
  if (!parsed.success) {
    return jsonResponse(
      error(ErrorCode.BAD_REQUEST, '参数校验失败', {
        issues: parsed.error.issues.map((i) => ({ path: i.path, message: i.message })),
      }),
      400,
    );
  }

  try {
    const result = await transitionStage(
      user.tenantId,
      oppId,
      parsed.data.target_stage,
      parsed.data.reason,
      parsed.data.lost_reason,
      user.id,
    );
    return jsonResponse(success(result));
  } catch (err) {
    const message = err instanceof Error ? err.message : '商机阶段流转失败';
    if (message.startsWith('商机阶段不可跳级')) {
      return jsonResponse(error(ErrorCode.BAD_REQUEST, message), 400);
    }
    if (message === '商机不存在') {
      return jsonResponse(error(ErrorCode.NOT_FOUND, message), 404);
    }
    if (message === '流失时必须提供流失原因') {
      return jsonResponse(error(ErrorCode.BAD_REQUEST, message), 400);
    }
    if (message === '商机已结束，不可再流转') {
      return jsonResponse(error(ErrorCode.BAD_REQUEST, message), 400);
    }
    return jsonResponse(error(ErrorCode.INTERNAL_ERROR, message), 500);
  }
}