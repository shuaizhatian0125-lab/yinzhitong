import { NextRequest } from 'next/server';
import { z } from 'zod';
import { success, error, ErrorCode, jsonResponse } from '@/lib/api-response';
import { getCurrentUserFromJwt } from '@/lib/auth';
import { getDecision, approveDecision, rejectDecision, executeDecision, reviseDecision, type DecisionOption } from '@/server/modules/collab/decision-service';

const patchSchema = z.object({
  action: z.enum(['APPROVE', 'REJECT', 'EXECUTE', 'REVISE']),
  selectedOption: z.string().optional(),
  reason: z.string().optional(),
  revisedOptions: z.array(z.object({
    id: z.string(),
    label: z.string(),
    description: z.string(),
    pros: z.array(z.string()).default([]),
    cons: z.array(z.string()).default([]),
    riskLevel: z.enum(['LOW', 'MEDIUM', 'HIGH']),
  })).optional(),
});

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; decId: string }> },
): Promise<Response> {
  const user = await getCurrentUserFromJwt(request);
  if (!user) {
    return jsonResponse(error(ErrorCode.UNAUTHORIZED, '未登录或登录已过期'), 401);
  }

  const { decId } = await params;
  const decision = await getDecision(user.tenantId, decId);

  if (!decision) {
    return jsonResponse(error(ErrorCode.NOT_FOUND, '决策不存在'), 404);
  }

  return jsonResponse(success(decision));
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; decId: string }> },
): Promise<Response> {
  const user = await getCurrentUserFromJwt(request);
  if (!user) {
    return jsonResponse(error(ErrorCode.UNAUTHORIZED, '未登录或登录已过期'), 401);
  }

  const { decId } = await params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonResponse(error(ErrorCode.BAD_REQUEST, '请求体格式错误'), 400);
  }

  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return jsonResponse(
      error(ErrorCode.BAD_REQUEST, '参数校验失败', {
        issues: parsed.error.issues.map((i) => ({ path: i.path, message: i.message })),
      }),
      400,
    );
  }

  try {
    let decision;
    switch (parsed.data.action) {
      case 'APPROVE':
        if (!parsed.data.selectedOption) {
          return jsonResponse(error(ErrorCode.BAD_REQUEST, 'APPROVE 需要 selectedOption'), 400);
        }
        decision = await approveDecision(user.tenantId, decId, parsed.data.selectedOption, user);
        break;
      case 'REJECT':
        if (!parsed.data.reason) {
          return jsonResponse(error(ErrorCode.BAD_REQUEST, 'REJECT 需要 reason'), 400);
        }
        decision = await rejectDecision(user.tenantId, decId, parsed.data.reason, user);
        break;
      case 'EXECUTE':
        decision = await executeDecision(user.tenantId, decId);
        break;
      case 'REVISE':
        if (!parsed.data.revisedOptions) {
          return jsonResponse(error(ErrorCode.BAD_REQUEST, 'REVISE 需要 revisedOptions'), 400);
        }
        decision = await reviseDecision(user.tenantId, decId, parsed.data.revisedOptions as DecisionOption[], user);
        break;
    }

    return jsonResponse(success(decision));
  } catch (err) {
    const message = err instanceof Error ? err.message : '更新决策失败';
    return jsonResponse(error(ErrorCode.INTERNAL_ERROR, message), 500);
  }
}