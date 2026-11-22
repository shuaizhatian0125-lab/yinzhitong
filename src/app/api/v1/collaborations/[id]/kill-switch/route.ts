import { NextRequest } from 'next/server';
import { z } from 'zod';
import { success, error, ErrorCode, jsonResponse } from '@/lib/api-response';
import { getCurrentUserFromJwt } from '@/lib/auth';
import { executeKillSwitch, type KillSwitchAction, type KillSwitchScope } from '@/server/modules/collab/kill-switch-service';

const executeSchema = z.object({
  action: z.enum([
    'STOP_ALL_AGENTS', 'PAUSE_COLLABORATION', 'STOP_WORKSTREAM',
    'STOP_AGENT', 'STOP_RUN', 'REVOKE_AI_PERMISSIONS', 'EMERGENCY_HALT',
  ]),
  reason: z.string().min(1, '执行原因不能为空'),
  scope: z.object({
    workstreamId: z.string().optional(),
    agentCode: z.string().optional(),
    runId: z.string().optional(),
  }).default({}),
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

  const parsed = executeSchema.safeParse(body);
  if (!parsed.success) {
    return jsonResponse(
      error(ErrorCode.BAD_REQUEST, '参数校验失败', {
        issues: parsed.error.issues.map((i) => ({ path: i.path, message: i.message })),
      }),
      400,
    );
  }

  try {
    const record = await executeKillSwitch(
      user.tenantId,
      id,
      parsed.data.action as KillSwitchAction,
      parsed.data.reason,
      parsed.data.scope as KillSwitchScope,
      user,
    );

    return jsonResponse(success(record), 201);
  } catch (err) {
    const message = err instanceof Error ? err.message : '执行 Kill Switch 失败';
    return jsonResponse(error(ErrorCode.INTERNAL_ERROR, message), 500);
  }
}