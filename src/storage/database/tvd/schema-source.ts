import { boolean, index, integer, jsonb, numeric, pgTable, text, timestamp, uniqueIndex, uuid, varchar } from 'drizzle-orm/pg-core';
import {
  dataKindEnum,
  signalTypeEnum,
  sourceAccessMethodEnum,
  sourceTierEnum,
  standardColumns,
  verificationStatusEnum,
} from './core';
import { tvdEnterprises } from './schema-enterprise';

/**
 * TVD-02 / TVD-08 数据来源侧。
 *
 * 关键设计：source_records 与 source_lineage 分开。
 * 一篇媒体报道转载官方公告时，两条记录之间存在 lineage，
 * 独立性判定必须顺着 lineage 归并到同一个 origin，
 * 否则"两个来源"会因为转载而虚高 —— 这正是命题要求的
 * "关键结论至少由两个独立来源支撑"能否成立的前提。
 */

export const tvdDataSources = pgTable(
  'tvd_data_sources',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    ...standardColumns(),

    code: varchar('code', { length: 64 }).notNull(),
    name: varchar('name', { length: 128 }).notNull(),
    tier: sourceTierEnum('tier').notNull(),
    /** 该源覆盖哪些信号类型，用于采集计划编排。 */
    coversSignalTypes: jsonb('covers_signal_types').notNull().$type<string[]>().default([]),

    baseUrl: varchar('base_url', { length: 512 }),
    accessMethod: sourceAccessMethodEnum('access_method').notNull().default('demo_fixture'),
    /** 合规字段：是否需要登录、是否付费授权、robots/服务条款约束。 */
    requiresAuth: boolean('requires_auth').notNull().default(false),
    requiresPaidLicense: boolean('requires_paid_license').notNull().default(false),
    usageConstraint: text('usage_constraint'),
    /** 频率上限；0 表示禁止自动抓取。 */
    rateLimitPerMinute: integer('rate_limit_per_minute').notNull().default(0),
    crawlAllowed: boolean('crawl_allowed').notNull().default(false),

    /** 初始来源可信度 0-1，PRD 13.2 按 tier 给参考值。 */
    credibility: numeric('credibility', { precision: 4, scale: 3 }).notNull().default('0.500'),
    connectorKey: varchar('connector_key', { length: 64 }),
    /** 未接入真实源时明确标注，避免把接口能力伪装成采集能力。 */
    connected: boolean('connected').notNull().default(false),
    lastSyncAt: timestamp('last_sync_at', { withTimezone: true }),
  },
  (t) => ({
    byCode: uniqueIndex('tvd_data_sources_code_uniq').on(t.code),
    byTenant: index('tvd_data_sources_tenant_idx').on(t.tenantId, t.bankId, t.status),
    byTier: index('tvd_data_sources_tier_idx').on(t.tier),
  }),
);

export const tvdSourceRecords = pgTable(
  'tvd_source_records',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    dataSourceId: uuid('data_source_id')
      .notNull()
      .references(() => tvdDataSources.id, { onDelete: 'restrict' }),
    ...standardColumns(),
    dataKind: dataKindEnum('data_kind').notNull().default('UNVERIFIED'),

    /** 可回溯的原始定位：URL / 文号 / 数据库记录号。 */
    url: varchar('url', { length: 1024 }),
    documentNumber: varchar('document_number', { length: 128 }),
    title: varchar('title', { length: 512 }),
    publisher: varchar('publisher', { length: 256 }),
    author: varchar('author', { length: 128 }),

    retrievedAt: timestamp('retrieved_at', { withTimezone: true }).notNull().defaultNow(),
    /** 原文发布时间；与获取时间分开，时间冲突检测依赖它。 */
    publishedAt: timestamp('published_at', { withTimezone: true }),
    /** 原文快照与结构化抽取结果。原文不可覆盖。 */
    rawContent: text('raw_content'),
    extracted: jsonb('extracted').notNull().$type<Record<string, unknown>>().default({}),
    contentHash: varchar('content_hash', { length: 64 }),

    accessMethod: sourceAccessMethodEnum('access_method').notNull().default('demo_fixture'),
    permissionNote: text('permission_note'),
    verificationStatus: verificationStatusEnum('verification_status').notNull().default('unverified'),
    /** 转载链上的根记录；自身为根时等于自己。用于独立性归并。 */
    originRecordId: uuid('origin_record_id'),
    depth: integer('depth').notNull().default(0),
  },
  (t) => ({
    byTenant: index('tvd_source_records_tenant_idx').on(t.tenantId, t.bankId, t.status),
    bySource: index('tvd_source_records_source_idx').on(t.dataSourceId, t.retrievedAt),
    byOrigin: index('tvd_source_records_origin_idx').on(t.originRecordId),
    byHash: index('tvd_source_records_hash_idx').on(t.contentHash),
  }),
);

export const tvdSourceLineage = pgTable(
  'tvd_source_lineage',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    /** derived 引用 original：derived 不构成独立来源。 */
    derivedRecordId: uuid('derived_record_id')
      .notNull()
      .references(() => tvdSourceRecords.id, { onDelete: 'cascade' }),
    originalRecordId: uuid('original_record_id')
      .notNull()
      .references(() => tvdSourceRecords.id, { onDelete: 'cascade' }),
    ...standardColumns(),
    relation: varchar('relation', { length: 32 }).notNull().default('repost'),
    confidence: numeric('confidence', { precision: 4, scale: 3 }).notNull().default('1.000'),
    note: text('note'),
  },
  (t) => ({
    byDerived: uniqueIndex('tvd_source_lineage_derived_uniq').on(t.derivedRecordId, t.originalRecordId),
    byOriginal: index('tvd_source_lineage_original_idx').on(t.originalRecordId),
  }),
);

/**
 * TVD-02 统一信号。14 类信号共用一张表，类型判别 + JSONB 载荷，
 * 但所有需要查询/评分的字段一律提升为结构化列（PRD 21.3：核心查询字段必须结构化）。
 */
export const tvdSignals = pgTable(
  'tvd_signals',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tvdEnterpriseId: uuid('tvd_enterprise_id')
      .notNull()
      .references(() => tvdEnterprises.id, { onDelete: 'cascade' }),
    ...standardColumns(),
    dataKind: dataKindEnum('data_kind').notNull().default('UNVERIFIED'),

    signalType: signalTypeEnum('signal_type').notNull(),
    /** 同类信号的判别键，例如 hiring 的岗位名、order 的合同名。 */
    subject: varchar('subject', { length: 256 }).notNull(),
    observedValue: numeric('observed_value', { precision: 18, scale: 4 }),
    valueUnit: varchar('value_unit', { length: 32 }),
    textValue: text('text_value'),

    /** 信号自身的时间语义：发生期与获知期分开，避免把转载时间当发生时间。 */
    occurredAt: timestamp('occurred_at', { withTimezone: true }),
    observedAt: timestamp('observed_at', { withTimezone: true }).notNull().defaultNow(),
    periodStart: timestamp('period_start', { withTimezone: true }),
    periodEnd: timestamp('period_end', { withTimezone: true }),

    attributes: jsonb('attributes').notNull().$type<Record<string, unknown>>().default({}),

    /** 归一化与去重结果。dedupKey 相同视为同一事实的不同表述。 */
    normalizedKey: varchar('normalized_key', { length: 256 }),
    dedupKey: varchar('dedup_key', { length: 128 }),
    mergeCount: integer('merge_count').notNull().default(1),

    confidence: numeric('confidence', { precision: 4, scale: 3 }).notNull().default('0.500'),
    verificationStatus: verificationStatusEnum('verification_status').notNull().default('unverified'),
    /** 支撑该信号的来源数与独立来源数（由 tvd_signal_sources 派生并缓存）。 */
    sourceCount: integer('source_count').notNull().default(0),
    independentSourceCount: integer('independent_source_count').notNull().default(0),
  },
  (t) => ({
    byEnterpriseType: index('tvd_signals_enterprise_type_idx').on(
      t.tvdEnterpriseId,
      t.signalType,
      t.status,
    ),
    byDedupKey: index('tvd_signals_dedup_idx').on(t.dedupKey),
    byNormalized: index('tvd_signals_normalized_idx').on(t.normalizedKey),
    byTenant: index('tvd_signals_tenant_idx').on(t.tenantId, t.bankId, t.status),
    byOccurred: index('tvd_signals_occurred_idx').on(t.tvdEnterpriseId, t.occurredAt),
  }),
);

export const tvdSignalSources = pgTable(
  'tvd_signal_sources',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    signalId: uuid('signal_id')
      .notNull()
      .references(() => tvdSignals.id, { onDelete: 'cascade' }),
    sourceRecordId: uuid('source_record_id')
      .notNull()
      .references(() => tvdSourceRecords.id, { onDelete: 'cascade' }),
    ...standardColumns(),
    /** 同一信号内，该来源是否为首次登记（用于区分主证与旁证）。 */
    role: varchar('role', { length: 16 }).notNull().default('supporting'),
    excerpt: text('excerpt'),
  },
  (t) => ({
    byPair: uniqueIndex('tvd_signal_sources_pair_uniq').on(t.signalId, t.sourceRecordId),
    bySignal: index('tvd_signal_sources_signal_idx').on(t.signalId),
  }),
);

export type TvdDataSourceRow = typeof tvdDataSources.$inferSelect;
export type TvdSourceRecordRow = typeof tvdSourceRecords.$inferSelect;
export type TvdSignalRow = typeof tvdSignals.$inferSelect;
