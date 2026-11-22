import { boolean, index, integer, jsonb, numeric, pgTable, text, timestamp, uniqueIndex, uuid, varchar } from 'drizzle-orm/pg-core';
import {
  anomalyTypeEnum,
  confidenceLevelEnum,
  dataKindEnum,
  patentLegalStatusEnum,
  patentTypeEnum,
  recordStatusEnum,
  standardColumns,
  verificationStatusEnum,
} from './core';
import { tvdEnterprises } from './schema-enterprise';
import { tvdEvidence } from './schema-evidence';

/**
 * TVD-04 / TVD-05 / TVD-06 专利域。
 *
 * 命题要求"质量优先于数量"，因此专利表本身只存客观事实，
 * 质量分与异常判定分别落在 patent_quality_assessments 与 patent_anomalies，
 * 两者都是可重算的派生数据 —— 规则版本升级后能整体重跑并对比。
 */

/** 发明人。同名不自动合并，身份归并需要证据，故保留候选与置信度。 */
export const tvdPeople = pgTable(
  'tvd_people',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    ...standardColumns(),
    name: varchar('name', { length: 128 }).notNull(),
    nameNormalized: varchar('name_normalized', { length: 128 }).notNull(),
    /** 归并到另一条人物记录（同名歧义解决后）。 */
    mergedInto: uuid('merged_into'),
    /** 归并依据：仅同名 → low；同名+同雇主/同共现网络 → medium+。 */
    identityConfidence: confidenceLevelEnum('identity_confidence').notNull().default('low'),
    aliasCount: integer('alias_count').notNull().default(1),
    note: text('note'),
  },
  (t) => ({
    byName: index('tvd_people_name_idx').on(t.nameNormalized, t.status),
    byTenant: index('tvd_people_tenant_idx').on(t.tenantId, t.bankId, t.status),
  }),
);

export const tvdPatents = pgTable(
  'tvd_patents',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tvdEnterpriseId: uuid('tvd_enterprise_id')
      .notNull()
      .references(() => tvdEnterprises.id, { onDelete: 'cascade' }),
    ...standardColumns(),
    dataKind: dataKindEnum('data_kind').notNull().default('UNVERIFIED'),
    verificationStatus: verificationStatusEnum('verification_status').notNull().default('unverified'),

    /** 公开号 / 申请号，二者都可能是检索入口，都保留。 */
    publicationNumber: varchar('publication_number', { length: 64 }).notNull(),
    applicationNumber: varchar('application_number', { length: 64 }),
    title: varchar('title', { length: 512 }).notNull(),
    patentType: patentTypeEnum('patent_type').notNull().default('invention'),
    legalStatus: patentLegalStatusEnum('legal_status').notNull().default('unknown'),

    filingDate: timestamp('filing_date', { withTimezone: true }),
    publicationDate: timestamp('publication_date', { withTimezone: true }),
    grantDate: timestamp('grant_date', { withTimezone: true }),
    expiryDate: timestamp('expiry_date', { withTimezone: true }),
    /** 法律状态最后更新日期，判断"过期"是否已生效依赖它。 */
    statusUpdatedAt: timestamp('status_updated_at', { withTimezone: true }),

    /** 申请人字段按原文保存，归一化后的企业名在 assigneeNormalized。 */
    applicantRaw: varchar('applicant_raw', { length: 512 }),
    applicantNormalized: varchar('applicant_normalized', { length: 256 }),
    isCurrentApplicant: boolean('is_current_applicant').notNull().default(true),
    /** 转让历史 jsonb 数组，权利归属冲突的判定材料。 */
    assigneeHistory: jsonb('assignee_history').notNull().$type<Record<string, unknown>[]>().default([]),
    inventorCount: integer('inventor_count').notNull().default(0),
    /** 发明人名原文，用于与 tvd_people 归并前的比对。 */
    inventorNamesRaw: jsonb('inventor_names_raw').notNull().$type<string[]>().default([]),
    agency: varchar('agency', { length: 256 }),
    ipcCodes: jsonb('ipc_codes').notNull().$type<string[]>().default([]),
    /** 归入的技术领域标签，TVD-04 分类统计用。 */
    techDomains: jsonb('tech_domains').notNull().$type<string[]>().default([]),
    abstractText: text('abstract_text'),
    claimCount: integer('claim_count').notNull().default(0),
    /** 同族专利数量，跨国布局信号。 */
    familySize: integer('family_size').notNull().default(1),
    citedByCount: integer('cited_by_count').notNull().default(0),
    sourceRecordId: uuid('source_record_id'),
    evidenceId: uuid('evidence_id').references(() => tvdEvidence.id, { onDelete: 'set null' }),
  },
  (t) => ({
    byPubNumber: uniqueIndex('tvd_patents_publication_uniq').on(t.publicationNumber),
    byEnterprise: index('tvd_patents_enterprise_idx').on(t.tvdEnterpriseId, t.status),
    byFilingDate: index('tvd_patents_filing_idx').on(t.filingDate),
    byTypeStatus: index('tvd_patents_type_idx').on(t.patentType, t.legalStatus),
    byTenant: index('tvd_patents_tenant_idx').on(t.tenantId, t.bankId, t.status),
  }),
);

/** 人物 ↔ 专利，带角色，支持"发明人集中度"与"核心发明人留存"分析。 */
export const tvdPatentInventors = pgTable(
  'tvd_patent_inventors',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    patentId: uuid('patent_id')
      .notNull()
      .references(() => tvdPatents.id, { onDelete: 'cascade' }),
    personId: uuid('person_id')
      .notNull()
      .references(() => tvdPeople.id, { onDelete: 'cascade' }),
    ...standardColumns(),
    role: varchar('role', { length: 16 }).notNull().default('inventor'),
    /** 名单中的次序，第一发明人在权属争议中有额外含义。 */
    position: integer('position').notNull().default(0),
    nameAsFiled: varchar('name_as_filed', { length: 128 }).notNull(),
  },
  (t) => ({
    byPair: uniqueIndex('tvd_patent_inventors_pair_uniq').on(t.patentId, t.personId, t.role),
    byPerson: index('tvd_patent_inventors_person_idx').on(t.personId),
  }),
);

/**
 * TVD-05 质量评估。规则版本号与结果一起落库 —— 没有 ruleVersion，
 * 就无法解释"同一件专利上周 78 分这周 61 分"，也无法做规则回归对比。
 */
export const tvdPatentQualityAssessments = pgTable(
  'tvd_patent_quality_assessments',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    patentId: uuid('patent_id')
      .notNull()
      .references(() => tvdPatents.id, { onDelete: 'cascade' }),
    ...standardColumns(),

    ruleVersion: varchar('rule_version', { length: 32 }).notNull(),
    totalScore: numeric('total_score', { precision: 6, scale: 2 }),
    /** 各维度分项，键与规则文件一致。 */
    dimensions: jsonb('dimensions').notNull().$type<Record<string, unknown>>().default({}),
    grade: varchar('grade', { length: 8 }),
    /** 权重来源：行业基准 / 专家规则 / 企业自身领域。 */
    weightProfile: varchar('weight_profile', { length: 64 }).notNull().default('default'),
    /** 证据不足的维度不得当作 0 分，整体置 null 并在此说明。 */
    insufficientDimensions: jsonb('insufficient_dimensions').notNull().$type<string[]>().default([]),
    reasons: jsonb('reasons').notNull().$type<string[]>().default([]),
    computedAt: timestamp('computed_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    byPatentVersion: uniqueIndex('tvd_patent_quality_patent_uniq').on(t.patentId, t.ruleVersion),
    byGrade: index('tvd_patent_quality_grade_idx').on(t.grade, t.totalScore),
  }),
);

/**
 * TVD-06 异常信号。
 * 硬约束：异常是"需要核实的问题"，不是"造假结论"。
 * 因此本表只有 detected/needs_review 之类的事实描述，判定权在人工复核队列。
 */
export const tvdPatentAnomalies = pgTable(
  'tvd_patent_anomalies',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tvdEnterpriseId: uuid('tvd_enterprise_id')
      .notNull()
      .references(() => tvdEnterprises.id, { onDelete: 'cascade' }),
    /** 单专利级异常才有；企业级异常（如突击申请）为空。 */
    patentId: uuid('patent_id').references(() => tvdPatents.id, { onDelete: 'cascade' }),
    ...standardColumns(),

    anomalyType: anomalyTypeEnum('anomaly_type').notNull(),
    ruleVersion: varchar('rule_version', { length: 32 }).notNull(),
    severity: varchar('severity', { length: 16 }).notNull().default('warning'),
    /** 命中阈值与观测值，异常必须自解释。 */
    observed: jsonb('observed').notNull().$type<Record<string, unknown>>().default({}),
    threshold: jsonb('threshold').notNull().$type<Record<string, unknown>>().default({}),
    detail: text('detail').notNull(),
    /** 涉及的专利公开号，点击可跳转。 */
    relatedPatentIds: jsonb('related_patent_ids').notNull().$type<string[]>().default([]),
    /** 是否已推送到人工复核队列，避免重跑规则时重复建任务。 */
    reviewTaskId: uuid('review_task_id'),
    detectedAt: timestamp('detected_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    byEnterpriseType: index('tvd_patent_anomalies_enterprise_idx').on(t.tvdEnterpriseId, t.anomalyType),
    byPatent: index('tvd_patent_anomalies_patent_idx').on(t.patentId),
    dedup: index('tvd_patent_anomalies_dedup_idx').on(t.tvdEnterpriseId, t.anomalyType, t.ruleVersion),
  }),
);

/** 企业级专利统计快照，由确定性代码聚合，供画像与看板直接读取。 */
export const tvdPatentStats = pgTable(
  'tvd_patent_stats',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tvdEnterpriseId: uuid('tvd_enterprise_id')
      .notNull()
      .references(() => tvdEnterprises.id, { onDelete: 'cascade' }),
    ...standardColumns(),
    status: recordStatusEnum('status').notNull().default('active'),

    total: integer('total').notNull().default(0),
    inventionCount: integer('invention_count').notNull().default(0),
    utilityModelCount: integer('utility_model_count').notNull().default(0),
    designCount: integer('design_count').notNull().default(0),
    grantedCount: integer('granted_count').notNull().default(0),
    pendingCount: integer('pending_count').notNull().default(0),
    invalidCount: integer('invalid_count').notNull().default(0),
    /** 有效发明占比，比总数更能反映技术含金量。 */
    validInventionRatio: numeric('valid_invention_ratio', { precision: 4, scale: 3 }),
    avgQualityScore: numeric('avg_quality_score', { precision: 6, scale: 2 }),
    /** 近 3 年申请数 / 全部申请数，衡量创新是否还在继续。 */
    recentFilingRatio: numeric('recent_filing_ratio', { precision: 4, scale: 3 }),
    originalRatio: numeric('original_ratio', { precision: 4, scale: 3 }),
    anomalyCount: integer('anomaly_count').notNull().default(0),
    /** 分领域 / 分年度分布，图表数据源。 */
    byTechDomain: jsonb('by_tech_domain').notNull().$type<Record<string, unknown>>().default({}),
    byYear: jsonb('by_year').notNull().$type<Record<string, unknown>>().default({}),
    ruleVersion: varchar('rule_version', { length: 32 }).notNull().default('v1'),
    computedAt: timestamp('computed_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    byEnterprise: uniqueIndex('tvd_patent_stats_enterprise_uniq').on(t.tvdEnterpriseId, t.ruleVersion),
  }),
);

export type TvdPatentRow = typeof tvdPatents.$inferSelect;
export type TvdPeopleRow = typeof tvdPeople.$inferSelect;
export type TvdPatentQualityAssessmentRow = typeof tvdPatentQualityAssessments.$inferSelect;
export type TvdPatentAnomalyRow = typeof tvdPatentAnomalies.$inferSelect;
export type TvdPatentStatsRow = typeof tvdPatentStats.$inferSelect;
