import { NextRequest } from 'next/server';
import { z } from 'zod';
import { success, error, ErrorCode, jsonResponse } from '@/lib/api-response';
import { getCurrentUserFromJwt } from '@/lib/auth';
import { getEnterprise, updateEnterprise } from '@/server/modules/enterprise/enterprise-service';

const updateSchema = z.object({
  name: z.string().min(1).optional(),
  unified_code: z.string().optional(),
  industry: z.string().optional(),
  scale: z.string().optional(),
  region: z.string().optional(),
  level: z.string().optional(),
  risk_level: z.string().optional(),
  profile: z.record(z.string(), z.unknown()).optional(),
  tags: z.array(z.string()).optional(),
  is_tech: z.boolean().optional(),
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
  const result = await getEnterprise(user.tenantId, id);

  if (!result) {
    return jsonResponse(error(ErrorCode.NOT_FOUND, '企业不存在'), 404);
  }

  return jsonResponse(success(result));
}

export async function PATCH(
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

  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return jsonResponse(
      error(ErrorCode.BAD_REQUEST, '参数校验失败', {
        issues: parsed.error.issues.map((i) => ({ path: i.path, message: i.message })),
      }),
      400,
    );
  }

  try {
    const updated = await updateEnterprise(user.tenantId, id, {
      name: parsed.data.name,
      unifiedCode: parsed.data.unified_code,
      industry: parsed.data.industry,
      scale: parsed.data.scale,
      region: parsed.data.region,
      level: parsed.data.level,
      riskLevel: parsed.data.risk_level,
      profile: parsed.data.profile,
      tags: parsed.data.tags,
      isTech: parsed.data.is_tech,
    });

    if (!updated) {
      return jsonResponse(error(ErrorCode.NOT_FOUND, '企业不存在'), 404);
    }

    return jsonResponse(success(updated));
  } catch (err) {
    const message = err instanceof Error ? err.message : '更新企业档案失败';
    return jsonResponse(error(ErrorCode.INTERNAL_ERROR, message), 500);
  }
}