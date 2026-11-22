/**
 * 评分的运行侧：读库 → 建特征 → 确定性计算 → 落库。
 *
 * 为什么读库和计算要分两层：calculators/engine 是纯函数，任何一条分档改动都能用
 * vitest 回归；这一层负责的是"输入从哪来"，它最容易出问题的地方恰恰是把
 * 没采到的东西当成 0 传进去。所以这里每一条独立来源数都必须能指回具体行。
 *
 * 落库三条约束：
 *  1. 主键全部由 (规则版本, 企业) 推出 —— 重跑不会长出一堆新行，历史才可比。
 *  2. 画像取代而非覆盖：seed 出来的空画像标记 effective_to，评分画像另起一行。
 *     PRD 要求画像按版本累积，直接 UPDATE 会把"上周是什么分"抹掉。
 *  3. data_kind 跟着输入走：专利是合成值，产出run 就不能标 REAL_DATA。
 */

import { and, asc, desc, eq, inArray, isNull, ne } from 'drizzle-orm';
import { getTvdDb, type TvdDb } from '@/storage/database/tvd/client';
import {
  tvdAssessmentIndicators,
  tvdAssessmentModelVersions,
  tvdAssessmentModels,
  tvdAssessmentRuns,
  tvdAssessmentScores,
  tvdDataSources,
  tvdEnterpriseProfiles,
  tvdEnterprises,
  tvdEvidence,
  tvdEvidenceLinks,
  tvdFactClaims,
  tvdFactConflicts,
  tvdPatents,
  tvdScoreEvidenceLinks,
  tvdSignals,
  tvdSourceRecords,
} from '@/storage/database/tvd';
import type { TvdScope } from '../scope';
import { uuidFrom } from '../scope';
import { buildFeatureSet, type BuildFeaturesInput, type PatentFact, type SignalFact } from './features';
import { computeScorecard } from './engine';
import {
  DIMENSION_WEIGHTS,
  GRADE_BANDS,
  INDICATOR_RULES,
  KEY_TECH_TRACKS,
  MIN_DATA_COVERAGE,
  MIN_INDEPENDENT_SOURCES,
  MODEL_CODE,
  MODEL_NAME,
  RULE_VERSION,
  STRATEGIC_INDUSTRIES,
} from './rules';
import { evidenceBucket } from './calculators';
import type { IndicatorStatus, Scorecard } from './types';

type Db = TvdDb['db'];

/** 证据桶的独立来源情况：桶名与 calculators.ts 的 METRIC_TO_BUCKET 对齐。 */
type Bucket = { independentSources: number; verificationStatus: string };

export type AssessmentInput = {
  tvdEnterpriseId: string;
  enterpriseName: string;
  features: BuildFeaturesInput;
  /** 每次 run 的 data_kind 由输入里最低可信的一档决定，不取平均、不取最新。 */
  dataKind: 'REAL_DATA' | 'DEMO_DATA' | 'SYNTHETIC_DATA' | 'USER_UPLOADED' | 'AI_INFERENCE' | 'UNVERIFIED';
  conflictCount: number;
  factCount: number;
  /** 桶 → 支撑该桶的证据 id，落 tvd_score_evidence_links 用。 */
  evidenceByBucket: Record<string, string[]>;
  /** 特征快照之外的输入说明，UI 的"数据从哪来"读它。 */
  provenance: Record<string, unknown>;
};

const DATA_KIND_RANK = [
  'UNVERIFIED',
  'AI_INFERENCE',
  'SYNTHETIC_DATA',
  'DEMO_DATA',
  'USER_UPLOADED',
  'REAL_DATA',
] as const;

function worstDataKind(kinds: string[]): AssessmentInput['dataKind'] {
  let worst = DATA_KIND_RANK.length - 1;
  for (const k of kinds) {
    const idx = DATA_KIND_RANK.indexOf(k as (typeof DATA_KIND_RANK)[number]);
    if (idx >= 0 && idx < worst) worst = idx;
  }
  return DATA_KIND_RANK[worst];
}

function bucketStatus(independentSources: number): string {
  if (independentSources >= MIN_INDEPENDENT_SOURCES) return 'multi_source';
  if (independentSources === 1) return 'single_source';
  return 'unverified';
}

/** 分项的核验状态由指标状态与独立来源数推出，与算出来的分高低无关。 */
function scoreVerificationStatus(
  status: IndicatorStatus,
  independentSources: number,
): 'disputed' | 'multi_source' | 'single_source' | 'unverified' {
  if (status === 'CONFLICTED') return 'disputed';
  if (status === 'UNVERIFIED') return 'single_source';
  if (independentSources >= MIN_INDEPENDENT_SOURCES) return 'multi_source';
  return 'unverified';
}

export async function loadAssessmentInput(
  handle: TvdDb,
  scope: TvdScope,
  tvdEnterpriseId: string,
): Promise<AssessmentInput | null> {
  const db: Db = handle.db;
  const scopeCond = and(
    eq(tvdEnterprises.tenantId, scope.tenantId),
    eq(tvdEnterprises.bankId, scope.bankId),
  );

  const [ent] = await db
    .select()
    .from(tvdEnterprises)
    .where(and(eq(tvdEnterprises.id, tvdEnterpriseId), scopeCond, isNull(tvdEnterprises.effectiveTo)))
    .limit(1);
  if (!ent) return null;

  const [patentRows, signalRows, sourceRows, evidenceRows, recordRows, claimRows, conflictRows] =
    await Promise.all([
      db
        .select({
          patentType: tvdPatents.patentType,
          legalStatus: tvdPatents.legalStatus,
          filingDate: tvdPatents.filingDate,
          techDomains: tvdPatents.techDomains,
          ipcCodes: tvdPatents.ipcCodes,
          claimCount: tvdPatents.claimCount,
          inventorCount: tvdPatents.inventorCount,
          inventorNamesRaw: tvdPatents.inventorNamesRaw,
          familySize: tvdPatents.familySize,
          citedByCount: tvdPatents.citedByCount,
          applicantRaw: tvdPatents.applicantRaw,
          sourceRecordId: tvdPatents.sourceRecordId,
          evidenceId: tvdPatents.evidenceId,
          dataKind: tvdPatents.dataKind,
          verificationStatus: tvdPatents.verificationStatus,
        })
        .from(tvdPatents)
        .where(and(eq(tvdPatents.tvdEnterpriseId, tvdEnterpriseId), eq(tvdPatents.status, 'active'))),
      db
        .select({
          id: tvdSignals.id,
          signalType: tvdSignals.signalType,
          verificationStatus: tvdSignals.verificationStatus,
          independentSourceCount: tvdSignals.independentSourceCount,
        })
        .from(tvdSignals)
        .where(and(eq(tvdSignals.tvdEnterpriseId, tvdEnterpriseId), eq(tvdSignals.status, 'active'))),
      db
        .select({
          code: tvdDataSources.code,
          name: tvdDataSources.name,
          coversSignalTypes: tvdDataSources.coversSignalTypes,
          lastSyncAt: tvdDataSources.lastSyncAt,
          connected: tvdDataSources.connected,
        })
        .from(tvdDataSources)
        .where(
          and(
            eq(tvdDataSources.tenantId, scope.tenantId),
            eq(tvdDataSources.bankId, scope.bankId),
            eq(tvdDataSources.status, 'active'),
          ),
        ),
      db
        .select({
          id: tvdEvidence.id,
          sourceRecordId: tvdEvidence.sourceRecordId,
          originRecordId: tvdEvidence.originRecordId,
          verificationStatus: tvdEvidence.verificationStatus,
        })
        .from(tvdEvidence)
        .where(and(eq(tvdEvidence.tvdEnterpriseId, tvdEnterpriseId), eq(tvdEvidence.status, 'active'))),
      db
        .select({ id: tvdSourceRecords.id, originRecordId: tvdSourceRecords.originRecordId })
        .from(tvdSourceRecords)
        .where(
          and(
            eq(tvdSourceRecords.tenantId, scope.tenantId),
            eq(tvdSourceRecords.bankId, scope.bankId),
          ),
        ),
      db
        .select({ id: tvdFactClaims.id })
        .from(tvdFactClaims)
        .where(and(eq(tvdFactClaims.tvdEnterpriseId, tvdEnterpriseId), eq(tvdFactClaims.status, 'active'))),
      db
        .select({ id: tvdFactConflicts.id })
        .from(tvdFactConflicts)
        .where(and(eq(tvdFactConflicts.tvdEnterpriseId, tvdEnterpriseId), eq(tvdFactConflicts.status, 'active'))),
    ]);

  // 证据挂在哪个结论上：只有 tvd_evidence_links 能说明"这条证据支撑的是哪类信号"。
  // 单独一次查询是因为它依赖 signalRows —— 放进上面那个 Promise.all，
  // signalRows 就在自己的初始化表达式里被引用，类型推不出来。
  const linkRows = signalRows.length
    ? await db
        .select({
          evidenceId: tvdEvidenceLinks.evidenceId,
          conclusionKind: tvdEvidenceLinks.conclusionKind,
          conclusionId: tvdEvidenceLinks.conclusionId,
        })
        .from(tvdEvidenceLinks)
        .where(
          and(
            eq(tvdEvidenceLinks.tenantId, scope.tenantId),
            eq(tvdEvidenceLinks.bankId, scope.bankId),
            eq(tvdEvidenceLinks.conclusionKind, 'signal'),
            inArray(
              tvdEvidenceLinks.conclusionId,
              signalRows.map((s) => s.id),
            ),
          ),
        )
    : [];

  // 转载归并到根节点：同一官方名单的多个转载页只算 1 个独立来源。
  const originOf = new Map(recordRows.map((r) => [r.id, r.originRecordId ?? r.id]));
  const distinctOrigins = (sourceRecordIds: (string | null)[]): number =>
    new Set(sourceRecordIds.map((id) => (id ? originOf.get(id) ?? id : null)).filter((v): v is string => !!v)).size;

  const patents: PatentFact[] = patentRows.map((p) => ({
    patentType: p.patentType,
    legalStatus: p.legalStatus,
    filingYear: p.filingDate ? p.filingDate.getUTCFullYear() : null,
    techDomains: p.techDomains,
    ipcCodes: p.ipcCodes,
    claimCount: p.claimCount,
    inventorCount: p.inventorCount,
    inventorNames: p.inventorNamesRaw,
    familySize: p.familySize,
    citedByCount: p.citedByCount,
    // 申请人字段是原文，多个主体以分隔号出现；只有确认为单主体才算独立申请。
    singleApplicant: !/[；;、,，]/.test(p.applicantRaw ?? ''),
  }));

  const signals: SignalFact[] = signalRows.map((s) => ({
    signalType: s.signalType,
    verificationStatus: s.verificationStatus,
    independentSources: s.independentSourceCount,
  }));

  // 已覆盖的信号类型 = 注册过且实际取回过数据的源（last_sync_at 非空）。
  // 用 connected 会把"接口写好了但一次都没采"当成"这个源没有这项数据"，
  // 后者在评分里是 0 分的含义，前者必须是"未采集"。
  const coveredSignalTypes = [
    ...new Set(
      sourceRows.filter((s) => s.lastSyncAt !== null).flatMap((s) => s.coversSignalTypes as string[]),
    ),
  ];

  const evidenceIdsBySignalType = new Map<string, string[]>();
  const originsBySignalType = new Map<string, string[]>();
  const signalTypeById = new Map(signalRows.map((s) => [s.id, s.signalType as string]));
  for (const link of linkRows) {
    const type = signalTypeById.get(link.conclusionId);
    if (!type) continue;
    const ev = evidenceRows.find((e) => e.id === link.evidenceId);
    if (!ev) continue;
    evidenceIdsBySignalType.set(type, [...(evidenceIdsBySignalType.get(type) ?? []), ev.id]);
    originsBySignalType.set(type, [
      ...(originsBySignalType.get(type) ?? []),
      ev.originRecordId ?? originOf.get(ev.sourceRecordId) ?? ev.sourceRecordId,
    ]);
  }

  const buckets: Record<string, Bucket> = {};
  const evidenceByBucket: Record<string, string[]> = {};
  for (const type of coveredSignalTypes) {
    const origins = originsBySignalType.get(type);
    const independentSources = origins ? distinctOrigins(origins) : 0;
    buckets[type] = { independentSources, verificationStatus: bucketStatus(independentSources) };
    evidenceByBucket[type] = evidenceIdsBySignalType.get(type) ?? [];
  }

  // 专利桶：专利行的 source_record_id 是唯一合法出处；演示语料该列为空，
  // 于是独立来源数 = 0，专利类指标全部记 UNVERIFIED 并折半权重。
  // 这里如果按 tvd_patents 的行数凑一个来源数，就等于把合成数据伪装成核实过的数据。
  // 专利桶：专利行的 evidence_id / source_record_id 是唯一合法出处；演示语料两列都是空，
  // 于是独立来源数 = 0，专利类指标全部记 UNVERIFIED 并折半权重。
  // 按 tvd_patents 的行数凑一个来源数，就等于把合成数据伪装成核实过的数据。
  const patentOrigins = distinctOrigins(patentRows.map((p) => p.sourceRecordId));
  buckets.patent = { independentSources: patentOrigins, verificationStatus: bucketStatus(patentOrigins) };
  evidenceByBucket.patent = patentRows.map((p) => p.evidenceId).filter((v): v is string => v !== null);

  // 身份桶：专精特新等资质名单的证据，即 enterprise_identity 信号背后的来源。
  const identity = buckets.enterprise_identity ?? { independentSources: 0, verificationStatus: 'unverified' };
  buckets.identity = identity;
  evidenceByBucket.identity = evidenceByBucket.enterprise_identity ?? [];

  // "近 3 年"锚在语料自己的最新申请年份上，不读系统时间：
  // 同一个库今天跑和下个月跑必须出同一个分，否则回归对比无从做起。
  const filingYears = patents.map((p) => p.filingYear).filter((y): y is number => y !== null);
  const cutoffYear =
    filingYears.length > 0
      ? Math.max(...filingYears)
      : ent.updatedAt instanceof Date
        ? ent.updatedAt.getUTCFullYear()
        : Number(ent.updatedAt);

  const dataKind = worstDataKind([
    ...patentRows.map((p) => p.dataKind),
    ...signalRows.map(() => 'REAL_DATA'),
    ent.dataKind,
  ]);

  return {
    tvdEnterpriseId,
    enterpriseName: ent.displayName,
    dataKind,
    conflictCount: conflictRows.length,
    factCount: claimRows.length,
    evidenceByBucket,
    provenance: {
      cutoff_year: cutoffYear,
      patent_count: patents.length,
      signal_count: signals.length,
      covered_signal_types: coveredSignalTypes,
      sources: sourceRows.map((s) => ({ code: s.code, name: s.name, last_sync_at: s.lastSyncAt })),
      buckets,
    },
    features: {
      enterprise: {
        id: tvdEnterpriseId,
        name: ent.displayName,
        industry: ent.industryName,
        track: ent.trackName,
        techKeywords: ent.techKeywords,
        qualifications: ent.qualifications,
      },
      patents,
      signals,
      cutoffYear,
      coveredSignalTypes,
      keyTechTracks: KEY_TECH_TRACKS,
      strategicIndustries: STRATEGIC_INDUSTRIES,
      evidenceBuckets: buckets,
    },
  };
}

function roundTo(n: number | null, d = 4): string | null {
  return n === null ? null : n.toFixed(d);
}

/** 画像的证据层：PRD 15.6 那组"随分一起输出"的元指标，落库后要能读出来。 */
function evidenceLayerOf(card: Scorecard): Record<string, unknown> {
  return {
    evidence_confidence: Number(card.evidenceConfidence.toFixed(3)),
    scorable_indicator_rate: Number(card.scorableIndicatorRate.toFixed(3)),
    independent_evidence_rate: Number(card.independentEvidenceRate.toFixed(3)),
    conflict_rate: Number(card.conflictRate.toFixed(3)),
    score_stability: Number((1 - 0.5 * (1 - card.dataCoverage) - 0.5 * (1 - card.evidenceConfidence)).toFixed(3)),
    grade_label: card.gradeLabel,
    withheld_reason: card.withheldReason,
    rule_version: card.ruleVersion,
  };
}

export type AssessmentOutcome = {
  runId: string;
  enterpriseId: string;
  enterpriseName: string;
  totalScore: number | null;
  grade: string | null;
  dataCoverage: number;
  evidenceConfidence: number;
  withheldReason: string | null;
  scoreRows: number;
  evidenceLinks: number;
  card: Scorecard;
};

/**
 * 幂等要点：runNo 把"规则版本 + 数据截止年"编进去。
 * 同一份数据重跑 → 同一条 run 被更新；规则升版或语料新增一年的申请 → 新 run，
 * 历史分留在表里，TVD-11 的趋势线才有东西可画。
 */
export async function runAssessment(
  scope: TvdScope,
  tvdEnterpriseId: string,
  handle?: TvdDb,
): Promise<AssessmentOutcome | null> {
  const h = handle ?? (await getTvdDb());
  const input = await loadAssessmentInput(h, scope, tvdEnterpriseId);
  if (!input) return null;

  const features = buildFeatureSet(input.features);
  const card = computeScorecard(features, { conflictCount: input.conflictCount, factCount: input.factCount });
  const cutoffYear = Number(input.features.cutoffYear);
  const base = {
    tenantId: scope.tenantId,
    bankId: scope.bankId,
    createdBy: scope.userId,
    updatedBy: scope.userId,
  };

  const modelId = uuidFrom(`amodel:${MODEL_CODE}`);
  const versionId = uuidFrom(`amv:${MODEL_CODE}:${RULE_VERSION}`);
  const runNo = `${MODEL_CODE}|${RULE_VERSION}|${tvdEnterpriseId}|${cutoffYear}`;
  const runId = uuidFrom(`arun:${runNo}`);
  const now = new Date();

  await h.db.transaction(async (tx) => {
    await tx
      .insert(tvdAssessmentModels)
      .values({
        id: modelId,
        ...base,
        code: MODEL_CODE,
        name: MODEL_NAME,
        description:
          'PRD 第十五章五维模型：T25/P25/R20/C20/E10，评分全部由确定性代码执行，AI 只做解释。',
        industryCodes: STRATEGIC_INDUSTRIES,
        trackCodes: KEY_TECH_TRACKS,
        activeVersionId: versionId,
        owner: '科技金融部（演示）',
      })
      .onConflictDoUpdate({
        target: tvdAssessmentModels.code,
        set: { name: MODEL_NAME, activeVersionId: versionId, updatedAt: now },
      });

    await tx
      .insert(tvdAssessmentModelVersions)
      .values({
        id: versionId,
        modelId,
        ...base,
        version: RULE_VERSION,
        dimensionWeights: DIMENSION_WEIGHTS,
        scoringConfig: {
          min_data_coverage: MIN_DATA_COVERAGE,
          min_independent_sources: MIN_INDEPENDENT_SOURCES,
          indicator_count: INDICATOR_RULES.length,
        },
        gradeThresholds: Object.fromEntries(GRADE_BANDS.map((g) => [g.grade, g.atLeast])),
        minDataCoverage: MIN_DATA_COVERAGE.toFixed(3),
        minIndependentSources: MIN_INDEPENDENT_SOURCES,
        notes: 'V1 初始参数，权重与分档均可按行业适配后升版重跑；分数不随时间漂移，口径以版本为准。',
        publishedAt: now,
      })
      .onConflictDoUpdate({
        target: [tvdAssessmentModelVersions.modelId, tvdAssessmentModelVersions.version],
        set: {
          dimensionWeights: DIMENSION_WEIGHTS,
          gradeThresholds: Object.fromEntries(GRADE_BANDS.map((g) => [g.grade, g.atLeast])),
          updatedAt: now,
        },
      });

    await tx.insert(tvdAssessmentIndicators).values(
      INDICATOR_RULES.map((r) => ({
        id: uuidFrom(`aind:${RULE_VERSION}:${r.code}`),
        modelVersionId: versionId,
        ...base,
        code: r.code,
        name: r.name,
        dimension: r.dimension,
        weight: r.weight.toFixed(4),
        calculatorKey: r.calculator,
        params: r.params ?? {},
        requiredMetricKeys: r.requiredMetrics,
        normalizeMethod: 'band',
        bands: r.bands,
        description: r.basis,
      })),
    ).onConflictDoNothing();

    await tx
      .insert(tvdAssessmentRuns)
      .values({
        id: runId,
        tvdEnterpriseId,
        modelVersionId: versionId,
        ...base,
        dataKind: input.dataKind,
        runNo,
        trigger: 'manual',
        dataCutoffAt: new Date(Date.UTC(cutoffYear, 11, 31)),
        totalScore: roundTo(card.totalScore, 2),
        grade: card.grade,
        scoreWithheldReason: card.withheldReason,
        dataCoverage: roundTo(card.dataCoverage, 3),
        conflictCount: input.conflictCount,
        pendingReviewCount: card.openQuestions.length,
        independentEvidenceCount: Math.round(card.independentEvidenceRate * INDICATOR_RULES.length),
        featureSnapshot: {
          metrics: features.metrics,
          verification: features.verification,
          provenance: input.provenance,
        },
        derivation: card.derivation as unknown as Record<string, unknown>[],
        aiInterpretation: null,
        status: card.totalScore === null ? 'withheld' : 'completed',
        startedAt: now,
        finishedAt: new Date(),
        durationMs: 0,
      })
      .onConflictDoUpdate({
        target: tvdAssessmentRuns.runNo,
        set: {
          modelVersionId: versionId,
          totalScore: roundTo(card.totalScore, 2),
          grade: card.grade,
          scoreWithheldReason: card.withheldReason,
          dataCoverage: roundTo(card.dataCoverage, 3),
          conflictCount: input.conflictCount,
          pendingReviewCount: card.openQuestions.length,
          independentEvidenceCount: Math.round(card.independentEvidenceRate * INDICATOR_RULES.length),
          featureSnapshot: {
            metrics: features.metrics,
            verification: features.verification,
            provenance: input.provenance,
          },
          derivation: card.derivation as unknown as Record<string, unknown>[],
          status: card.totalScore === null ? 'withheld' : 'completed',
          finishedAt: new Date(),
          updatedAt: now,
        },
      });

    // 重跑先清这一 run 的旧分项：分数历史在 tvd_assessment_runs，分项只是最近一次的物化结果。
    // 顺序不能反 —— 链接表对 scores 是 restrict/cascade 都有可能，先删引用方才不会卡住。
    await tx
      .delete(tvdScoreEvidenceLinks)
      .where(
        inArray(
          tvdScoreEvidenceLinks.scoreId,
          INDICATOR_RULES.map((r) => uuidFrom(`ascore:${runId}:${r.code}`)),
        ),
      );
    await tx.delete(tvdAssessmentScores).where(eq(tvdAssessmentScores.runId, runId));

    const scoreRows = card.dimensions.flatMap((d) =>
      d.indicators.map((i) => ({
        id: uuidFrom(`ascore:${runId}:${i.code}`),
        runId,
        indicatorId: uuidFrom(`aind:${RULE_VERSION}:${i.code}`),
        ...base,
        dimension: d.dimension,
        indicatorCode: i.code,
        rawValue: roundTo(i.rawValue, 4),
        normalizedScore: roundTo(i.score, 2),
        weight: i.weight.toFixed(4),
        weightedScore: i.score === null ? null : (i.effectiveWeight * i.score).toFixed(4),
        insufficientEvidence: i.status === 'UNAVAILABLE' || i.status === 'NOT_APPLICABLE',
        confidence:
          i.independentSources >= MIN_INDEPENDENT_SOURCES ? ('high' as const) : i.independentSources === 1 ? ('medium' as const) : ('low' as const),
        // 核验状态跟着证据走，不跟分数走：单源就是单源，哪怕它算出来的分很高。
        verificationStatus: scoreVerificationStatus(i.status, i.independentSources),
        independentSourceCount: i.independentSources,
        explanation: `${i.explanation}${i.bandLabel ? `｜档位：${i.bandLabel}` : ''}`,
      })),
    );
    await tx.insert(tvdAssessmentScores).values(scoreRows);

    // 分数 ↔ 证据：能连的必须连上，连不上的说明该维度本就无据，不伪造链接。
    const links: { id: string; scoreId: string; evidenceId: string; contribution: string; role: string }[] = [];
    for (const d of card.dimensions) {
      for (const i of d.indicators) {
        if (i.score === null) continue;
        const rule = INDICATOR_RULES.find((r) => r.code === i.code);
        if (!rule) continue;
        const bucket = evidenceBucket(rule);
        const evidenceIds = input.evidenceByBucket[bucket] ?? [];
        for (const evidenceId of evidenceIds) {
          links.push({
            id: uuidFrom(`asel:${runId}:${i.code}:${evidenceId}`),
            scoreId: uuidFrom(`ascore:${runId}:${i.code}`),
            evidenceId,
            contribution: (1 / Math.max(1, evidenceIds.length)).toFixed(3),
            role: 'primary',
          });
        }
      }
    }
    if (links.length > 0) {
      await tx
        .insert(tvdScoreEvidenceLinks)
        .values(links.map((l) => ({ ...l, ...base })))
        .onConflictDoNothing();
    }

    // 画像：评分产出的画像版本 = 规则版本；seed 的空画像与其它规则版本一律标记失效。
    const profileId = uuidFrom(`aprof:${tvdEnterpriseId}:${RULE_VERSION}`);
    const pendingCount = card.dimensions
      .flatMap((d) => d.indicators)
      .filter((i) => i.status === 'UNVERIFIED' || i.status === 'UNAVAILABLE' || i.status === 'CONFLICTED').length;
    // 画像内容一次算好：insert 与 on-conflict update 必须是同一份，
    // 两处各写一遍迟早会漂成两个版本。
    const profilePayload = {
      assessmentRunId: runId,
      modelVersionId: versionId,
      overallScore: roundTo(card.totalScore, 2),
      scoreConfidence: card.confidenceLevel,
      dataCoverage: roundTo(card.dataCoverage, 3),
      evidenceConfidence: card.confidenceLevel,
      valueLayer: {
        dimensions: card.dimensions.map((d) => ({
          dimension: d.dimension,
          name: d.name,
          weight: d.weight,
          score: d.score === null ? null : Number(d.score.toFixed(2)),
          coverage: Number(d.coverage.toFixed(3)),
          status: d.status,
        })),
      },
      // 置信度类指标存进证据层：runs 表没有对应列，而 PRD 15.6 要求它们随分一起输出。
      evidenceLayer: evidenceLayerOf(card),
      growthLayer: { derivation: card.derivation, scorableIndicatorRate: card.scorableIndicatorRate },
      riskLayer: { withheldReason: card.withheldReason, conflictRate: card.conflictRate },
      strengths: card.strengths,
      weaknesses: card.weaknesses,
      riskNotes: card.withheldReason ? [card.withheldReason] : [],
      openQuestions: card.openQuestions,
      conflictCount: input.conflictCount,
      pendingVerificationCount: pendingCount,
      // 输入里最低的一档决定画像可信度：专利是合成值，画像就不能标 REAL_DATA。
      dataKind: input.dataKind,
    };
    await tx
      .insert(tvdEnterpriseProfiles)
      .values({ id: profileId, tvdEnterpriseId, ...base, profileVersion: RULE_VERSION, ...profilePayload })
      .onConflictDoUpdate({
        target: [tvdEnterpriseProfiles.tvdEnterpriseId, tvdEnterpriseProfiles.profileVersion],
        set: { ...profilePayload, updatedAt: now },
      });

    // 旧版画像失效：同一企业同时只有一条 effective_to is null，看板取数才不会拿到上一版分。
    await tx
      .update(tvdEnterpriseProfiles)
      .set({ effectiveTo: now, supersededBy: profileId, updatedAt: now })
      .where(
        and(
          eq(tvdEnterpriseProfiles.tvdEnterpriseId, tvdEnterpriseId),
          isNull(tvdEnterpriseProfiles.effectiveTo),
          ne(tvdEnterpriseProfiles.id, profileId),
        ),
      );
  });

  return {
    runId,
    enterpriseId: tvdEnterpriseId,
    enterpriseName: input.enterpriseName,
    totalScore: card.totalScore,
    grade: card.grade,
    dataCoverage: card.dataCoverage,
    evidenceConfidence: card.evidenceConfidence,
    withheldReason: card.withheldReason,
    scoreRows: INDICATOR_RULES.length,
    evidenceLinks: Object.values(input.evidenceByBucket).reduce((n, ids) => n + ids.length, 0),
    card,
  };
}

export async function listScopeEnterpriseIds(handle: TvdDb, scope: TvdScope): Promise<{ id: string; name: string }[]> {
  const rows = await handle.db
    .select({ id: tvdEnterprises.id, name: tvdEnterprises.displayName })
    .from(tvdEnterprises)
    .where(
      and(
        eq(tvdEnterprises.tenantId, scope.tenantId),
        eq(tvdEnterprises.bankId, scope.bankId),
        isNull(tvdEnterprises.effectiveTo),
      ),
    )
    .orderBy(asc(tvdEnterprises.displayName));
  return rows;
}

/**
 * 读取最近一次评分，组装成页面可直接渲染的形状。
 *
 * 这里刻意不回落到"当场算一个"：读接口只做读。评分必须由 run 表里那一份
 * 带 rule_version 与 feature_snapshot 的记录来说话，页面临场重算会让展示的分数
 * 与库里的历史脱钩，回归对比也就没东西可比了。
 */
export type AssessmentView = {
  run_id: string;
  run_no: string;
  rule_version: string;
  status: string;
  data_kind: string;
  computed_at: string;
  data_cutoff_at: string | null;
  total_score: string | null;
  grade: string | null;
  withheld_reason: string | null;
  data_coverage: string | null;
  conflict_count: number;
  pending_review_count: number;
  evidence: Record<string, unknown>;
  dimensions: {
    dimension: string;
    name: string;
    weight: number;
    score: number | null;
    coverage: number;
    status: string;
    indicators: {
      code: string;
      name: string;
      status: string;
      weight: string;
      raw_value: string | null;
      score: string | null;
      weighted_score: string | null;
      independent_sources: number;
      verification_status: string;
      insufficient_evidence: boolean;
      explanation: string | null;
      evidence_ids: string[];
    }[];
  }[];
  derivation: Record<string, unknown>[];
  strengths: string[];
  weaknesses: string[];
  open_questions: string[];
  risk_notes: string[];
  provenance: Record<string, unknown>;
};

export async function getLatestAssessment(
  handle: TvdDb,
  scope: TvdScope,
  tvdEnterpriseId: string,
): Promise<AssessmentView | null> {
  const db: Db = handle.db;
  const [run] = await db
    .select()
    .from(tvdAssessmentRuns)
    .where(
      and(
        eq(tvdAssessmentRuns.tvdEnterpriseId, tvdEnterpriseId),
        eq(tvdAssessmentRuns.tenantId, scope.tenantId),
        eq(tvdAssessmentRuns.bankId, scope.bankId),
      ),
    )
    .orderBy(desc(tvdAssessmentRuns.startedAt))
    .limit(1);
  if (!run) return null;

  const [scoreRows, profileRows, versionRows] = await Promise.all([
    db
      .select({
        id: tvdAssessmentScores.id,
        dimension: tvdAssessmentScores.dimension,
        code: tvdAssessmentScores.indicatorCode,
        name: tvdAssessmentIndicators.name,
        weight: tvdAssessmentScores.weight,
        rawValue: tvdAssessmentScores.rawValue,
        score: tvdAssessmentScores.normalizedScore,
        weightedScore: tvdAssessmentScores.weightedScore,
        insufficient: tvdAssessmentScores.insufficientEvidence,
        verificationStatus: tvdAssessmentScores.verificationStatus,
        independentSources: tvdAssessmentScores.independentSourceCount,
        explanation: tvdAssessmentScores.explanation,
      })
      .from(tvdAssessmentScores)
      .leftJoin(tvdAssessmentIndicators, eq(tvdAssessmentScores.indicatorId, tvdAssessmentIndicators.id))
      .where(eq(tvdAssessmentScores.runId, run.id)),
    db
      .select()
      .from(tvdEnterpriseProfiles)
      .where(
        and(
          eq(tvdEnterpriseProfiles.assessmentRunId, run.id),
          isNull(tvdEnterpriseProfiles.effectiveTo),
        ),
      )
      .limit(1),
    db
      .select({ version: tvdAssessmentModelVersions.version })
      .from(tvdAssessmentModelVersions)
      .where(eq(tvdAssessmentModelVersions.id, run.modelVersionId))
      .limit(1),
  ]);

  // 分数 ↔ 证据单独一次查询：它按 scoreRows 的 id 过滤，写在同一个 Promise.all 里
  // 会让 scoreRows 在自己的初始化表达式里被引用，类型推不出来。
  const linkRows = scoreRows.length
    ? await db
        .select({ scoreId: tvdScoreEvidenceLinks.scoreId, evidenceId: tvdScoreEvidenceLinks.evidenceId })
        .from(tvdScoreEvidenceLinks)
        .where(inArray(tvdScoreEvidenceLinks.scoreId, scoreRows.map((s) => s.id)))
    : [];

  const evidenceIdsByScore = new Map<string, string[]>();
  for (const l of linkRows) {
    evidenceIdsByScore.set(l.scoreId, [...(evidenceIdsByScore.get(l.scoreId) ?? []), l.evidenceId]);
  }

  const breakdown = (profileRows[0]?.valueLayer as { dimensions?: AssessmentView['dimensions'] } | null)?.dimensions ?? [];
  const evidence = (profileRows[0]?.evidenceLayer as Record<string, unknown> | null) ?? {};

  return {
    run_id: run.id,
    run_no: run.runNo,
    rule_version: versionRows[0]?.version ?? run.runNo.split('|')[1] ?? 'unknown',
    status: run.status,
    data_kind: run.dataKind,
    computed_at: (run.finishedAt ?? run.startedAt).toISOString(),
    data_cutoff_at: run.dataCutoffAt ? run.dataCutoffAt.toISOString() : null,
    total_score: run.totalScore,
    grade: run.grade,
    withheld_reason: run.scoreWithheldReason,
    data_coverage: run.dataCoverage,
    conflict_count: run.conflictCount,
    pending_review_count: run.pendingReviewCount,
    evidence,
    dimensions: breakdown.map((d) => ({
      ...d,
      indicators: scoreRows
        .filter((s) => s.dimension === d.dimension)
        .sort((a, b) => a.code.localeCompare(b.code))
        .map((s) => ({
          code: s.code,
          name: s.name ?? s.code,
          status: s.insufficient
            ? 'UNAVAILABLE'
            : s.verificationStatus === 'single_source'
              ? 'UNVERIFIED'
              : s.score === null
                ? 'UNAVAILABLE'
                : 'AVAILABLE',
          weight: s.weight,
          raw_value: s.rawValue,
          score: s.score,
          weighted_score: s.weightedScore,
          independent_sources: s.independentSources,
          verification_status: s.verificationStatus,
          insufficient_evidence: s.insufficient,
          explanation: s.explanation,
          evidence_ids: evidenceIdsByScore.get(s.id) ?? [],
        })),
    })),
    derivation: (run.derivation as Record<string, unknown>[]) ?? [],
    strengths: (profileRows[0]?.strengths as string[]) ?? [],
    weaknesses: (profileRows[0]?.weaknesses as string[]) ?? [],
    open_questions: (profileRows[0]?.openQuestions as string[]) ?? [],
    risk_notes: (profileRows[0]?.riskNotes as string[]) ?? [],
    provenance: ((run.featureSnapshot as { provenance?: Record<string, unknown> } | null)?.provenance) ?? {},
  };
}
