import { NextRequest } from 'next/server';
import { z } from 'zod';
import { success, error, ErrorCode, jsonResponse } from '@/lib/api-response';
import { getCurrentUserFromJwt } from '@/lib/auth';
import { completeNode } from '@/server/modules/collab/workflow-engine';

const completeSchema = z.object({
  result: z.record(z.string(), z.unknown()).default({}),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; nodeKey: string }> },
): Promise<Response> {
  const user = await getCurrentUserFromJwt(request);
  if (!user) {
    return jsonResponse(error(ErrorCode.UNAUTHORIZED, '未登录或登录已过期'), 401);
  }

  const { id, nodeKey } = await params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    body = {};
  }

  const parsed = completeSchema.safeParse(body);
  if (!parsed.success) {
    return jsonResponse(
      error(ErrorCode.BAD_REQUEST, '参数校验失败', {
        issues: parsed.error.issues.map((i) => ({ path: i.path, message: i.message })),
      }),
      400,
    );
  }

  try {
    const nodeInstance = await completeNode(user.tenantId, id, nodeKey, parsed.data.result);
    return jsonResponse(success(nodeInstance));
  } catch (err) {
    const message = err instanceof Error ? err.message : '完成节点失败';
    return jsonResponse(error(ErrorCode.INTERNAL_ERROR, message), 500);
  }
}