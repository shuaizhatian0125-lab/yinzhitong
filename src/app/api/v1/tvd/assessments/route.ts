import { NextRequest } from 'next/server';
import { z } from 'zod';
import { error, ErrorCode, jsonResponse, success } from '@/lib/api-response';
import { getCurrentUserFromJwt } from '@/lib/auth';
import { getTvdDb } from '@/storage/database/tvd/client';
import { resolveTvdScope } from '@/server/modules/tvd-data/scope';
import {
  getLatestAssessment,
  listScopeEnterpriseIds,
  runAssessment,
} from '@/server/modules/tvd-data/scoring/assessment';
import { RULE_VERSION } from '@/server/modules/tvd-data/scoring/rules';

/**
 * TVD-10/11 评分入口。
 *
 * GET  只读最近一次已落地的 run —— 页面刷新不能顺带改分。
 * POST 才执行计算，且必须显式给出范围（单个企业或 all + limit）：
 *      跑批是写操作，"打开页面就重算全库"这种隐式副作用会让统计数字随时在变。
 */

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const querySchema = z.object({
  enterprise_id: z.string().regex(UUID_RE, '企业 ID 需为 uuid').optional(),
});

const bodySchema = z
  .object({
    enterprise_id: z.string().regex(UUID_RE, '企业 ID 需为 uuid').optional(),
    all: z.boolean().optional(),
    limit: z.coerce.number().int().min(1).max(200).optional(),
  })
  .refine((b) => !!b.enterprise_id || b.all === true, {
    message: '必须指定 enterprise_id 或 all=true',
  });

export async function GET(request: NextRequest): Promise<Response> {
  const user = await getCurrentUserFromJwt(request);
  if (!user) {
    return jsonResponse(error(ErrorCode.UNAUTHORIZED, '未登录或登录已过期'), 401);
  }

  const parsed = querySchema.safeParse(Object.fromEntries(request.nextUrl.searchParams.entries()));
  if (!parsed.success || !parsed.data.enterprise_id) {
    return jsonResponse(
      error(ErrorCode.BAD_REQUEST, '参数校验失败', {
        issues: parsed.success ? [{ path: ['enterprise_id'], message: '缺少 enterprise_id' }] : parsed.error.issues.map((i) => ({ path: i.path, message: i.message })),
      }),
      400,
    );
  }

  const handle = await getTvdDb();
  const view = await getLatestAssessment(handle, resolveTvdScope(user), parsed.data.enterprise_id);
  if (!view) {
    // 还没跑过评分与"评分为 0"是两件事，这里必须区分开：返回 404 让前端显示"待评分"。
    return jsonResponse(error(ErrorCode.NOT_FOUND, '该企业尚无评估记录'), 404);
  }

  return jsonResponse(success({ is_demo: true, backend: handle.kind, rule_version: RULE_VERSION, assessment: view }));
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
  const targets = q.enterprise_id
    ? [{ id: q.enterprise_id, name: '' }]
    : (await listScopeEnterpriseIds(handle, scope)).slice(0, q.limit ?? 100);

  const results: Record<string, unknown>[] = [];
  let scored = 0;
  let withheld = 0;
  let failed = 0;

  for (const t of targets) {
    try {
      const r = await runAssessment(scope, t.id, handle);
      if (!r) {
        failed += 1;
        results.push({ enterprise_id: t.id, ok: false, message: '企业不在当前数据范围内' });
        continue;
      }
      if (r.totalScore === null) withheld += 1;
      else scored += 1;
      results.push({
        enterprise_id: r.enterpriseId,
        enterprise_name: r.enterpriseName,
        ok: true,
        run_id: r.runId,
        total_score: r.totalScore === null ? null : Number(r.totalScore.toFixed(2)),
        grade: r.grade,
        data_coverage: Number(r.dataCoverage.toFixed(3)),
        evidence_confidence: Number(r.evidenceConfidence.toFixed(3)),
        withheld_reason: r.withheldReason,
        score_rows: r.scoreRows,
        evidence_links: r.evidenceLinks,
      });
    } catch (err) {
      failed += 1;
      results.push({
        enterprise_id: t.id,
        ok: false,
        message: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return jsonResponse(
    success({
      is_demo: true,
      backend: handle.kind,
      rule_version: RULE_VERSION,
      requested: targets.length,
      scored,
      withheld,
      failed,
      results,
    }),
  );
}
