import { NextRequest } from 'next/server';
import { z } from 'zod';
import { error, ErrorCode, jsonResponse, success } from '@/lib/api-response';
import { getCurrentUserFromJwt } from '@/lib/auth';
import { getTvdDb } from '@/storage/database/tvd/client';
import { resolveTvdScope } from '@/server/modules/tvd-data/scope';
import { getPatentQcView, recomputePatentQc, runPatentQcBatch } from '@/server/modules/tvd-data/patent-qc/store';
import { PQC_RULE_VERSION } from '@/server/modules/tvd-data/patent-qc/rules';

/**
 * TVD-05 / TVD-06 专利质量与异常入口。
 *
 * GET 只读已落库的质量行与异常行；POST 才执行计算。
 * 和五维评分一样，读接口绝不顺手重算 —— 否则页面刷新一次，统计数字就变一次。
 */

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const querySchema = z.object({
  enterprise_id: z.string().regex(UUID_RE, '企业 ID 需为 uuid'),
  anomaly_limit: z.coerce.number().int().min(1).max(200).optional(),
});

const bodySchema = z
  .object({
    enterprise_id: z.string().regex(UUID_RE, '企业 ID 需为 uuid').optional(),
    all: z.boolean().optional(),
    limit: z.coerce.number().int().min(1).max(200).optional(),
  })
  .refine((b) => !!b.enterprise_id || b.all === true, { message: '必须指定 enterprise_id 或 all=true' });

export async function GET(request: NextRequest): Promise<Response> {
  const user = await getCurrentUserFromJwt(request);
  if (!user) {
    return jsonResponse(error(ErrorCode.UNAUTHORIZED, '未登录或登录已过期'), 401);
  }

  const parsed = querySchema.safeParse(Object.fromEntries(request.nextUrl.searchParams.entries()));
  if (!parsed.success) {
    return jsonResponse(
      error(ErrorCode.BAD_REQUEST, '参数校验失败', {
        issues: parsed.error.issues.map((i) => ({ path: i.path, message: i.message })),
      }),
      400,
    );
  }

  const handle = await getTvdDb();
  const view = await getPatentQcView(handle, resolveTvdScope(user), parsed.data.enterprise_id, {
    anomalyLimit: parsed.data.anomaly_limit,
  });
  if (!view) {
    return jsonResponse(error(ErrorCode.NOT_FOUND, '企业不在当前数据范围内'), 404);
  }

  return jsonResponse(
    success({
      is_demo: true,
      backend: handle.kind,
      rule_version: PQC_RULE_VERSION,
      // 没跑过就是没跑过：computed_at 为 null，前端显示"待评估"，不显示 0 分。
      assessed: view.computed_at !== null,
      quality: view,
    }),
  );
}

export async function POST(request: NextRequest): Promise<Response> {
  const user = await getCurrentUserFromJwt(request);
  if (!user) {
    return jsonResponse(error(ErrorCode.UNAUTHORIZED, '未登录或登录已过期'), 401);
  }

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    raw = {};
  }
  const parsed = bodySchema.safeParse(raw);
  if (!parsed.success) {
    return jsonResponse(
      error(ErrorCode.BAD_REQUEST, '参数校验失败', {
        issues: parsed.error.issues.map((i) => ({ path: i.path, message: i.message })),
      }),
      400,
    );
  }

  const scope = resolveTvdScope(user);
  const handle = await getTvdDb();
  const q = parsed.data;

  if (q.enterprise_id) {
    const out = await recomputePatentQc(scope, q.enterprise_id, handle);
    if (!out) {
      return jsonResponse(error(ErrorCode.NOT_FOUND, '企业不在当前数据范围内'), 404);
    }
    return jsonResponse(
      success({
        is_demo: true,
        backend: handle.kind,
        rule_version: PQC_RULE_VERSION,
        requested: 1,
        done: 1,
        result: {
          enterprise_id: out.enterpriseId,
          enterprise_name: out.enterpriseName,
          patents: out.patents,
          scored: out.scored,
          avg_quality_score: out.avgQualityScore === null ? null : Number(out.avgQualityScore.toFixed(2)),
          anomaly_rows: out.anomalyRows,
          anomaly_by_type: out.anomalyByType,
        },
      }),
    );
  }

  const batch = await runPatentQcBatch(scope, { limit: q.limit ?? 100 }, handle);
  return jsonResponse(success({ is_demo: true, backend: handle.kind, rule_version: PQC_RULE_VERSION, ...batch }));
}
