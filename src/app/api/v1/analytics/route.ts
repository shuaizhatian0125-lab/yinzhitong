import { NextRequest } from 'next/server';
import { z } from 'zod';
import { success, error, ErrorCode, jsonResponse } from '@/lib/api-response';
import { getCurrentUserFromJwt } from '@/lib/auth';
import {
  queryMetrics,
  multiDimensionAnalysis,
  anomalyAttribution,
  getAvailableMetrics,
  getAvailableDimensions,
} from '@/server/modules/analytics/analytics-service';

const querySchema = z.object({
  metric_code: z.string().min(1, '指标代码不能为空'),
  period: z.string().optional(),
  dimension_values: z.record(z.string(), z.string()).optional(),
});

const multiDimSchema = z.object({
  dimension: z.string().min(1, '维度不能为空'),
  metric_codes: z.array(z.string()).min(1, '至少需要一个指标代码'),
});

const anomalySchema = z.object({
  metric_code: z.string().min(1, '指标代码不能为空'),
});

export async function GET(request: NextRequest): Promise<Response> {
  const user = await getCurrentUserFromJwt(request);
  if (!user) {
    return jsonResponse(error(ErrorCode.UNAUTHORIZED, '未登录或登录已过期'), 401);
  }

  const action = request.nextUrl.searchParams.get('action') ?? 'query';

  if (action === 'metrics_list') {
    return jsonResponse(success(getAvailableMetrics()));
  }

  if (action === 'dimensions_list') {
    return jsonResponse(success(getAvailableDimensions()));
  }

  if (action === 'multi_dimension') {
    const params = Object.fromEntries(request.nextUrl.searchParams.entries());
    const metricCodes = params.metric_codes ? params.metric_codes.split(',') : [];
    const parsed = multiDimSchema.safeParse({
      dimension: params.dimension,
      metric_codes: metricCodes,
    });
    if (!parsed.success) {
      return jsonResponse(
        error(ErrorCode.BAD_REQUEST, '参数校验失败', {
          issues: parsed.error.issues.map((i) => ({ path: i.path, message: i.message })),
        }),
        400,
      );
    }

    const result = await multiDimensionAnalysis(user, parsed.data.dimension, parsed.data.metric_codes);
    return jsonResponse(success(result));
  }

  if (action === 'anomaly') {
    const params = Object.fromEntries(request.nextUrl.searchParams.entries());
    const parsed = anomalySchema.safeParse({
      metric_code: params.metric_code,
    });
    if (!parsed.success) {
      return jsonResponse(
        error(ErrorCode.BAD_REQUEST, '参数校验失败', {
          issues: parsed.error.issues.map((i) => ({ path: i.path, message: i.message })),
        }),
        400,
      );
    }

    const result = await anomalyAttribution(user, parsed.data.metric_code);
    if (!result) {
      return jsonResponse(error(ErrorCode.NOT_FOUND, '指标不存在'), 404);
    }
    return jsonResponse(success(result));
  }

  const params = Object.fromEntries(request.nextUrl.searchParams.entries());
  const parsed = querySchema.safeParse({
    metric_code: params.metric_code,
    period: params.period,
    dimension_values: params.dimension_values ? JSON.parse(params.dimension_values) : undefined,
  });
  if (!parsed.success) {
    return jsonResponse(
      error(ErrorCode.BAD_REQUEST, '参数校验失败', {
        issues: parsed.error.issues.map((i) => ({ path: i.path, message: i.message })),
      }),
      400,
    );
  }

  const result = await queryMetrics(user, parsed.data.metric_code, {
    period: parsed.data.period,
    dimensionValues: parsed.data.dimension_values,
  });
  if (!result) {
    return jsonResponse(error(ErrorCode.NOT_FOUND, '指标不存在'), 404);
  }
  return jsonResponse(success(result));
}