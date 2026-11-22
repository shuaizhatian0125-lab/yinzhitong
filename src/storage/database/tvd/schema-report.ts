import { boolean, index, integer, jsonb, pgTable, text, timestamp, uniqueIndex, uuid, varchar } from 'drizzle-orm/pg-core';
import { dataKindEnum, standardColumns, verificationStatusEnum } from './core';
import { tvdEnterprises } from './schema-enterprise';
import { tvdAssessmentRuns } from './schema-assessment';

/**
 * TVD-12 价值发现报告。
 *
 * 报告按章节拆分存储，而不是整篇塞进一个 text：
 * 每章需要独立的来源标注与"含 AI 生成内容"标识，
 * 整篇存储会让"哪句话有证据、哪句话没有"无法回答。
 */
export const tvdReports = pgTable(
  'tvd_reports',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tvdEnterpriseId: uuid('tvd_enterprise_id')
      .notNull()
      .references(() => tvdEnterprises.id, { onDelete: 'cascade' }),
    /** 报告必须绑定一次具体评估运行，否则分数变了报告还是旧的。 */
    assessmentRunId: uuid('assessment_run_id').notNull().references(() => tvdAssessmentRuns.id, { onDelete: 'restrict' }),
    ...standardColumns(),
    dataKind: dataKindEnum('data_kind').notNull().default('UNVERIFIED'),

    reportNo: varchar('report_no', { length: 64 }).notNull(),
    title: varchar('title', { length: 256 }).notNull(),
    templateKey: varchar('template_key', { length: 64 }).notNull().default('tvd_standard_v1'),
    /** 报告版本号来自 standardColumns().version，issued 后递增而非原地改。 */
    stage: varchar('stage', { length: 24 }).notNull().default('draft'),
    summary: text('summary'),
    /** 全篇统计：证据数、独立来源数、待核实项数，报告首页必须展示。 */
    stats: jsonb('stats').notNull().$type<Record<string, unknown>>().default({}),
    /** 只要含 AI 生成文本就必须为 true，UI 据此显示标识。 */
    containsAiContent: boolean('contains_ai_content').notNull().default(true),
    aiDisclaimer: text('ai_disclaimer'),
    verificationStatus: verificationStatusEnum('verification_status').notNull().default('unverified'),
    reviewedBy: uuid('reviewed_by'),
    reviewedAt: timestamp('reviewed_at', { withTimezone: true }),
    /** 渲染产物（HTML/PDF）的文件引用。 */
    attachments: jsonb('attachments').notNull().$type<Record<string, unknown>[]>().default([]),
    generatedAt: timestamp('generated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    byNo: uniqueIndex('tvd_reports_no_uniq').on(t.reportNo),
    byEnterprise: index('tvd_reports_enterprise_idx').on(t.tvdEnterpriseId, t.stage),
    byRun: index('tvd_reports_run_idx').on(t.assessmentRunId),
  }),
);

export const tvdReportSections = pgTable(
  'tvd_report_sections',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    reportId: uuid('report_id')
      .notNull()
      .references(() => tvdReports.id, { onDelete: 'cascade' }),
    ...standardColumns(),

    sectionKey: varchar('section_key', { length: 64 }).notNull(),
    title: varchar('title', { length: 256 }).notNull(),
    orderIndex: integer('order_index').notNull().default(0),
    level: integer('level').notNull().default(1),
    parentSectionId: uuid('parent_section_id'),
    body: text('body').notNull().default(''),
    /** 结构化载荷：表格、雷达图、时间线等渲染所需数据。 */
    blocks: jsonb('blocks').notNull().$type<Record<string, unknown>[]>().default([]),
    /** 本章引用的证据，逐章可回溯。 */
    evidenceIds: jsonb('evidence_ids').notNull().$type<string[]>().default([]),
    /** 本章是否含 AI 生成文本，及其推断部分。 */
    containsAiContent: boolean('contains_ai_content').notNull().default(false),
    /** 本章仍未取得证据的结论，报告里必须显式列出而不是隐去。 */
    unverifiedClaims: jsonb('unverified_claims').notNull().$type<string[]>().default([]),
  },
  (t) => ({
    byReportOrder: uniqueIndex('tvd_report_sections_order_uniq').on(t.reportId, t.sectionKey),
    byReport: index('tvd_report_sections_report_idx').on(t.reportId, t.orderIndex),
  }),
);

export type TvdReportRow = typeof tvdReports.$inferSelect;
export type TvdReportSectionRow = typeof tvdReportSections.$inferSelect;
