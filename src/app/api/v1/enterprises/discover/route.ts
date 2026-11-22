import { NextRequest } from 'next/server';
import { z } from 'zod';
import { success, error, ErrorCode, jsonResponse } from '@/lib/api-response';
import { getCurrentUserFromJwt } from '@/lib/auth';
import { discoverEnterprises } from '@/server/modules/enterprise/discovery-service';

const discoverSchema = z.object({
  industry: z.string().optional(),
  region: z.string().optional(),
  techField: z.string().optional(),
  scale: z.string().optional(),
  page: z.number().int().min(1).default(1),
  pageSize: z.number().int().min(1).max(100).default(20),
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

  const parsed = discoverSchema.safeParse(body);
  if (!parsed.success) {
    return jsonResponse(
      error(ErrorCode.BAD_REQUEST, '参数校验失败', {
        issues: parsed.error.issues.map((i) => ({ path: i.path, message: i.message })),
      }),
      400,
    );
  }

  try {
    const result = await discoverEnterprises(user.tenantId, parsed.data);
    return jsonResponse(success(result));
  } catch (err) {
    const message = err instanceof Error ? err.message : '企业发现失败';
    return jsonResponse(error(ErrorCode.INTERNAL_ERROR, message), 500);
  }
}