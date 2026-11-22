/**
 * TVD-05 / TVD-06 的运行侧：读库 → 纯函数计算 → 落库 → 回读。
 *
 * 三条落库约定：
 *  1. 质量行按 (patent_id, rule_version) 唯一，重跑是更新而不是长行；异常行按
 *     (企业, 规则版本) 整批替换。异常是派生判断，允许重算；原始证据不允许。
 *  2. tvd_patent_stats 只回填派生列（平均质量分、原创占比、异常数），
 *     rule_version 保持聚合口径的 'v1' 不动 —— 列表页与看板按 'v1' join，
 *     另起一行会让看板读不到新数字，看起来像"评分没写进去"。
 *  3. 质量分只从专利的客观字段推出来，输入不足就留 null；
 *     不读系统时间，"审中超期"这类口径一律锚在语料自身的申请年份上。
 */

import { and, asc, eq, inArray, sql } from 'drizzle-orm';
import { getTvdDb, type TvdDb } from '@/storage/database/tvd/client';
import {
  tvdPatentAnomalies,
  tvdPatentQualityAssessments,
  tvdPatentStats,
  tvdPatents,
  tvdEnterprises,
} from '@/storage/database/tvd';
import type { TvdScope } from '../scope';
import { uuidFrom } from '../scope';
import { listScopeEnterpriseIds } from '../scoring/assessment';
import { assessPatent, detectAnomalies, type AnomalyFinding, type PatentQcContext, type PatentQcFact } from './assess';
import { PQC_RULE_VERSION, WEIGHT_PROFILE, type QualityDimensionKey } from './rules';

type Db = TvdDb['db'];

function chunk<T>(list: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < list.length; i += size) out.push(list.slice(i, i + size));
  return out;
}

function yearOf(d: Date | null): number | null {
  return d ? d.getUTCFullYear() : null;
}

function quarterOf(d: Date | null): string | null {
  if (!d) return null;
  return `${d.getUTCFullYear()}Q${Math.floor(d.getUTCMonth() / 3) + 1}`;
}

/**
 * 转让历史里能不能读出"权利跑到别的主体名下"。
 * 读不出字段就返回 false —— 猜测一份看不懂的 jsonb 然后报异常，比不报更糟。
 */
function hasIrregularAssigneeHistory(history: Record<string, unknown>[], enterpriseName: string): boolean {
  for (const row of history) {
    for (const key of ['assignee', 'to', 'new_assignee', 'applicant']) {
      const v = row[key];
      if (typeof v === 'string' && v.trim() && v.trim() !== enterpriseName.trim()) return true;
    }
  }
  return false;
}

export type PatentQcInput = {
  tvdEnterpriseId: string;
  enterpriseName: string;
  ctx: PatentQcContext;
  patents: PatentQcFact[];
};

export async function loadPatentQcInput(
  handle: TvdDb,
  scope: TvdScope,
  tvdEnterpriseId: string,
): Promise<PatentQcInput | null> {
  const db: Db = handle.db;
  const [ent] = await db
    .select()
    .from(tvdEnterprises)
    .where(
      and(
        eq(tvdEnterprises.id, tvdEnterpriseId),
        eq(tvdEnterprises.tenantId, scope.tenantId),
        eq(tvdEnterprises.bankId, scope.bankId),
        eq(tvdEnterprises.status, 'active'),
      ),
    )
    .limit(1);
  if (!ent) return null;

  const rows = await db
    .select()
    .from(tvdPatents)
    .where(and(eq(tvdPatents.tvdEnterpriseId, ent.id), eq(tvdPatents.status, 'active')))
    .orderBy(asc(tvdPatents.publicationNumber));

  const patents: PatentQcFact[] = rows.map((p) => ({
    patentId: p.id,
    publicationNumber: p.publicationNumber,
    title: p.title,
    patentType: p.patentType,
    legalStatus: p.legalStatus,
    filingYear: yearOf(p.filingDate),
    filingQuarter: quarterOf(p.filingDate),
    grantYear: yearOf(p.grantDate),
    expiryYear: yearOf(p.expiryDate),
    claimCount: p.claimCount,
    inventorCount: p.inventorCount,
    inventorNames: p.inventorNamesRaw ?? [],
    ipcCodes: p.ipcCodes ?? [],
    techDomains: p.techDomains ?? [],
    familySize: p.familySize,
    citedByCount: p.citedByCount,
    agency: p.agency,
    applicantName: p.applicantNormalized ?? p.applicantRaw,
    isCurrentApplicant: p.isCurrentApplicant,
    hasAssigneeChange: hasIrregularAssigneeHistory(p.assigneeHistory ?? [], ent.displayName),
  }));

  // 口径与五维评分一致：截止年取语料里最晚的申请年，不取今天。
  const years = patents.map((p) => p.filingYear).filter((y): y is number => y !== null);
  const cutoffYear = years.length > 0 ? Math.max(...years) : (ent.updatedAt ?? new Date()).getUTCFullYear();

  return {
    tvdEnterpriseId: ent.id,
    enterpriseName: ent.displayName,
    ctx: {
      cutoffYear,
      enterpriseName: ent.displayName,
      techKeywords: ent.techKeywords ?? [],
      industry: ent.industryName,
      track: ent.trackName,
    },
    patents,
  };
}

export type PatentQcOutcome = {
  enterpriseId: string;
  enterpriseName: string;
  patents: number;
  scored: number;
  avgQualityScore: number | null;
  anomalyRows: number;
  anomalyByType: Record<string, number>;
};

export async function recomputePatentQc(
  scope: TvdScope,
  tvdEnterpriseId: string,
  handle?: TvdDb,
): Promise<PatentQcOutcome | null> {
  const h = handle ?? (await getTvdDb());
  const input = await loadPatentQcInput(h, scope, tvdEnterpriseId);
  if (!input) return null;

  const base = {
    tenantId: scope.tenantId,
    bankId: scope.bankId,
    createdBy: scope.userId,
    updatedBy: scope.userId,
  };
  const now = new Date();

  const results = input.patents.map((p) => ({ patent: p, quality: assessPatent(p, input.ctx) }));
  const findings = detectAnomalies(input.patents, input.ctx);

  const scored = results.filter((r) => r.quality.totalScore !== null);
  const avgQualityScore =
    scored.length > 0 ? scored.reduce((a, r) => a + (r.quality.totalScore ?? 0), 0) / scored.length : null;

  const grantedInvention = results.filter(
    (r) => r.patent.patentType === 'invention' && r.patent.legalStatus === 'granted',
  ).length;
  const originalRatio = input.patents.length > 0 ? grantedInvention / input.patents.length : null;

  const anomalyByType: Record<string, number> = {};
  for (const f of findings) anomalyByType[f.anomalyType] = (anomalyByType[f.anomalyType] ?? 0) + 1;

  await h.db.transaction(async (tx) => {
    for (const rows of chunk(results, 200)) {
      await tx
        .insert(tvdPatentQualityAssessments)
        .values(
          rows.map(({ patent, quality }) => ({
            id: uuidFrom(`pqc:${PQC_RULE_VERSION}:${patent.patentId}`),
            patentId: patent.patentId,
            ...base,
            ruleVersion: PQC_RULE_VERSION,
            totalScore: quality.totalScore === null ? null : quality.totalScore.toFixed(2),
            dimensions: Object.fromEntries(
              quality.dimensions.map((d) => [
                d.key,
                { name: d.name, weight: d.weight, score: d.score, inputs: d.inputs, reason: d.reason },
              ]),
            ),
            grade: quality.grade,
            weightProfile: WEIGHT_PROFILE,
            insufficientDimensions: quality.insufficientDimensions,
            reasons: quality.reasons,
            computedAt: now,
          })),
        )
        .onConflictDoUpdate({
          target: [tvdPatentQualityAssessments.patentId, tvdPatentQualityAssessments.ruleVersion],
          // 一批里每件专利的分不同，只能用 excluded 取本行新值，不能给整批写同一个常量。
          set: {
            totalScore: sql`excluded.total_score`,
            dimensions: sql`excluded.dimensions`,
            grade: sql`excluded.grade`,
            insufficientDimensions: sql`excluded.insufficient_dimensions`,
            reasons: sql`excluded.reasons`,
            computedAt: now,
            updatedAt: now,
          },
        });
    }

    // 异常整批替换：派生判断允许随规则重算，重跑不留下上一版的残留行。
    await tx
      .delete(tvdPatentAnomalies)
      .where(
        and(
          eq(tvdPatentAnomalies.tvdEnterpriseId, tvdEnterpriseId),
          eq(tvdPatentAnomalies.ruleVersion, PQC_RULE_VERSION),
        ),
      );

    for (const rows of chunk(findings, 200)) {
      await tx.insert(tvdPatentAnomalies).values(
        rows.map((f) => ({
          id: anomalyId(tvdEnterpriseId, f),
          tvdEnterpriseId,
          patentId: f.patentId,
          ...base,
          anomalyType: f.anomalyType,
          ruleVersion: PQC_RULE_VERSION,
          severity: f.severity,
          observed: f.observed,
          threshold: f.threshold,
          detail: f.detail,
          relatedPatentIds: f.relatedPatentIds,
          detectedAt: now,
        })),
      );
    }

    // 回填统计：列表页与画像读的仍是同一行 v1 聚合，只换掉三个派生列。
    await tx
      .update(tvdPatentStats)
      .set({
        avgQualityScore: avgQualityScore === null ? null : avgQualityScore.toFixed(2),
        originalRatio: originalRatio === null ? null : originalRatio.toFixed(3),
        anomalyCount: findings.length,
        computedAt: now,
        updatedAt: now,
      })
      .where(
        and(
          eq(tvdPatentStats.tvdEnterpriseId, tvdEnterpriseId),
          eq(tvdPatentStats.ruleVersion, 'v1'),
        ),
      );
  });

  return {
    enterpriseId: tvdEnterpriseId,
    enterpriseName: input.enterpriseName,
    patents: input.patents.length,
    scored: scored.length,
    avgQualityScore,
    anomalyRows: findings.length,
    anomalyByType,
  };
}

function anomalyId(enterpriseId: string, f: AnomalyFinding): string {
  const key = [...f.relatedPatentIds].sort().join(',');
  return uuidFrom(`pan:${PQC_RULE_VERSION}:${enterpriseId}:${f.anomalyType}:${f.patentId ?? 'ent'}:${key}`);
}

export type PatentQcBatchResult = {
  requested: number;
  done: number;
  missing: number;
  patents: number;
  qualityRows: number;
  anomalyRows: number;
  anomalyByType: Record<string, number>;
  elapsedMs: number;
};

export async function runPatentQcBatch(
  scope: TvdScope,
  opts: { limit?: number; ids?: string[] },
  handle?: TvdDb,
): Promise<PatentQcBatchResult> {
  const h = handle ?? (await getTvdDb());
  const startedAt = Date.now();

  let ids = opts.ids ?? [];
  if (ids.length === 0) {
    // 范围与企业清单跟五维评分共用同一个函数，避免两处口径漂移。
    ids = (await listScopeEnterpriseIds(h, scope)).slice(0, opts.limit ?? 200).map((r) => r.id);
  }

  const anomalyByType: Record<string, number> = {};
  let done = 0;
  let missing = 0;
  let patents = 0;
  let qualityRows = 0;
  let anomalyRows = 0;

  for (const id of ids) {
    const out = await recomputePatentQc(scope, id, h);
    if (!out) {
      missing += 1;
      continue;
    }
    done += 1;
    patents += out.patents;
    qualityRows += out.scored;
    anomalyRows += out.anomalyRows;
    for (const [k, v] of Object.entries(out.anomalyByType)) anomalyByType[k] = (anomalyByType[k] ?? 0) + v;
  }

  return {
    requested: ids.length,
    done,
    missing,
    patents,
    qualityRows,
    anomalyRows,
    anomalyByType,
    elapsedMs: Date.now() - startedAt,
  };
}

export type PatentQcAnomalyItem = {
  id: string;
  anomaly_type: string;
  severity: string;
  patent_id: string | null;
  publication_number: string | null;
  detail: string;
  observed: Record<string, unknown>;
  threshold: Record<string, unknown>;
  related_count: number;
};

export type PatentQcView = {
  rule_version: string;
  weight_profile: string;
  patents: number;
  scored: number;
  avg_quality_score: number | null;
  grade_counts: Record<string, number>;
  dimensions: {
    key: QualityDimensionKey;
    name: string;
    weight: number;
    avg: number | null;
    insufficient: number;
  }[];
  anomalies: { total: number; by_type: Record<string, number>; items: PatentQcAnomalyItem[]; truncated: boolean };
  computed_at: string | null;
};

const SEVERITY_RANK: Record<string, number> = { high: 0, warning: 1, info: 2 };

export async function getPatentQcView(
  handle: TvdDb,
  scope: TvdScope,
  tvdEnterpriseId: string,
  opts: { anomalyLimit?: number } = {},
): Promise<PatentQcView | null> {
  const db: Db = handle.db;
  const limit = opts.anomalyLimit ?? 40;

  const [ent] = await db
    .select({ id: tvdEnterprises.id, name: tvdEnterprises.displayName })
    .from(tvdEnterprises)
    .where(
      and(
        eq(tvdEnterprises.id, tvdEnterpriseId),
        eq(tvdEnterprises.tenantId, scope.tenantId),
        eq(tvdEnterprises.bankId, scope.bankId),
        eq(tvdEnterprises.status, 'active'),
      ),
    )
    .limit(1);
  if (!ent) return null;

  const [qualityRows, anomalyRows, patentRows] = await Promise.all([
    db
      .select({
        patentId: tvdPatentQualityAssessments.patentId,
        totalScore: tvdPatentQualityAssessments.totalScore,
        grade: tvdPatentQualityAssessments.grade,
        dimensions: tvdPatentQualityAssessments.dimensions,
        insufficient: tvdPatentQualityAssessments.insufficientDimensions,
        computedAt: tvdPatentQualityAssessments.computedAt,
      })
      .from(tvdPatentQualityAssessments)
      .where(
        and(
          inArray(tvdPatentQualityAssessments.patentId, db.select({ id: tvdPatents.id }).from(tvdPatents).where(eq(tvdPatents.tvdEnterpriseId, tvdEnterpriseId))),
          eq(tvdPatentQualityAssessments.ruleVersion, PQC_RULE_VERSION),
        ),
      ),
    db
      .select()
      .from(tvdPatentAnomalies)
      .where(
        and(
          eq(tvdPatentAnomalies.tvdEnterpriseId, tvdEnterpriseId),
          eq(tvdPatentAnomalies.ruleVersion, PQC_RULE_VERSION),
        ),
      ),
    db
      .select({ n: tvdPatents.id })
      .from(tvdPatents)
      .where(and(eq(tvdPatents.tvdEnterpriseId, tvdEnterpriseId), eq(tvdPatents.status, 'active'))),
  ]);

  const gradeCounts: Record<string, number> = {};
  const dimAcc: Record<string, { sum: number; n: number; insufficient: number; name: string; weight: number }> = {};
  for (const row of qualityRows) {
    if (row.grade) gradeCounts[row.grade] = (gradeCounts[row.grade] ?? 0) + 1;
    const dims = (row.dimensions ?? {}) as Record<string, { name?: string; weight?: number; score?: number | null }>;
    for (const [key, d] of Object.entries(dims)) {
      const acc = (dimAcc[key] ??= { sum: 0, n: 0, insufficient: 0, name: d.name ?? key, weight: d.weight ?? 0 });
      if (typeof d.score === 'number') {
        acc.sum += d.score;
        acc.n += 1;
      } else {
        acc.insufficient += 1;
      }
    }
  }

  const patentIds = patentRows.map((r) => r.n);
  const linkedIds = [...new Set(anomalyRows.flatMap((a) => (a.patentId ? [a.patentId] : a.relatedPatentIds)))];
  const pubById = new Map<string, string>();
  if (linkedIds.length > 0) {
    const pubRows = await db
      .select({ id: tvdPatents.id, pub: tvdPatents.publicationNumber })
      .from(tvdPatents)
      .where(inArray(tvdPatents.id, linkedIds.slice(0, 500)));
    for (const r of pubRows) pubById.set(r.id, r.pub);
  }

  const sorted = [...anomalyRows].sort((a, b) => {
    const s = (SEVERITY_RANK[a.severity] ?? 9) - (SEVERITY_RANK[b.severity] ?? 9);
    if (s !== 0) return s;
    if (a.anomalyType !== b.anomalyType) return a.anomalyType.localeCompare(b.anomalyType);
    return a.detail.localeCompare(b.detail);
  });

  const items: PatentQcAnomalyItem[] = sorted.slice(0, limit).map((a) => ({
    id: a.id,
    anomaly_type: a.anomalyType,
    severity: a.severity,
    patent_id: a.patentId,
    publication_number: a.patentId ? (pubById.get(a.patentId) ?? null) : null,
    detail: a.detail,
    observed: a.observed,
    threshold: a.threshold,
    related_count: a.patentId ? 1 : a.relatedPatentIds.length,
  }));

  const scored = qualityRows.filter((r) => r.totalScore !== null);
  const byType: Record<string, number> = {};
  for (const a of anomalyRows) byType[a.anomalyType] = (byType[a.anomalyType] ?? 0) + 1;

  return {
    rule_version: PQC_RULE_VERSION,
    weight_profile: WEIGHT_PROFILE,
    patents: patentIds.length,
    scored: scored.length,
    avg_quality_score:
      scored.length > 0
        ? Math.round((scored.reduce((x, r) => x + Number(r.totalScore), 0) / scored.length) * 100) / 100
        : null,
    grade_counts: gradeCounts,
    dimensions: Object.entries(dimAcc)
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([key, v]) => ({
        key: key as QualityDimensionKey,
        name: v.name,
        weight: v.weight,
        avg: v.n > 0 ? Math.round((v.sum / v.n) * 100) / 100 : null,
        insufficient: v.insufficient,
      })),
    anomalies: { total: anomalyRows.length, by_type: byType, items, truncated: anomalyRows.length > items.length },
    computed_at: qualityRows[0]?.computedAt?.toISOString() ?? null,
  };
}
