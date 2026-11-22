-- ============================================================
-- 银智通 Bank AI OS · 企业洞察增强迁移脚本
-- 迁移编号：001_enterprise_insight_enhancement
-- 说明：新增6个表 + 修改3个表字段 + 新增5个索引
-- ============================================================

-- ============================================================
-- 1. 修改现有表：新增字段
-- ============================================================

-- enterprise 表新增 is_tech 字段
ALTER TABLE enterprise ADD COLUMN IF NOT EXISTS is_tech boolean NOT NULL DEFAULT false;

-- enterprise_analysis 表新增 demands 和 report_content 字段
ALTER TABLE enterprise_analysis ADD COLUMN IF NOT EXISTS demands jsonb NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE enterprise_analysis ADD COLUMN IF NOT EXISTS report_content jsonb NOT NULL DEFAULT '{}'::jsonb;

-- customer_contact 表新增 decision_role 字段
ALTER TABLE customer_contact ADD COLUMN IF NOT EXISTS decision_role varchar(16)
  CHECK (decision_role IN ('决策人', '影响人', '使用者', '信息人') OR decision_role IS NULL);

-- ============================================================
-- 2. 新增表
-- ============================================================

-- bank_product：银行金融产品表
CREATE TABLE IF NOT EXISTS bank_product (
  id varchar(36) PRIMARY KEY NOT NULL,
  tenant_id varchar(36) NOT NULL,
  name varchar(128) NOT NULL,
  category varchar(32) NOT NULL,
  description text,
  target_industry jsonb NOT NULL DEFAULT '[]'::jsonb,
  min_amount integer,
  max_amount integer,
  rate_range varchar(64),
  term_range varchar(64),
  status varchar(16) NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now()
);

-- service_match_result：服务匹配结果表
CREATE TABLE IF NOT EXISTS service_match_result (
  id varchar(36) PRIMARY KEY NOT NULL,
  tenant_id varchar(36) NOT NULL,
  enterprise_id varchar(36) NOT NULL,
  analysis_id varchar(36),
  product_id varchar(36) NOT NULL,
  match_reason text NOT NULL,
  match_score integer NOT NULL,
  priority varchar(16) NOT NULL DEFAULT 'medium',
  created_at timestamptz NOT NULL DEFAULT now()
);

-- research_project：研究项目表
CREATE TABLE IF NOT EXISTS research_project (
  id varchar(36) PRIMARY KEY NOT NULL,
  tenant_id varchar(36) NOT NULL,
  name varchar(255) NOT NULL,
  type varchar(24) NOT NULL DEFAULT 'industry',
  objective text,
  status varchar(16) NOT NULL DEFAULT 'draft',
  planned_completion_at timestamptz,
  industry_id varchar(36),
  created_by varchar(36),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);

-- opportunity_stage_history：商机阶段流转历史表
CREATE TABLE IF NOT EXISTS opportunity_stage_history (
  id varchar(36) PRIMARY KEY NOT NULL,
  tenant_id varchar(36) NOT NULL,
  opportunity_id varchar(36) NOT NULL,
  from_stage varchar(24) NOT NULL,
  to_stage varchar(24) NOT NULL,
  transition_reason text,
  lost_reason text,
  transitioned_by varchar(36) NOT NULL,
  transitioned_at timestamptz NOT NULL DEFAULT now()
);

-- collaboration_coordinator_log：Coordinator运行日志表
CREATE TABLE IF NOT EXISTS collaboration_coordinator_log (
  id varchar(36) PRIMARY KEY NOT NULL,
  tenant_id varchar(36) NOT NULL,
  collaboration_id varchar(36) NOT NULL,
  status varchar(16) NOT NULL DEFAULT 'running',
  log_summary text,
  ai_suggestions jsonb NOT NULL DEFAULT '[]'::jsonb,
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz
);

-- kill_switch_record：Kill Switch记录表
CREATE TABLE IF NOT EXISTS kill_switch_record (
  id varchar(36) PRIMARY KEY NOT NULL,
  tenant_id varchar(36) NOT NULL,
  collaboration_id varchar(36) NOT NULL,
  action varchar(48) NOT NULL,
  reason text,
  scope varchar(32) NOT NULL DEFAULT 'collaboration',
  executed_by varchar(36) NOT NULL,
  executed_at timestamptz NOT NULL DEFAULT now(),
  recoverable boolean NOT NULL DEFAULT true,
  recovered boolean NOT NULL DEFAULT false,
  recovered_at timestamptz
);

-- ============================================================
-- 3. 新增索引
-- ============================================================

-- 企业发现引擎复合筛选索引
CREATE INDEX IF NOT EXISTS idx_enterprise_discovery
  ON enterprise (tenant_id, industry, region, scale)
  WHERE deleted_at IS NULL;

-- 服务匹配结果索引
CREATE INDEX IF NOT EXISTS idx_service_match_ent
  ON service_match_result (tenant_id, enterprise_id, created_at);

-- 研究项目状态筛选索引
CREATE INDEX IF NOT EXISTS idx_research_project_status
  ON research_project (tenant_id, status, type)
  WHERE deleted_at IS NULL;

-- 商机阶段流转历史索引
CREATE INDEX IF NOT EXISTS idx_opp_stage_history
  ON opportunity_stage_history (tenant_id, opportunity_id, transitioned_at);

-- 银行金融产品索引
CREATE INDEX IF NOT EXISTS idx_bank_product_tenant
  ON bank_product (tenant_id, category);

-- ============================================================
-- 4. 外键约束（可选，根据RLS策略决定是否添加）
-- ============================================================

-- ALTER TABLE service_match_result
--   ADD CONSTRAINT fk_smr_enterprise FOREIGN KEY (enterprise_id)
--   REFERENCES enterprise(id) ON DELETE CASCADE;
-- ALTER TABLE service_match_result
--   ADD CONSTRAINT fk_smr_product FOREIGN KEY (product_id)
--   REFERENCES bank_product(id) ON DELETE CASCADE;
-- ALTER TABLE research_project
--   ADD CONSTRAINT fk_rp_industry FOREIGN KEY (industry_id)
--   REFERENCES industry(id) ON DELETE SET NULL;
-- ALTER TABLE opportunity_stage_history
--   ADD CONSTRAINT fk_osh_opportunity FOREIGN KEY (opportunity_id)
--   REFERENCES opportunity(id) ON DELETE CASCADE;