import { NextRequest } from 'next/server';
import { z } from 'zod';
import { success, error, ErrorCode, jsonResponse } from '@/lib/api-response';
import { getCurrentUserFromJwt } from '@/lib/auth';
import { getGateway } from '@/server/ai/gateway';

const embedSchema = z.object({
  text: z.string().min(1, '文本不能为空'),
  task_type: z.string().optional(),
});

export async function POST(request: NextRequest): Promise<Response> {
  const user = await getCurrentUserFromJwt(request);
  if (!user) {
    return jsonResponse(error(ErrorCode.UNAUTHORIZED, '未登录或登录已过期'), 401);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonResponse(error(ErrorCode.BAD_REQUEST, '请求体格式错误'), 400);
  }

  const parsed = embedSchema.safeParse(body);
  if (!parsed.success) {
    return jsonResponse(
      error(ErrorCode.BAD_REQUEST, '参数校验失败', {
        issues: parsed.error.issues.map((i) => ({ path: i.path, message: i.message })),
      }),
      400,
    );
  }

  const { text, task_type } = parsed.data;

  const gateway = getGateway();
  try {
    const embedding = await gateway.embed({
      tenantId: user.tenantId,
      text,
      taskType: task_type ?? 'embed',
    });

    return jsonResponse(success({ embedding }));
  } catch (err) {
    const message = err instanceof Error ? err.message : '向量化服务调用失败';
    const code =
      err && typeof err === 'object' && 'code' in err
        ? (err as { code: number }).code
        : ErrorCode.AI_SERVICE_UNAVAILABLE;
    return jsonResponse(error(code, message), 503);
  }
}