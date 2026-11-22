import { NextRequest } from 'next/server';
import { z } from 'zod';
import { success, error, ErrorCode, jsonResponse } from '@/lib/api-response';
import { getCurrentUserFromJwt } from '@/lib/auth';
import { searchEnterprises, createEnterprise } from '@/server/modules/enterprise/enterprise-service';

const searchSchema = z.object({
  region: z.string().optional(),
  industry: z.string().optional(),
  tech_field: z.string().optional(),
  is_tech: z.coerce.boolean().optional(),
  keyword: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  page_size: z.coerce.number().int().min(1).max(100).default(20),
});

const createSchema = z.object({
  name: z.string().min(1, '企业名称不能为空'),
  unified_code: z.string().optional(),
  industry: z.string().optional(),
  scale: z.string().optional(),
  region: z.string().optional(),
  level: z.string().optional(),
  risk_level: z.string().optional(),
  profile: z.record(z.string(), z.unknown()).optional(),
  tags: z.array(z.string()).optional(),
});

export async function GET(request: NextRequest): Promise<Response> {
  const user = await getCurrentUserFromJwt(request);
  if (!user) {
    return jsonResponse(error(ErrorCode.UNAUTHORIZED, '未登录或登录已过期'), 401);
  }

  const params = Object.fromEntries(request.nextUrl.searchParams.entries());
  const parsed = searchSchema.safeParse(params);
  if (!parsed.success) {
    return jsonResponse(
      error(ErrorCode.BAD_REQUEST, '参数校验失败', {
        issues: parsed.error.issues.map((i) => ({ path: i.path, message: i.message })),
      }),
      400,
    );
  }

  const { region, industry, tech_field, is_tech, keyword, page, page_size } = parsed.data;

  const result = await searchEnterprises(user.tenantId, {
    region,
    industry,
    techField: tech_field,
    isTech: is_tech,
    keyword,
    page,
    pageSize: page_size,
  });

  return jsonResponse(
    success({
      items: result.items,
      total: result.total,
      page,
      page_size,
    }),
  );
}

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

  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return jsonResponse(
      error(ErrorCode.BAD_REQUEST, '参数校验失败', {
        issues: parsed.error.issues.map((i) => ({ path: i.path, message: i.message })),
      }),
      400,
    );
  }

  try {
    const enterprise = await createEnterprise(user.tenantId, {
      name: parsed.data.name,
      unifiedCode: parsed.data.unified_code,
      industry: parsed.data.industry,
      scale: parsed.data.scale,
      region: parsed.data.region,
      level: parsed.data.level,
      riskLevel: parsed.data.risk_level,
      profile: parsed.data.profile,
      tags: parsed.data.tags,
    });

    return jsonResponse(success(enterprise), 201);
  } catch (err) {
    const message = err instanceof Error ? err.message : '创建企业档案失败';
    return jsonResponse(error(ErrorCode.INTERNAL_ERROR, message), 500);
  }
}