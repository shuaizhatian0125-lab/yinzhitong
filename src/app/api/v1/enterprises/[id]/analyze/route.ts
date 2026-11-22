import { NextRequest } from 'next/server';
import { z } from 'zod';
import { success, error, ErrorCode, jsonResponse } from '@/lib/api-response';
import { getCurrentUserFromJwt } from '@/lib/auth';
import {
  analyzeTechInnovation,
  analyzeGrowthPotential,
  identifyFinancialDemand,
} from '@/server/modules/enterprise/analysis-service';
import { generateValueDiscoveryReport } from '@/server/modules/enterprise/report-service';

const analyzeSchema = z.object({
  type: z.enum(['tech_innovation', 'growth_potential', 'financial_demand', 'value_report']),
});

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
    body = { type: 'tech_innovation' };
  }

  const parsed = analyzeSchema.safeParse(body);
  if (!parsed.success) {
    return jsonResponse(
      error(ErrorCode.BAD_REQUEST, '参数校验失败', {
        issues: parsed.error.issues.map((i) => ({ path: i.path, message: i.message })),
      }),
      400,
    );
  }

  try {
    let result: unknown;
    switch (parsed.data.type) {
      case 'tech_innovation':
        result = await analyzeTechInnovation(user.tenantId, id);
        break;
      case 'growth_potential':
        result = await analyzeGrowthPotential(user.tenantId, id);
        break;
      case 'financial_demand':
        result = await identifyFinancialDemand(user.tenantId, id);
        break;
      case 'value_report':
        result = await generateValueDiscoveryReport(user.tenantId, id);
        break;
    }

    return jsonResponse(success(result));
  } catch (err) {
    const message = err instanceof Error ? err.message : '分析失败';
    return jsonResponse(error(ErrorCode.INTERNAL_ERROR, message), 500);
  }
}