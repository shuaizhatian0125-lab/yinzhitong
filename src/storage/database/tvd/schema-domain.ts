import { index, integer, jsonb, numeric, pgTable, text, uniqueIndex, uuid, varchar } from 'drizzle-orm/pg-core';
import { confidenceLevelEnum, dataKindEnum, standardColumns, verificationStatusEnum } from './core';
import { tvdEnterprises } from './schema-enterprise';

/**
 * TVD-07 产业链与赛道图谱。
 *
 * 图谱用「节点 + 边 + 企业落位」三张表，而不是在企业表上加一个产业链字段：
 * 后者无法回答"这条链上还有哪些企业能承接它的上下游"，
 * 而那正是银行批量获客与供应链金融的出发点。
 */
export const tvdIndustryNodes = pgTable(
  'tvd_industry_nodes',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    ...standardColumns(),

    code: varchar('code', { length: 64 }).notNull(),
    name: varchar('name', { length: 128 }).notNull(),
    /** chain 整链 / segment 环节 / product 产品或技术节点。 */
    nodeType: varchar('node_type', { length: 24 }).notNull().default('segment'),
    industryCode: varchar('industry_code', { length: 32 }).notNull(),
    /** up / mid / down 产业链位置。 */
    chainPosition: varchar('chain_position', { length: 16 }),
    parentCode: varchar('parent_code', { length: 64 }),
    level: integer('level').notNull().default(1),
    description: text('description'),
    /** 该节点的技术/资金门槛，用于判断企业卡位价值。 */
    entryBarrier: varchar('entry_barrier', { length: 32 }),
    tags: jsonb('tags').notNull().$type<string[]>().default([]),
  },
  (t) => ({
    byCode: uniqueIndex('tvd_industry_nodes_code_uniq').on(t.code),
    byParent: index('tvd_industry_nodes_parent_idx').on(t.parentCode),
    byIndustry: index('tvd_industry_nodes_industry_idx').on(t.industryCode, t.nodeType),
  }),
);

/** 节点之间的供给/技术/协作关系。edge 必须有证据，不接受模型臆断。 */
export const tvdIndustryEdges = pgTable(
  'tvd_industry_edges',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    ...standardColumns(),
    fromNodeCode: varchar('from_node_code', { length: 64 }).notNull(),
    toNodeCode: varchar('to_node_code', { length: 64 }).notNull(),
    /** supply 供货 / demand 需求 / technology 技术依赖 / cooperate 协作。 */
    edgeType: varchar('edge_type', { length: 24 }).notNull().default('supply'),
    strength: numeric('strength', { precision: 4, scale: 3 }).notNull().default('0.500'),
    evidenceIds: jsonb('evidence_ids').notNull().$type<string[]>().default([]),
    verificationStatus: verificationStatusEnum('verification_status').notNull().default('unverified'),
    note: text('note'),
  },
  (t) => ({
    byPair: uniqueIndex('tvd_industry_edges_pair_uniq').on(t.fromNodeCode, t.toNodeCode, t.edgeType),
    byFrom: index('tvd_industry_edges_from_idx').on(t.fromNodeCode),
    byTo: index('tvd_industry_edges_to_idx').on(t.toNodeCode),
  }),
);

/** 企业落在哪个节点、扮演什么角色。同一企业可多节点卡位。 */
export const tvdEnterpriseChainPositions = pgTable(
  'tvd_enterprise_chain_positions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tvdEnterpriseId: uuid('tvd_enterprise_id')
      .notNull()
      .references(() => tvdEnterprises.id, { onDelete: 'cascade' }),
    nodeCode: varchar('node_code', { length: 64 }).notNull(),
    ...standardColumns(),
    dataKind: dataKindEnum('data_kind').notNull().default('UNVERIFIED'),
    /** primary 主营业环节 / secondary 兼营 / potential 可延伸。 */
    role: varchar('role', { length: 24 }).notNull().default('primary'),
    /** 在该环节的相对位置，如"国内前三"、"国产替代中"。 */
    positioning: varchar('positioning', { length: 64 }),
    shareEstimate: numeric('share_estimate', { precision: 5, scale: 2 }),
    confidence: confidenceLevelEnum('confidence').notNull().default('medium'),
    rationale: text('rationale'),
    evidenceIds: jsonb('evidence_ids').notNull().$type<string[]>().default([]),
  },
  (t) => ({
    byPair: uniqueIndex('tvd_chain_position_uniq').on(t.tvdEnterpriseId, t.nodeCode, t.role),
    byNode: index('tvd_chain_position_node_idx').on(t.nodeCode, t.role),
  }),
);

/** 赛道目录：把若干产业链节点聚合成可投资/可营销的主题。 */
export const tvdTracks = pgTable(
  'tvd_tracks',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    ...standardColumns(),
    code: varchar('code', { length: 64 }).notNull(),
    name: varchar('name', { length: 128 }).notNull(),
    description: text('description'),
    nodeCodes: jsonb('node_codes').notNull().$type<string[]>().default([]),
    industryCodes: jsonb('industry_codes').notNull().$type<string[]>().default([]),
    /** 政策热度与银行内部战略优先级，分开存：前者是外部事实，后者是主观判断。 */
    policyHeat: varchar('policy_heat', { length: 16 }),
    bankPriority: varchar('bank_priority', { length: 16 }),
    enterpriseCount: integer('enterprise_count').notNull().default(0),
  },
  (t) => ({
    byCode: uniqueIndex('tvd_tracks_code_uniq').on(t.code),
  }),
);

export type TvdIndustryNodeRow = typeof tvdIndustryNodes.$inferSelect;
export type TvdEnterpriseChainPositionRow = typeof tvdEnterpriseChainPositions.$inferSelect;
export type TvdTrackRow = typeof tvdTracks.$inferSelect;
