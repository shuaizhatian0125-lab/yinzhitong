import { NextRequest } from 'next/server';
import { z } from 'zod';
import { success, error, ErrorCode, jsonResponse } from '@/lib/api-response';
import { getCurrentUserFromJwt } from '@/lib/auth';
import { startWorkflowInstance } from '@/server/modules/collab/workflow-engine';

const startSchema = z.object({
  variables: z.record(z.string(), z.unknown()).default({}),
  business_type: z.string().optional(),
  business_id: z.string().optional(),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ code: string }> },
): Promise<Response> {
  const user = await getCurrentUserFromJwt(request);
  if (!user) {
    return jsonResponse(error(ErrorCode.UNAUTHORIZED, '未登录或登录已过期'), 401);
  }

  const { code } = await params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    body = {};
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
    const instance = await startWorkflowInstance(user.tenantId, user.id, code, {
      variables: parsed.data.variables,
      businessType: parsed.data.business_type,
      businessId: parsed.data.business_id,
    });

    return jsonResponse(success(instance), 201);
  } catch (err) {
    const message = err instanceof Error ? err.message : '启动流程实例失败';
    return jsonResponse(error(ErrorCode.INTERNAL_ERROR, message), 500);
  }
}