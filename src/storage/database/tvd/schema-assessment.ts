import { boolean, index, integer, jsonb, numeric, pgTable, text, timestamp, uniqueIndex, uuid, varchar } from 'drizzle-orm/pg-core';
import {
  confidenceLevelEnum,
  dataKindEnum,
  dimensionEnum,
  standardColumns,
  verificationStatusEnum,
} from './core';
import { tvdEnterprises } from './schema-enterprise';

/**
 * TVD-10 / TVD-11 评估域。
 *
 * 命题红线："所有评分必须由确定性代码执行，AI 只做分析与解释。"
 * 落库层面的体现是：规则以数据形式存在（model_version + indicator），
 * 每次运行记录 rule_version 快照与输入特征快照，
 * 于是任何人拿到同一份输入都能重算出同一个分数。
 * 只要分数还能被 AI 直接改写，这条红线就没有真正落地。
 */

export const tvdAssessmentModels = pgTable(
  'tvd_assessment_models',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    ...standardColumns(),
    code: varchar('code', { length: 64 }).notNull(),
    name: varchar('name', { length: 128 }).notNull(),
    description: text('description'),
    /** 适用行业/赛道，空表示通用。 */
    industryCodes: jsonb('industry_codes').notNull().$type<string[]>().default([]),
    trackCodes: jsonb('track_codes').notNull().$type<string[]>().default([]),
    activeVersionId: uuid('active_version_id'),
    owner: varchar('owner', { length: 64 }),
  },
  (t) => ({
    byCode: uniqueIndex('tvd_assessment_models_code_uniq').on(t.code),
    byTenant: index('tvd_assessment_models_tenant_idx').on(t.tenantId, t.bankId, t.status),
  }),
);

/** 版本不可变：改动规则即产生新版本，历史评分才能被解释。 */
export const tvdAssessmentModelVersions = pgTable(
  'tvd_assessment_model_versions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    modelId: uuid('model_id')
      .notNull()
      .references(() => tvdAssessmentModels.id, { onDelete: 'cascade' }),
    ...standardColumns(),

    version: varchar('version', { length: 32 }).notNull(),
    /** T/P/R/C/E 权重，必须和为 1，由仓储层在写入时校验。 */
    dimensionWeights: jsonb('dimension_weights').notNull().$type<Record<string, number>>().default({}),
    scoringConfig: jsonb('scoring_config').notNull().$type<Record<string, unknown>>().default({}),
    /** 等级切分阈值，如 {A:80,B:65,C:50}。 */
    gradeThresholds: jsonb('grade_thresholds').notNull().$type<Record<string, number>>().default({}),
    /** 数据覆盖率低于此值不给总分，只给"证据不足"。 */
    minDataCoverage: numeric('min_data_coverage', { precision: 4, scale: 3 }).notNull().default('0.600'),
    /** 关键结论需要几个独立来源才计入，对应命题的"双源"要求。 */
    minIndependentSources: integer('min_independent_sources').notNull().default(2),
    notes: text('notes'),
    publishedAt: timestamp('published_at', { withTimezone: true }),
    publishedBy: uuid('published_by'),
  },
  (t) => ({
    byModelVersion: uniqueIndex('tvd_assessment_model_version_uniq').on(t.modelId, t.version),
  }),
);

/** 指标字典。每个指标绑定计算表达式与所需证据，评分才可追溯。 */
export const tvdAssessmentIndicators = pgTable(
  'tvd_assessment_indicators',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    modelVersionId: uuid('model_version_id')
      .notNull()
      .references(() => tvdAssessmentModelVersions.id, { onDelete: 'cascade' }),
    ...standardColumns(),

    code: varchar('code', { length: 64 }).notNull(),
    name: varchar('name', { length: 128 }).notNull(),
    dimension: dimensionEnum('dimension').notNull(),
    /** 二级维度，如 T 下面的 core_tech / patent_quality。 */
    subDimension: varchar('sub_dimension', { length: 64 }),
    weight: numeric('weight', { precision: 6, scale: 4 }).notNull().default('0.0000'),
    /** 确定性计算：表达式或内置算法键，禁止自然语言。 */
    calculatorKey: varchar('calculator_key', { length: 64 }).notNull(),
    params: jsonb('params').notNull().$type<Record<string, unknown>>().default({}),
    /** 该指标依赖的信号类型/指标键，缺失时据此判定"证据不足"。 */
    requiredMetricKeys: jsonb('required_metric_keys').notNull().$type<string[]>().default([]),
    /** 打分方向：原始值越大越好，或需要取反/分档。 */
    normalizeMethod: varchar('normalize_method', { length: 32 }).notNull().default('band'),
    bands: jsonb('bands').notNull().$type<Record<string, unknown>[]>().default([]),
    unit: varchar('unit', { length: 32 }),
    description: text('description'),
  },
  (t) => ({
    byVersionCode: uniqueIndex('tvd_assessment_indicator_uniq').on(t.modelVersionId, t.code),
    byDimension: index('tvd_assessment_indicator_dimension_idx').on(t.modelVersionId, t.dimension),
  }),
);

/** 一次评估运行。输入特征快照保证可复算，AI 解读单独存列且明确标注为推断。 */
export const tvdAssessmentRuns = pgTable(
  'tvd_assessment_runs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tvdEnterpriseId: uuid('tvd_enterprise_id')
      .notNull()
      .references(() => tvdEnterprises.id, { onDelete: 'cascade' }),
    modelVersionId: uuid('model_version_id')
      .notNull()
      .references(() => tvdAssessmentModelVersions.id, { onDelete: 'restrict' }),
    ...standardColumns(),
    dataKind: dataKindEnum('data_kind').notNull().default('UNVERIFIED'),

    runNo: varchar('run_no', { length: 64 }).notNull(),
    trigger: varchar('trigger', { length: 24 }).notNull().default('manual'),
    /** 参与计算的企业画像版本，画像与评分必须版本对齐。 */
    tvdProfileId: uuid('tvd_profile_id'),
    dataCutoffAt: timestamp('data_cutoff_at', { withTimezone: true }),

    totalScore: numeric('total_score', { precision: 6, scale: 2 }),
    grade: varchar('grade', { length: 8 }),
    /** 覆盖率不足时 totalScore 为 null，此字段说明原因而不是给 0 分。 */
    scoreWithheldReason: text('score_withheld_reason'),
    dataCoverage: numeric('data_coverage', { precision: 4, scale: 3 }),
    conflictCount: integer('conflict_count').notNull().default(0),
    pendingReviewCount: integer('pending_review_count').notNull().default(0),
    independentEvidenceCount: integer('independent_evidence_count').notNull().default(0),

    /** 输入特征快照 —— 复算与规则回归的依据。 */
    featureSnapshot: jsonb('feature_snapshot').notNull().$type<Record<string, unknown>>().default({}),
    /** 计算过程逐步记录，UI 的"为什么是这个分"读这里。 */
    derivation: jsonb('derivation').notNull().$type<Record<string, unknown>[]>().default([]),
    /** AI 生成的解释文字，与分数分列存放，不可反向影响分数。 */
    aiInterpretation: text('ai_interpretation'),
    aiRunId: uuid('ai_run_id'),
    /**
     * 运行状态：completed / withheld / failed。
     * 一个列名只能有一个含义，这里等于把 standardColumns() 的 status（记录状态
     * active/superseded/void）覆盖成了运行语义 —— 因此查本表不能按 status='active' 过滤，
     * 作用域靠 tenant_id/bank_id，取最新靠 started_at。
     */
    status: varchar('status', { length: 24 }).notNull().default('completed'),
    startedAt: timestamp('started_at', { withTimezone: true }).notNull().defaultNow(),
    finishedAt: timestamp('finished_at', { withTimezone: true }),
    durationMs: integer('duration_ms'),
  },
  (t) => ({
    byRunNo: uniqueIndex('tvd_assessment_runs_no_uniq').on(t.runNo),
    byEnterprise: index('tvd_assessment_runs_enterprise_idx').on(t.tvdEnterpriseId, t.startedAt),
    byTenant: index('tvd_assessment_runs_tenant_idx').on(t.tenantId, t.bankId, t.status),
  }),
);

/** 分项得分。null 分与 0 分含义不同：null = 无证据，0 = 有证据且确实差。 */
export const tvdAssessmentScores = pgTable(
  'tvd_assessment_scores',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    runId: uuid('run_id')
      .notNull()
      .references(() => tvdAssessmentRuns.id, { onDelete: 'cascade' }),
    indicatorId: uuid('indicator_id')
      .notNull()
      .references(() => tvdAssessmentIndicators.id, { onDelete: 'restrict' }),
    ...standardColumns(),

    dimension: dimensionEnum('dimension').notNull(),
    indicatorCode: varchar('indicator_code', { length: 64 }).notNull(),
    rawValue: numeric('raw_value', { precision: 18, scale: 4 }),
    normalizedScore: numeric('normalized_score', { precision: 6, scale: 2 }),
    weight: numeric('weight', { precision: 6, scale: 4 }).notNull().default('0.0000'),
    weightedScore: numeric('weighted_score', { precision: 8, scale: 4 }),
    /** 无证据时置 1，前端据此显示"待补充"而不是 0 分。 */
    insufficientEvidence: boolean('insufficient_evidence').notNull().default(false),
    confidence: confidenceLevelEnum('confidence').notNull().default('medium'),
    verificationStatus: verificationStatusEnum('verification_status').notNull().default('unverified'),
    independentSourceCount: integer('independent_source_count').notNull().default(0),
    explanation: text('explanation'),
  },
  (t) => ({
    byRunIndicator: uniqueIndex('tvd_assessment_scores_run_uniq').on(t.runId, t.indicatorId),
    byRunDimension: index('tvd_assessment_scores_dimension_idx').on(t.runId, t.dimension),
  }),
);

/** 分数 ↔ 证据。命题要求"每个评分维度可回溯到具体证据"，靠这张表成立。 */
export const tvdScoreEvidenceLinks = pgTable(
  'tvd_score_evidence_links',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    scoreId: uuid('score_id')
      .notNull()
      .references(() => tvdAssessmentScores.id, { onDelete: 'cascade' }),
    evidenceId: uuid('evidence_id').notNull(),
    ...standardColumns(),
    contribution: numeric('contribution', { precision: 4, scale: 3 }).notNull().default('1.000'),
    role: varchar('role', { length: 16 }).notNull().default('primary'),
  },
  (t) => ({
    byPair: uniqueIndex('tvd_score_evidence_link_uniq').on(t.scoreId, t.evidenceId),
    byEvidence: index('tvd_score_evidence_link_evidence_idx').on(t.evidenceId),
  }),
);

export type TvdAssessmentRunRow = typeof tvdAssessmentRuns.$inferSelect;
export type TvdAssessmentScoreRow = typeof tvdAssessmentScores.$inferSelect;
export type TvdAssessmentIndicatorRow = typeof tvdAssessmentIndicators.$inferSelect;
export type TvdAssessmentModelVersionRow = typeof tvdAssessmentModelVersions.$inferSelect;
