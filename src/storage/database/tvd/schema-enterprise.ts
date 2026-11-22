import { boolean, index, integer, jsonb, numeric, pgTable, text, timestamp, uniqueIndex, uuid, varchar } from 'drizzle-orm/pg-core';
import {
  confidenceLevelEnum,
  dataKindEnum,
  standardColumns,
  supersessionColumns,
  verificationStatusEnum,
} from './core';

/**
 * 对 legacy `enterprise` 的引用一律不加外键。
 *
 * 原因：本地演示引擎是 PGlite，而 PGlite 无法加载 db/schema.sql —— 该文件第 12 行
 * `CREATE EXTENSION "vector"`，PGlite 0.5.17 未捆绑 pgvector，且 pgvector npm 0.3.1
 * 没有 PGlite 入口。因此 legacy 表在本地库里不存在，加外键会让迁移直接失败。
 * 指向 legacy 表的完整性由仓储层校验（见 repository/enterprise.ts）。
 * 部署到真实 PostgreSQL 时，legacy 表与 tvd 表同库，可再补外键。
 */

export const tvdEnterprises = pgTable(
  'tvd_enterprises',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    enterpriseId: uuid('enterprise_id').notNull(),
    ...standardColumns(),
    dataKind: dataKindEnum('data_kind').notNull().default('UNVERIFIED'),

    displayName: varchar('display_name', { length: 255 }).notNull(),
    unifiedCode: varchar('unified_code', { length: 32 }),
    registrationCode: varchar('registration_code', { length: 32 }),

    industryCode: varchar('industry_code', { length: 32 }),
    industryName: varchar('industry_name', { length: 128 }),
    trackCode: varchar('track_code', { length: 64 }),
    trackName: varchar('track_name', { length: 128 }),

    regionCode: varchar('region_code', { length: 32 }),
    regionName: varchar('region_name', { length: 64 }),
    parkName: varchar('park_name', { length: 128 }),

    /** 初创 / 成长 / 成熟 / 转型 —— TVD-11 对标分组依赖它。 */
    stage: varchar('stage', { length: 32 }),
    /** 成立日期允许不精确（如仅有年份），故存文本而非 date。 */
    foundedOn: varchar('founded_on', { length: 16 }),
    employeeBand: varchar('employee_band', { length: 32 }),
    listedFlag: boolean('listed_flag').notNull().default(false),

    /** 资质标签（创新型中小 / 专精特新 / 小巨人 / 高企）—— 官方解读第二节的初筛依据。 */
    qualifications: jsonb('qualifications').notNull().$type<string[]>().default([]),
    qualificationEvidence: jsonb('qualification_evidence').notNull().$type<Record<string, string[]>>().default({}),

    coreTechSummary: text('core_tech_summary'),
    techKeywords: jsonb('tech_keywords').notNull().$type<string[]>().default([]),

    identityConfidence: confidenceLevelEnum('identity_confidence').notNull().default('low'),
    verificationStatus: verificationStatusEnum('verification_status').notNull().default('unverified'),
    /** 主体归一结果：匹配到的 canonical tvd_enterprises.id（自引用，允许为空表示未归一）。 */
    canonicalId: uuid('canonical_id'),

    ...supersessionColumns(),
  },
  (t) => ({
    /**
     * 同一 enterprise 可有多个生效版本（supersession），因此这里不是唯一索引；
     * "同时只有一条 effective_to is null" 由仓储层在事务内保证。
     */
    byEnterprise: index('tvd_enterprises_enterprise_idx').on(t.enterpriseId, t.effectiveTo),
    byTenantBank: index('tvd_enterprises_tenant_bank_idx').on(t.tenantId, t.bankId, t.status),
    byTrack: index('tvd_enterprises_track_idx').on(t.tenantId, t.trackCode),
    byName: index('tvd_enterprises_name_trgm_idx').on(t.displayName),
    byCanonical: index('tvd_enterprises_canonical_idx').on(t.canonicalId),
  }),
);

/**
 * TVD-03 企业实体归一。别名与工商全称分开存，similarity() 匹配走这张表，
 * 这样"银智科技（北京）有限公司"能被归到"北京银智科技有限公司"名下。
 */
export const tvdEnterpriseAliases = pgTable(
  'tvd_enterprise_aliases',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tvdEnterpriseId: uuid('tvd_enterprise_id')
      .notNull()
      .references(() => tvdEnterprises.id, { onDelete: 'cascade' }),
    ...standardColumns(),
    alias: varchar('alias', { length: 255 }).notNull(),
    aliasKind: varchar('alias_kind', { length: 32 }).notNull().default('legal_name'),
    normalizedAlias: varchar('normalized_alias', { length: 255 }).notNull(),
    sourceRecordId: uuid('source_record_id'),
    dataKind: dataKindEnum('data_kind').notNull().default('UNVERIFIED'),
  },
  (t) => ({
    byAlias: uniqueIndex('tvd_enterprise_aliases_uniq').on(t.tvdEnterpriseId, t.normalizedAlias),
    byNormalized: index('tvd_enterprise_aliases_norm_trgm_idx').on(t.normalizedAlias),
    byTenant: index('tvd_enterprise_aliases_tenant_idx').on(t.tenantId, t.bankId, t.status),
  }),
);

/**
 * TVD-12 企业技术信用画像。画像按版本累积、不覆盖，评分历史依赖它。
 * 内容以分层结构存 JSONB（PRD 17.1 六层），但可查询的汇总字段一律单列。
 */
export const tvdEnterpriseProfiles = pgTable(
  'tvd_enterprise_profiles',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tvdEnterpriseId: uuid('tvd_enterprise_id')
      .notNull()
      .references(() => tvdEnterprises.id, { onDelete: 'cascade' }),
    ...standardColumns(),

    /** 由哪次评估产出，用于画像与评分的可追溯绑定。 */
    assessmentRunId: uuid('assessment_run_id'),
    modelVersionId: uuid('model_version_id'),
    profileVersion: varchar('profile_version', { length: 32 }).notNull(),

    /** 0-100，保留两位小数；null 表示证据不足、尚未出分。 */
    overallScore: numeric('overall_score', { precision: 5, scale: 2 }),
    scoreConfidence: confidenceLevelEnum('score_confidence'),
    /** 参与评分的指标权重占比，0-1；用于区分"分低"和"没数据"。 */
    dataCoverage: numeric('data_coverage', { precision: 4, scale: 3 }),
    evidenceConfidence: confidenceLevelEnum('evidence_confidence'),

    identityLayer: jsonb('identity_layer').notNull().$type<Record<string, unknown>>().default({}),
    techIdentityLayer: jsonb('tech_identity_layer').notNull().$type<Record<string, unknown>>().default({}),
    valueLayer: jsonb('value_layer').notNull().$type<Record<string, unknown>>().default({}),
    evidenceLayer: jsonb('evidence_layer').notNull().$type<Record<string, unknown>>().default({}),
    growthLayer: jsonb('growth_layer').notNull().$type<Record<string, unknown>>().default({}),
    riskLayer: jsonb('risk_layer').notNull().$type<Record<string, unknown>>().default({}),

    strengths: jsonb('strengths').notNull().$type<string[]>().default([]),
    weaknesses: jsonb('weaknesses').notNull().$type<string[]>().default([]),
    riskNotes: jsonb('risk_notes').notNull().$type<string[]>().default([]),
    openQuestions: jsonb('open_questions').notNull().$type<string[]>().default([]),

    conflictCount: integer('conflict_count').notNull().default(0),
    pendingVerificationCount: integer('pending_verification_count').notNull().default(0),
    dataKind: dataKindEnum('data_kind').notNull().default('AI_INFERENCE'),

    ...supersessionColumns(),
  },
  (t) => ({
    byEnterpriseVersion: uniqueIndex('tvd_enterprise_profiles_version_uniq').on(
      t.tvdEnterpriseId,
      t.profileVersion,
    ),
    byEnterpriseActive: index('tvd_enterprise_profiles_active_idx').on(
      t.tvdEnterpriseId,
      t.effectiveTo,
    ),
    byRun: index('tvd_enterprise_profiles_run_idx').on(t.assessmentRunId),
  }),
);

export type TvdEnterpriseRow = typeof tvdEnterprises.$inferSelect;
export type TvdEnterpriseAliasRow = typeof tvdEnterpriseAliases.$inferSelect;
export type TvdEnterpriseProfileRow = typeof tvdEnterpriseProfiles.$inferSelect;
