import { NextRequest } from 'next/server';
import { z } from 'zod';
import { success, error, ErrorCode, jsonResponse } from '@/lib/api-response';
import { getCurrentUserFromJwt } from '@/lib/auth';
import { listCustomers, createCustomer } from '@/server/modules/customer/customer-service';

const searchSchema = z.object({
  keyword: z.string().optional(),
  type: z.string().optional(),
  level: z.string().optional(),
  status: z.string().optional(),
  manager_id: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  page_size: z.coerce.number().int().min(1).max(100).default(20),
});

const createSchema = z.object({
  name: z.string().min(1, '客户名称不能为空'),
  type: z.enum(['corp', 'retail']).optional(),
  level: z.enum(['A', 'B', 'C', 'D']).optional(),
  enterprise_id: z.string().optional(),
  manager_id: z.string().optional(),
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

  const { keyword, type, level, status, manager_id, page, page_size } = parsed.data;

  const result = await listCustomers(user.tenantId, {
    keyword,
    type,
    level,
    status,
    managerId: manager_id,
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
    const customer = await createCustomer(user.tenantId, {
      name: parsed.data.name,
      type: parsed.data.type,
      level: parsed.data.level,
      enterpriseId: parsed.data.enterprise_id,
      managerId: parsed.data.manager_id,
      profile: parsed.data.profile,
      tags: parsed.data.tags,
    });
    return jsonResponse(success(customer), 201);
  } catch (err) {
    const message = err instanceof Error ? err.message : '创建客户失败';
    if (message === '关联企业不存在') {
      return jsonResponse(error(ErrorCode.BAD_REQUEST, message), 400);
    }
    return jsonResponse(error(ErrorCode.INTERNAL_ERROR, message), 500);
  }
}