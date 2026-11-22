import {
  integer,
  pgEnum,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';

/**
 * TVD 领域共享基础。
 *
 * 现有 `enterprise` / `app_user` / `tenant` 表由 db/schema.sql 定义，本模块只新增
 * `tvd_*` 表并以外键引用它们，不重复建表（PRD 21.1 明确要求）。
 *
 * `bank_id` 在既有数据模型中不存在（schema.sql 与 src 中出现次数均为 0），但 PRD 21.3
 * 要求每张新表都带它、验收要求 Tenant 与 Bank 双层隔离，因此 TVD 表统一补齐该列。
 */

export const dataKindEnum = pgEnum('tvd_data_kind', [
  'REAL_DATA',
  'DEMO_DATA',
  'SYNTHETIC_DATA',
  'USER_UPLOADED',
  'AI_INFERENCE',
  'UNVERIFIED',
]);

export const recordStatusEnum = pgEnum('tvd_record_status', [
  'active',
  'superseded',
  'void',
]);

export const verificationStatusEnum = pgEnum('tvd_verification_status', [
  'unverified',
  'single_source',
  'multi_source',
  'verified',
  'disputed',
]);

export const confidenceLevelEnum = pgEnum('tvd_confidence_level', [
  'high',
  'medium',
  'low',
]);

/** TVD-02 统一信号类型。信号用一张表 + 类型判别，不按来源拆成多张窄表。 */
export const signalTypeEnum = pgEnum('tvd_signal_type', [
  'enterprise_identity',
  'patent',
  'rnd',
  'talent',
  'hiring',
  'research',
  'investment',
  'product',
  'customer',
  'order',
  'tender',
  'commercialization',
  'ecosystem',
  'industry_chain',
]);

/** PRD 13.1 四级来源体系。 */
export const sourceTierEnum = pgEnum('tvd_source_tier', [
  'tier1_official',
  'tier2_professional_db',
  'tier3_media_industry',
  'tier4_self_reported',
]);

export const sourceAccessMethodEnum = pgEnum('tvd_source_access_method', [
  'public_open_api',
  'licensed_api',
  'public_web_page',
  'user_upload',
  'demo_fixture',
]);

export const conflictTypeEnum = pgEnum('tvd_conflict_type', [
  'numeric',
  'temporal',
  'entity_identity',
  'patent_ownership',
  'order',
  'commercial_cooperation',
  'personnel',
  'source',
]);

export const conflictSeverityEnum = pgEnum('tvd_conflict_severity', [
  'info',
  'warning',
  'significant',
  'blocking',
]);

/** TVD-10 五维。 */
export const dimensionEnum = pgEnum('tvd_dimension', ['T', 'P', 'R', 'C', 'E']);

export const patentTypeEnum = pgEnum('tvd_patent_type', [
  'invention',
  'utility_model',
  'design',
]);

export const patentLegalStatusEnum = pgEnum('tvd_patent_legal_status', [
  'pending',
  'granted',
  'rejected',
  'expired',
  'abandoned',
  'lapsed',
  'unknown',
]);

export const anomalyTypeEnum = pgEnum('tvd_patent_anomaly_type', [
  'filing_surge',
  'near_duplicate',
  'repeated_topic',
  'assignee_irregularity',
  'legal_status_irregularity',
  'inventor_concentration',
  'agency_concentration',
  'tech_mismatch',
]);

export const reviewTaskStateEnum = pgEnum('tvd_review_task_state', [
  'open',
  'in_review',
  'resolved',
  'dismissed',
]);

/**
 * PRD 21.3 标准列。
 * 时间戳一律 timestamptz；version 用于乐观锁与数据版本追踪。
 *
 * tenant_id / bank_id / *_by 保持 uuid，与 legacy 表一致
 * （db/schema.sql:33 tenant.id、:67 app_user.id、:353 ai_run.id 均为 uuid）。
 * 注意 src/lib/demo-users.ts 里的 'demo-tenant-001' / 'demo-admin-001' 是 slug，
 * 直接塞进 uuid 列会被 Postgres 拒绝 —— 这个转换只允许发生在 tvd-identity.ts 一处。
 * 把 slug 泄漏进数据层正是 legacy enterprise 模块查不到演示数据的根因。
 *
 * created_by/updated_by 故意不加外键：演示数据集与未来真实用户可能混用，
 * 硬外键会让离线 seed 失败。
 */
export function standardColumns() {
  return {
    tenantId: uuid('tenant_id').notNull(),
    bankId: uuid('bank_id').notNull(),
    status: recordStatusEnum('status').notNull().default('active'),
    version: integer('version').notNull().default(1),
    createdBy: uuid('created_by'),
    updatedBy: uuid('updated_by'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  };
}

/** 可失效记录：原始证据不可覆盖，只能标记失效并指向替代记录。 */
export function supersessionColumns() {
  return {
    effectiveFrom: timestamp('effective_from', { withTimezone: true }).notNull().defaultNow(),
    effectiveTo: timestamp('effective_to', { withTimezone: true }),
    supersededBy: uuid('superseded_by'),
  };
}
