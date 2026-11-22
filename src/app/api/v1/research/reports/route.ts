import { NextRequest } from 'next/server';
import { z } from 'zod';
import { success, error, ErrorCode, jsonResponse } from '@/lib/api-response';
import { getCurrentUserFromJwt } from '@/lib/auth';
import { generateIndustryReport } from '@/server/modules/research/research-service';

const reportSchema = z.object({
  industry_id: z.string().min(1, '行业ID不能为空'),
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

  const parsed = reportSchema.safeParse(body);
  if (!parsed.success) {
    return jsonResponse(
      error(ErrorCode.BAD_REQUEST, '参数校验失败', {
        issues: parsed.error.issues.map((i) => ({ path: i.path, message: i.message })),
      }),
      400,
    );
  }

  try {
    const report = await generateIndustryReport(user.tenantId, parsed.data.industry_id);
    return jsonResponse(success(report));
  } catch (err) {
    const message = err instanceof Error ? err.message : '生成行业报告失败';
    return jsonResponse(error(ErrorCode.INTERNAL_ERROR, message), 500);
  }
}