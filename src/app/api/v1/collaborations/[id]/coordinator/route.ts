import { NextRequest } from 'next/server';
import { z } from 'zod';
import { success, error, ErrorCode, jsonResponse } from '@/lib/api-response';
import { getCurrentUserFromJwt } from '@/lib/auth';
import { startCoordinator, getCoordinatorStatus, runDecisionCycle, type CoordinatorMode } from '@/server/modules/collab/coordinator-runtime';

const startSchema = z.object({
  mode: z.enum(['HUMAN', 'AI_ASSISTED', 'AI_COORDINATED', 'AUTO']),
});

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const user = await getCurrentUserFromJwt(request);
  if (!user) {
    return jsonResponse(error(ErrorCode.UNAUTHORIZED, '未登录或登录已过期'), 401);
  }

  const { id } = await params;

  try {
    const status = await getCoordinatorStatus(id, user);
    if (!status) {
      return jsonResponse(success({ active: false }));
    }
    return jsonResponse(success({ active: true, ...status }));
  } catch (err) {
    const message = err instanceof Error ? err.message : '获取 Coordinator 状态失败';
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

  const { id } = await params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonResponse(error(ErrorCode.BAD_REQUEST, '请求体格式错误'), 400);
  }

  const parsed = startSchema.safeParse(body);
  if (!parsed.success) {
    return jsonResponse(
      error(ErrorCode.BAD_REQUEST, '参数校验失败', {
        issues: parsed.error.issues.map((i) => ({ path: i.path, message: i.message })),
      }),
      400,
    );
  }

  try {
    const instance = await startCoordinator(id, parsed.data.mode as CoordinatorMode, user);
    return jsonResponse(success(instance), 201);
  } catch (err) {
    const message = err instanceof Error ? err.message : '启动 Coordinator 失败';
    return jsonResponse(error(ErrorCode.INTERNAL_ERROR, message), 500);
  }
}