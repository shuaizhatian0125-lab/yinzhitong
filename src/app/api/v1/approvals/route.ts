import { NextRequest } from 'next/server';
import { z } from 'zod';
import { success, error, ErrorCode, jsonResponse } from '@/lib/api-response';
import { getCurrentUserFromJwt } from '@/lib/auth';
import { listApprovals } from '@/server/modules/collab/approval-service';

const listSchema = z.object({
  status: z.string().optional(),
  business_type: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  page_size: z.coerce.number().int().min(1).max(100).default(20),
});

export async function GET(request: NextRequest): Promise<Response> {
  const user = await getCurrentUserFromJwt(request);
  if (!user) {
    return jsonResponse(error(ErrorCode.UNAUTHORIZED, '未登录或登录已过期'), 401);
  }

  const params = Object.fromEntries(request.nextUrl.searchParams.entries());
  const parsed = listSchema.safeParse(params);
  if (!parsed.success) {
    return jsonResponse(
      error(ErrorCode.BAD_REQUEST, '参数校验失败', {
        issues: parsed.error.issues.map((i) => ({ path: i.path, message: i.message })),
      }),
      400,
    );
  }

  const result = await listApprovals(user.tenantId, user.id, {
    status: parsed.data.status,
    businessType: parsed.data.business_type,
    page: parsed.data.page,
    pageSize: parsed.data.page_size,
  });

  return jsonResponse(
    success({
      items: result.items,
      total: result.total,
      page: parsed.data.page,
      page_size: parsed.data.page_size,
    }),
  );
}