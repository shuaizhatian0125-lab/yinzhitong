import { boolean, index, integer, jsonb, numeric, pgTable, text, timestamp, uniqueIndex, uuid, varchar } from 'drizzle-orm/pg-core';
import { dataKindEnum, dimensionEnum, standardColumns, verificationStatusEnum } from './core';
import { tvdEnterprises } from './schema-enterprise';
import { tvdAssessmentRuns } from './schema-assessment';

/**
 * TVD-11 同业对标 + TVD-13 产品与机会匹配。
 *
 * 对标必须显式定义"和谁比"：样本集（benchmark_set）单独建表并冻结成员，
 * 否则同一家企业在不同页面会拿到不同的"行业领先"结论，
 * 而这个差异无法解释 —— 对标结论就失去了可信度。
 */
export const tvdBenchmarkSets = pgTable(
  'tvd_benchmark_sets',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    ...standardColumns(),
    code: varchar('code', { length: 64 }).notNull(),
    name: varchar('name', { length: 128 }).notNull(),
    /** 分组口径：同行业同规模 / 同赛道 / 同区域，写入时固化，不可事后改。 */
    method: varchar('method', { length: 32 }).notNull(),
    criteria: jsonb('criteria').notNull().$type<Record<string, unknown>>().default({}),
    memberCount: integer('member_count').notNull().default(0),
    /** 成员少于该数量时不出对标结论，避免小样本误导。 */
    minMembers: integer('min_members').notNull().default(5),
    note: text('note'),
  },
  (t) => ({
    byCode: uniqueIndex('tvd_benchmark_sets_code_uniq').on(t.code),
  }),
);

export const tvdBenchmarkMembers = pgTable(
  'tvd_benchmark_members',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    setId: uuid('set_id')
      .notNull()
      .references(() => tvdBenchmarkSets.id, { onDelete: 'cascade' }),
    tvdEnterpriseId: uuid('tvd_enterprise_id')
      .notNull()
      .references(() => tvdEnterprises.id, { onDelete: 'cascade' }),
    ...standardColumns(),
    /** 被评估企业自身在样本中标记为 subject，UI 据此高亮。 */
    isSubject: boolean('is_subject').notNull().default(false),
    metrics: jsonb('metrics').notNull().$type<Record<string, unknown>>().default({}),
    /** 指标缺失项，对标表格里要显示"无数据"而不是 0。 */
    missingMetrics: jsonb('missing_metrics').notNull().$type<string[]>().default([]),
  },
  (t) => ({
    byPair: uniqueIndex('tvd_benchmark_member_uniq').on(t.setId, t.tvdEnterpriseId),
    bySet: index('tvd_benchmark_member_set_idx').on(t.setId, t.isSubject),
  }),
);

/** 一次对标计算结果：分位、均值、差距都存下来，便于跨次比较趋势。 */
export const tvdBenchmarkResults = pgTable(
  'tvd_benchmark_results',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    setId: uuid('set_id').notNull().references(() => tvdBenchmarkSets.id, { onDelete: 'cascade' }),
    subjectEnterpriseId: uuid('subject_enterprise_id')
      .notNull()
      .references(() => tvdEnterprises.id, { onDelete: 'cascade' }),
    /**
     * notNull 是刻意的：Postgres 唯一索引不约束 NULL 值。
     * 若允许为空，"同一 run 同一指标只有一条"就退化成数据库管不住的软约束，
     * 重算会不断插入新行而非覆盖，趋势曲线里混入无法解释的伪记录。
     */
    assessmentRunId: uuid('assessment_run_id')
      .notNull()
      .references(() => tvdAssessmentRuns.id, { onDelete: 'cascade' }),
    ...standardColumns(),

    metricKey: varchar('metric_key', { length: 64 }).notNull(),
    dimension: dimensionEnum('dimension'),
    subjectValue: numeric('subject_value', { precision: 18, scale: 4 }),
    sampleMean: numeric('sample_mean', { precision: 18, scale: 4 }),
    sampleMedian: numeric('sample_median', { precision: 18, scale: 4 }),
    sampleP90: numeric('sample_p90', { precision: 18, scale: 4 }),
    sampleMin: numeric('sample_min', { precision: 18, scale: 4 }),
    sampleMax: numeric('sample_max', { precision: 18, scale: 4 }),
    percentile: numeric('percentile', { precision: 5, scale: 2 }),
    rank: integer('rank'),
    sampleSize: integer('sample_size').notNull().default(0),
    /** 样本不足时结论不可用，此字段说明原因。 */
    usable: boolean('usable').notNull().default(true),
    caveat: text('caveat'),
    computedAt: timestamp('computed_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    bySubjectMetric: uniqueIndex('tvd_benchmark_result_uniq').on(
      t.setId,
      t.subjectEnterpriseId,
      t.metricKey,
      t.assessmentRunId,
    ),
    bySubject: index('tvd_benchmark_result_subject_idx').on(t.subjectEnterpriseId, t.computedAt),
  }),
);

/** 行内产品目录。匹配规则与产品分开：产品改了不该动规则，反之亦然。 */
export const tvdProducts = pgTable(
  'tvd_products',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    ...standardColumns(),
    code: varchar('code', { length: 64 }).notNull(),
    name: varchar('name', { length: 128 }).notNull(),
    category: varchar('category', { length: 32 }).notNull(),
    /** credit 授信 / settle 结算 / supply_chain 供应链 / intl 国际业务 / equity 投贷联动。 */
    productType: varchar('product_type', { length: 24 }).notNull().default('credit'),
    targetStage: jsonb('target_stage').notNull().$type<string[]>().default([]),
    amountMin: numeric('amount_min', { precision: 18, scale: 2 }),
    amountMax: numeric('amount_max', { precision: 18, scale: 2 }),
    termMonths: integer('term_months'),
    collateralRequired: boolean('collateral_required').notNull().default(false),
    /** 准入硬性条件，任一不满足即不推荐（不是降低匹配分）。 */
    hardRequirements: jsonb('hard_requirements').notNull().$type<Record<string, unknown>[]>().default([]),
    sellingPoints: jsonb('selling_points').notNull().$type<string[]>().default([]),
    docUrl: varchar('doc_url', { length: 512 }),
    active: boolean('active').notNull().default(true),
    note: text('note'),
  },
  (t) => ({
    byCode: uniqueIndex('tvd_products_code_uniq').on(t.code),
    byType: index('tvd_products_type_idx').on(t.productType, t.active),
  }),
);

/**
 * 匹配结果。每个推荐都必须给出触发条件与证据，
 * "AI 觉得合适"不构成推荐依据。
 */
export const tvdMatchResults = pgTable(
  'tvd_match_results',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tvdEnterpriseId: uuid('tvd_enterprise_id')
      .notNull()
      .references(() => tvdEnterprises.id, { onDelete: 'cascade' }),
    productId: uuid('product_id')
      .notNull()
      .references(() => tvdProducts.id, { onDelete: 'cascade' }),
    assessmentRunId: uuid('assessment_run_id')
      .notNull()
      .references(() => tvdAssessmentRuns.id, { onDelete: 'cascade' }),
    ...standardColumns(),
    dataKind: dataKindEnum('data_kind').notNull().default('UNVERIFIED'),

    matchScore: numeric('match_score', { precision: 6, scale: 2 }).notNull().default('0.00'),
    /** 确定性规则命中项，与 AI 补充理由分列。 */
    matchedRules: jsonb('matched_rules').notNull().$type<Record<string, unknown>[]>().default([]),
    blockedBy: jsonb('blocked_by').notNull().$type<string[]>().default([]),
    evidenceIds: jsonb('evidence_ids').notNull().$type<string[]>().default([]),
    /** 需求缺口类型，来自 TVD-02 的金融需求识别。 */
    demandType: varchar('demand_type', { length: 32 }),
    urgency: varchar('urgency', { length: 16 }),
    suggestedAmount: numeric('suggested_amount', { precision: 18, scale: 2 }),
    aiReasoning: text('ai_reasoning'),
    /** 未达双源门槛的推荐不得进入"可营销"列表。 */
    verificationStatus: verificationStatusEnum('verification_status').notNull().default('unverified'),
    dismissedReason: text('dismissed_reason'),
    computedAt: timestamp('computed_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    byPair: uniqueIndex('tvd_match_result_uniq').on(t.tvdEnterpriseId, t.productId, t.assessmentRunId),
    byEnterprise: index('tvd_match_result_enterprise_idx').on(t.tvdEnterpriseId, t.matchScore),
    byProduct: index('tvd_match_result_product_idx').on(t.productId),
  }),
);

export type TvdProductRow = typeof tvdProducts.$inferSelect;
export type TvdMatchResultRow = typeof tvdMatchResults.$inferSelect;
export type TvdBenchmarkResultRow = typeof tvdBenchmarkResults.$inferSelect;
