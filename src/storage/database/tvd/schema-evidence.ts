import { boolean, index, integer, jsonb, numeric, pgTable, text, timestamp, uniqueIndex, uuid, varchar } from 'drizzle-orm/pg-core';
import {
  confidenceLevelEnum,
  conflictSeverityEnum,
  conflictTypeEnum,
  dataKindEnum,
  dimensionEnum,
  reviewTaskStateEnum,
  standardColumns,
  verificationStatusEnum,
} from './core';
import { tvdEnterprises } from './schema-enterprise';
import { tvdSourceRecords } from './schema-source';

/**
 * TVD-08 / TVD-09。
 *
 * 这里的核心约束是：证据不可变、结论必须挂证据、独立性按来源根节点计算。
 * evidence 与 source_record 分开 —— 来源是"哪里说的"，证据是"说了什么可被引用的事实片段"，
 * 同一条来源可以产出多条证据，同一条证据也可以被多个结论复用。
 */

export const tvdEvidence = pgTable(
  'tvd_evidence',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tvdEnterpriseId: uuid('tvd_enterprise_id')
      .notNull()
      .references(() => tvdEnterprises.id, { onDelete: 'cascade' }),
    sourceRecordId: uuid('source_record_id')
      .notNull()
      .references(() => tvdSourceRecords.id, { onDelete: 'restrict' }),
    ...standardColumns(),
    dataKind: dataKindEnum('data_kind').notNull().default('UNVERIFIED'),

    /** 可引用的最小事实单元。 */
    claimText: text('claim_text').notNull(),
    excerpt: text('excerpt'),
    /** 原文定位（页码/段落/表格坐标），让"点击回溯原始证据"可实现。 */
    locator: jsonb('locator').notNull().$type<Record<string, unknown>>().default({}),

    metricKey: varchar('metric_key', { length: 64 }),
    metricValue: numeric('metric_value', { precision: 18, scale: 4 }),
    metricUnit: varchar('metric_unit', { length: 32 }),
    metricPeriod: varchar('metric_period', { length: 32 }),

    credibility: numeric('credibility', { precision: 4, scale: 3 }).notNull().default('0.500'),
    verificationStatus: verificationStatusEnum('verification_status').notNull().default('unverified'),
    /** 冗余存放来源根节点，独立性分组查询不必再回表追 lineage。 */
    originRecordId: uuid('origin_record_id'),
    observedAt: timestamp('observed_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    byEnterprise: index('tvd_evidence_enterprise_idx').on(t.tvdEnterpriseId, t.status),
    bySource: index('tvd_evidence_source_idx').on(t.sourceRecordId),
    byMetric: index('tvd_evidence_metric_idx').on(t.tvdEnterpriseId, t.metricKey),
    byOrigin: index('tvd_evidence_origin_idx').on(t.originRecordId),
    byTenant: index('tvd_evidence_tenant_idx').on(t.tenantId, t.bankId, t.status),
  }),
);

/** 结论 ↔ 证据的多对多。结论可以是信号、评分子指标、画像条目或报告结论。 */
export const tvdEvidenceLinks = pgTable(
  'tvd_evidence_links',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    evidenceId: uuid('evidence_id')
      .notNull()
      .references(() => tvdEvidence.id, { onDelete: 'cascade' }),
    ...standardColumns(),
    /** 被支撑的结论类型与主键，跨表引用用 (kind, id) 而非外键。 */
    conclusionKind: varchar('conclusion_kind', { length: 32 }).notNull(),
    conclusionId: uuid('conclusion_id').notNull(),
    role: varchar('role', { length: 16 }).notNull().default('primary'),
    weight: numeric('weight', { precision: 4, scale: 3 }).notNull().default('1.000'),
  },
  (t) => ({
    byConclusion: uniqueIndex('tvd_evidence_links_conclusion_uniq').on(
      t.conclusionKind,
      t.conclusionId,
      t.evidenceId,
    ),
    byEvidence: index('tvd_evidence_links_evidence_idx').on(t.evidenceId),
  }),
);

/**
 * 独立性判定结果。
 * 判定规则：按 origin_record_id 归并转载，同一根节点只计 1 个独立来源；
 * 同一根节点下的不同表述不构成独立印证。
 */
export const tvdEvidenceIndependence = pgTable(
  'tvd_evidence_independence',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    conclusionKind: varchar('conclusion_kind', { length: 32 }).notNull(),
    conclusionId: uuid('conclusion_id').notNull(),
    ...standardColumns(),

    evidenceCount: integer('evidence_count').notNull().default(0),
    originCount: integer('origin_count').notNull().default(0),
    tierSpread: integer('tier_spread').notNull().default(0),
    /** 归并转载后的独立来源数 —— 门槛判定用这个，不是 evidenceCount。 */
    independentSourceCount: integer('independent_source_count').notNull().default(0),
    independenceScore: numeric('independence_score', { precision: 4, scale: 3 }).notNull().default('0.000'),
    meetsTwoSourceGate: boolean('meets_two_source_gate').notNull().default(false),
    /** 参与判定的 origin 明细，供 UI 展示"为什么这算/不算独立"。 */
    origins: jsonb('origins').notNull().$type<Record<string, unknown>>().default({}),
    reason: text('reason'),
    evaluatedAt: timestamp('evaluated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    byConclusion: uniqueIndex('tvd_evidence_independence_conclusion_uniq').on(
      t.conclusionKind,
      t.conclusionId,
    ),
  }),
);

/**
 * TVD-09 标准化事实。冲突检测不比较原文，比较归一后的 (subject, metric, period) 值，
 * 否则"约1.2亿"与"12,000万元"会被误判为冲突。
 */
export const tvdFactClaims = pgTable(
  'tvd_fact_claims',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tvdEnterpriseId: uuid('tvd_enterprise_id')
      .notNull()
      .references(() => tvdEnterprises.id, { onDelete: 'cascade' }),
    evidenceId: uuid('evidence_id')
      .notNull()
      .references(() => tvdEvidence.id, { onDelete: 'cascade' }),
    ...standardColumns(),

    /** 归一后的事实身份。 */
    factKey: varchar('fact_key', { length: 192 }).notNull(),
    subject: varchar('subject', { length: 256 }).notNull(),
    metricKey: varchar('metric_key', { length: 64 }).notNull(),
    period: varchar('period', { length: 32 }).notNull(),

    numericValue: numeric('numeric_value', { precision: 18, scale: 4 }),
    normalizedValue: varchar('normalized_value', { length: 256 }),
    unit: varchar('unit', { length: 32 }),
    /** 原文中的表述，保留歧义本身。 */
    rawExpression: text('raw_expression'),
    asOfDate: timestamp('as_of_date', { withTimezone: true }),
  },
  (t) => ({
    byFactKey: index('tvd_fact_claims_fact_idx').on(t.tvdEnterpriseId, t.factKey, t.status),
    byMetricPeriod: index('tvd_fact_claims_metric_idx').on(t.metricKey, t.period),
  }),
);

export const tvdFactConflicts = pgTable(
  'tvd_fact_conflicts',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tvdEnterpriseId: uuid('tvd_enterprise_id')
      .notNull()
      .references(() => tvdEnterprises.id, { onDelete: 'cascade' }),
    ...standardColumns(),

    factKey: varchar('fact_key', { length: 192 }).notNull(),
    conflictType: conflictTypeEnum('conflict_type').notNull(),
    severity: conflictSeverityEnum('severity').notNull().default('warning'),
    /** 参与比对的 claim 明细（含各自来源与值），冲突展示依赖它。 */
    claimIds: jsonb('claim_ids').notNull().$type<string[]>().default([]),
    comparison: jsonb('comparison').notNull().$type<Record<string, unknown>>().default({}),
    /** 差异幅度，数值型冲突才有。 */
    deltaRatio: numeric('delta_ratio', { precision: 8, scale: 5 }),
    aiExplanation: text('ai_explanation'),
    /** 未处理的冲突必须进入待核实清单，不允许被自动抹平。 */
    resolved: boolean('resolved').notNull().default(false),
    detectedAt: timestamp('detected_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    byEnterprise: index('tvd_fact_conflicts_enterprise_idx').on(t.tvdEnterpriseId, t.severity),
    byFactKey: index('tvd_fact_conflicts_fact_idx').on(t.factKey),
    unresolved: index('tvd_fact_conflicts_unresolved_idx').on(t.resolved, t.status),
  }),
);

/** 人工裁决记录。谁、何时、依据什么证据、怎么判的 —— 可复核的关键。 */
export const tvdConflictResolutions = pgTable(
  'tvd_conflict_resolutions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    conflictId: uuid('conflict_id')
      .notNull()
      .references(() => tvdFactConflicts.id, { onDelete: 'cascade' }),
    ...standardColumns(),
    decidedBy: uuid('decided_by'),
    decision: varchar('decision', { length: 32 }).notNull(),
    acceptedClaimId: uuid('accepted_claim_id'),
    rationale: text('rationale').notNull(),
    supportingEvidenceIds: jsonb('supporting_evidence_ids').notNull().$type<string[]>().default([]),
    decidedAt: timestamp('decided_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    byConflict: index('tvd_conflict_resolutions_conflict_idx').on(t.conflictId, t.decidedAt),
  }),
);

/** TVD-09 待核实事项 + 人工复核队列。 */
export const tvdReviewTasks = pgTable(
  'tvd_review_tasks',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tvdEnterpriseId: uuid('tvd_enterprise_id')
      .notNull()
      .references(() => tvdEnterprises.id, { onDelete: 'cascade' }),
    ...standardColumns(),

    originKind: varchar('origin_kind', { length: 32 }).notNull(),
    originId: uuid('origin_id'),
    title: varchar('title', { length: 256 }).notNull(),
    detail: text('detail').notNull(),
    /** 需要补什么才能定论。 */
    requiredAction: text('required_action'),
    blockingDimension: dimensionEnum('blocking_dimension'),
    severity: conflictSeverityEnum('severity').notNull().default('warning'),
    state: reviewTaskStateEnum('state').notNull().default('open'),
    assignedTo: uuid('assigned_to'),
    resolvedAt: timestamp('resolved_at', { withTimezone: true }),
    resolutionNote: text('resolution_note'),
    confidence: confidenceLevelEnum('confidence').notNull().default('medium'),
  },
  (t) => ({
    byEnterpriseState: index('tvd_review_tasks_enterprise_idx').on(t.tvdEnterpriseId, t.state),
    byTenant: index('tvd_review_tasks_tenant_idx').on(t.tenantId, t.bankId, t.state),
  }),
);

export type TvdEvidenceRow = typeof tvdEvidence.$inferSelect;
export type TvdFactClaimRow = typeof tvdFactClaims.$inferSelect;
export type TvdFactConflictRow = typeof tvdFactConflicts.$inferSelect;
export type TvdReviewTaskRow = typeof tvdReviewTasks.$inferSelect;
