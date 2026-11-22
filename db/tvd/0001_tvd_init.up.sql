-- TVD 迁移 0001_tvd_init —— 由 scripts/tvd-gen-migration.mjs 生成，请勿手改。
-- 改表请编辑 src/storage/database/tvd/*.ts 后重新生成。
-- 对象统计：38 张表 / 14 个枚举 / 43 个外键 / 94 个索引。

-- ===== 枚举类型 =====
CREATE TYPE "public"."tvd_patent_anomaly_type" AS ENUM('filing_surge', 'near_duplicate', 'repeated_topic', 'assignee_irregularity', 'legal_status_irregularity', 'inventor_concentration', 'agency_concentration', 'tech_mismatch');
CREATE TYPE "public"."tvd_confidence_level" AS ENUM('high', 'medium', 'low');
CREATE TYPE "public"."tvd_conflict_severity" AS ENUM('info', 'warning', 'significant', 'blocking');
CREATE TYPE "public"."tvd_conflict_type" AS ENUM('numeric', 'temporal', 'entity_identity', 'patent_ownership', 'order', 'commercial_cooperation', 'personnel', 'source');
CREATE TYPE "public"."tvd_data_kind" AS ENUM('REAL_DATA', 'DEMO_DATA', 'SYNTHETIC_DATA', 'USER_UPLOADED', 'AI_INFERENCE', 'UNVERIFIED');
CREATE TYPE "public"."tvd_dimension" AS ENUM('T', 'P', 'R', 'C', 'E');
CREATE TYPE "public"."tvd_patent_legal_status" AS ENUM('pending', 'granted', 'rejected', 'expired', 'abandoned', 'lapsed', 'unknown');
CREATE TYPE "public"."tvd_patent_type" AS ENUM('invention', 'utility_model', 'design');
CREATE TYPE "public"."tvd_record_status" AS ENUM('active', 'superseded', 'void');
CREATE TYPE "public"."tvd_review_task_state" AS ENUM('open', 'in_review', 'resolved', 'dismissed');
CREATE TYPE "public"."tvd_signal_type" AS ENUM('enterprise_identity', 'patent', 'rnd', 'talent', 'hiring', 'research', 'investment', 'product', 'customer', 'order', 'tender', 'commercialization', 'ecosystem', 'industry_chain');
CREATE TYPE "public"."tvd_source_access_method" AS ENUM('public_open_api', 'licensed_api', 'public_web_page', 'user_upload', 'demo_fixture');
CREATE TYPE "public"."tvd_source_tier" AS ENUM('tier1_official', 'tier2_professional_db', 'tier3_media_industry', 'tier4_self_reported');
CREATE TYPE "public"."tvd_verification_status" AS ENUM('unverified', 'single_source', 'multi_source', 'verified', 'disputed');

-- ===== 表 =====
CREATE TABLE "tvd_enterprise_aliases" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tvd_enterprise_id" uuid NOT NULL,
	"tenant_id" uuid NOT NULL,
	"bank_id" uuid NOT NULL,
	"status" "tvd_record_status" DEFAULT 'active' NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"alias" varchar(255) NOT NULL,
	"alias_kind" varchar(32) DEFAULT 'legal_name' NOT NULL,
	"normalized_alias" varchar(255) NOT NULL,
	"source_record_id" uuid,
	"data_kind" "tvd_data_kind" DEFAULT 'UNVERIFIED' NOT NULL
);

CREATE TABLE "tvd_enterprise_profiles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tvd_enterprise_id" uuid NOT NULL,
	"tenant_id" uuid NOT NULL,
	"bank_id" uuid NOT NULL,
	"status" "tvd_record_status" DEFAULT 'active' NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"assessment_run_id" uuid,
	"model_version_id" uuid,
	"profile_version" varchar(32) NOT NULL,
	"overall_score" numeric(5, 2),
	"score_confidence" "tvd_confidence_level",
	"data_coverage" numeric(4, 3),
	"evidence_confidence" "tvd_confidence_level",
	"identity_layer" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"tech_identity_layer" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"value_layer" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"evidence_layer" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"growth_layer" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"risk_layer" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"strengths" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"weaknesses" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"risk_notes" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"open_questions" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"conflict_count" integer DEFAULT 0 NOT NULL,
	"pending_verification_count" integer DEFAULT 0 NOT NULL,
	"data_kind" "tvd_data_kind" DEFAULT 'AI_INFERENCE' NOT NULL,
	"effective_from" timestamp with time zone DEFAULT now() NOT NULL,
	"effective_to" timestamp with time zone,
	"superseded_by" uuid
);

CREATE TABLE "tvd_enterprises" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"enterprise_id" uuid NOT NULL,
	"tenant_id" uuid NOT NULL,
	"bank_id" uuid NOT NULL,
	"status" "tvd_record_status" DEFAULT 'active' NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"data_kind" "tvd_data_kind" DEFAULT 'UNVERIFIED' NOT NULL,
	"display_name" varchar(255) NOT NULL,
	"unified_code" varchar(32),
	"registration_code" varchar(32),
	"industry_code" varchar(32),
	"industry_name" varchar(128),
	"track_code" varchar(64),
	"track_name" varchar(128),
	"region_code" varchar(32),
	"region_name" varchar(64),
	"park_name" varchar(128),
	"stage" varchar(32),
	"founded_on" varchar(16),
	"employee_band" varchar(32),
	"listed_flag" boolean DEFAULT false NOT NULL,
	"qualifications" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"qualification_evidence" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"core_tech_summary" text,
	"tech_keywords" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"identity_confidence" "tvd_confidence_level" DEFAULT 'low' NOT NULL,
	"verification_status" "tvd_verification_status" DEFAULT 'unverified' NOT NULL,
	"canonical_id" uuid,
	"effective_from" timestamp with time zone DEFAULT now() NOT NULL,
	"effective_to" timestamp with time zone,
	"superseded_by" uuid
);

CREATE TABLE "tvd_data_sources" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"bank_id" uuid NOT NULL,
	"status" "tvd_record_status" DEFAULT 'active' NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"code" varchar(64) NOT NULL,
	"name" varchar(128) NOT NULL,
	"tier" "tvd_source_tier" NOT NULL,
	"covers_signal_types" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"base_url" varchar(512),
	"access_method" "tvd_source_access_method" DEFAULT 'demo_fixture' NOT NULL,
	"requires_auth" boolean DEFAULT false NOT NULL,
	"requires_paid_license" boolean DEFAULT false NOT NULL,
	"usage_constraint" text,
	"rate_limit_per_minute" integer DEFAULT 0 NOT NULL,
	"crawl_allowed" boolean DEFAULT false NOT NULL,
	"credibility" numeric(4, 3) DEFAULT '0.500' NOT NULL,
	"connector_key" varchar(64),
	"connected" boolean DEFAULT false NOT NULL,
	"last_sync_at" timestamp with time zone
);

CREATE TABLE "tvd_signal_sources" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"signal_id" uuid NOT NULL,
	"source_record_id" uuid NOT NULL,
	"tenant_id" uuid NOT NULL,
	"bank_id" uuid NOT NULL,
	"status" "tvd_record_status" DEFAULT 'active' NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"role" varchar(16) DEFAULT 'supporting' NOT NULL,
	"excerpt" text
);

CREATE TABLE "tvd_signals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tvd_enterprise_id" uuid NOT NULL,
	"tenant_id" uuid NOT NULL,
	"bank_id" uuid NOT NULL,
	"status" "tvd_record_status" DEFAULT 'active' NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"data_kind" "tvd_data_kind" DEFAULT 'UNVERIFIED' NOT NULL,
	"signal_type" "tvd_signal_type" NOT NULL,
	"subject" varchar(256) NOT NULL,
	"observed_value" numeric(18, 4),
	"value_unit" varchar(32),
	"text_value" text,
	"occurred_at" timestamp with time zone,
	"observed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"period_start" timestamp with time zone,
	"period_end" timestamp with time zone,
	"attributes" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"normalized_key" varchar(256),
	"dedup_key" varchar(128),
	"merge_count" integer DEFAULT 1 NOT NULL,
	"confidence" numeric(4, 3) DEFAULT '0.500' NOT NULL,
	"verification_status" "tvd_verification_status" DEFAULT 'unverified' NOT NULL,
	"source_count" integer DEFAULT 0 NOT NULL,
	"independent_source_count" integer DEFAULT 0 NOT NULL
);

CREATE TABLE "tvd_source_lineage" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"derived_record_id" uuid NOT NULL,
	"original_record_id" uuid NOT NULL,
	"tenant_id" uuid NOT NULL,
	"bank_id" uuid NOT NULL,
	"status" "tvd_record_status" DEFAULT 'active' NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"relation" varchar(32) DEFAULT 'repost' NOT NULL,
	"confidence" numeric(4, 3) DEFAULT '1.000' NOT NULL,
	"note" text
);

CREATE TABLE "tvd_source_records" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"data_source_id" uuid NOT NULL,
	"tenant_id" uuid NOT NULL,
	"bank_id" uuid NOT NULL,
	"status" "tvd_record_status" DEFAULT 'active' NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"data_kind" "tvd_data_kind" DEFAULT 'UNVERIFIED' NOT NULL,
	"url" varchar(1024),
	"document_number" varchar(128),
	"title" varchar(512),
	"publisher" varchar(256),
	"author" varchar(128),
	"retrieved_at" timestamp with time zone DEFAULT now() NOT NULL,
	"published_at" timestamp with time zone,
	"raw_content" text,
	"extracted" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"content_hash" varchar(64),
	"access_method" "tvd_source_access_method" DEFAULT 'demo_fixture' NOT NULL,
	"permission_note" text,
	"verification_status" "tvd_verification_status" DEFAULT 'unverified' NOT NULL,
	"origin_record_id" uuid,
	"depth" integer DEFAULT 0 NOT NULL
);

CREATE TABLE "tvd_conflict_resolutions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"conflict_id" uuid NOT NULL,
	"tenant_id" uuid NOT NULL,
	"bank_id" uuid NOT NULL,
	"status" "tvd_record_status" DEFAULT 'active' NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"decided_by" uuid,
	"decision" varchar(32) NOT NULL,
	"accepted_claim_id" uuid,
	"rationale" text NOT NULL,
	"supporting_evidence_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"decided_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "tvd_evidence" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tvd_enterprise_id" uuid NOT NULL,
	"source_record_id" uuid NOT NULL,
	"tenant_id" uuid NOT NULL,
	"bank_id" uuid NOT NULL,
	"status" "tvd_record_status" DEFAULT 'active' NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"data_kind" "tvd_data_kind" DEFAULT 'UNVERIFIED' NOT NULL,
	"claim_text" text NOT NULL,
	"excerpt" text,
	"locator" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"metric_key" varchar(64),
	"metric_value" numeric(18, 4),
	"metric_unit" varchar(32),
	"metric_period" varchar(32),
	"credibility" numeric(4, 3) DEFAULT '0.500' NOT NULL,
	"verification_status" "tvd_verification_status" DEFAULT 'unverified' NOT NULL,
	"origin_record_id" uuid,
	"observed_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "tvd_evidence_independence" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"conclusion_kind" varchar(32) NOT NULL,
	"conclusion_id" uuid NOT NULL,
	"tenant_id" uuid NOT NULL,
	"bank_id" uuid NOT NULL,
	"status" "tvd_record_status" DEFAULT 'active' NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"evidence_count" integer DEFAULT 0 NOT NULL,
	"origin_count" integer DEFAULT 0 NOT NULL,
	"tier_spread" integer DEFAULT 0 NOT NULL,
	"independent_source_count" integer DEFAULT 0 NOT NULL,
	"independence_score" numeric(4, 3) DEFAULT '0.000' NOT NULL,
	"meets_two_source_gate" boolean DEFAULT false NOT NULL,
	"origins" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"reason" text,
	"evaluated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "tvd_evidence_links" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"evidence_id" uuid NOT NULL,
	"tenant_id" uuid NOT NULL,
	"bank_id" uuid NOT NULL,
	"status" "tvd_record_status" DEFAULT 'active' NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"conclusion_kind" varchar(32) NOT NULL,
	"conclusion_id" uuid NOT NULL,
	"role" varchar(16) DEFAULT 'primary' NOT NULL,
	"weight" numeric(4, 3) DEFAULT '1.000' NOT NULL
);

CREATE TABLE "tvd_fact_claims" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tvd_enterprise_id" uuid NOT NULL,
	"evidence_id" uuid NOT NULL,
	"tenant_id" uuid NOT NULL,
	"bank_id" uuid NOT NULL,
	"status" "tvd_record_status" DEFAULT 'active' NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"fact_key" varchar(192) NOT NULL,
	"subject" varchar(256) NOT NULL,
	"metric_key" varchar(64) NOT NULL,
	"period" varchar(32) NOT NULL,
	"numeric_value" numeric(18, 4),
	"normalized_value" varchar(256),
	"unit" varchar(32),
	"raw_expression" text,
	"as_of_date" timestamp with time zone
);

CREATE TABLE "tvd_fact_conflicts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tvd_enterprise_id" uuid NOT NULL,
	"tenant_id" uuid NOT NULL,
	"bank_id" uuid NOT NULL,
	"status" "tvd_record_status" DEFAULT 'active' NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"fact_key" varchar(192) NOT NULL,
	"conflict_type" "tvd_conflict_type" NOT NULL,
	"severity" "tvd_conflict_severity" DEFAULT 'warning' NOT NULL,
	"claim_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"comparison" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"delta_ratio" numeric(8, 5),
	"ai_explanation" text,
	"resolved" boolean DEFAULT false NOT NULL,
	"detected_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "tvd_review_tasks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tvd_enterprise_id" uuid NOT NULL,
	"tenant_id" uuid NOT NULL,
	"bank_id" uuid NOT NULL,
	"status" "tvd_record_status" DEFAULT 'active' NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"origin_kind" varchar(32) NOT NULL,
	"origin_id" uuid,
	"title" varchar(256) NOT NULL,
	"detail" text NOT NULL,
	"required_action" text,
	"blocking_dimension" "tvd_dimension",
	"severity" "tvd_conflict_severity" DEFAULT 'warning' NOT NULL,
	"state" "tvd_review_task_state" DEFAULT 'open' NOT NULL,
	"assigned_to" uuid,
	"resolved_at" timestamp with time zone,
	"resolution_note" text,
	"confidence" "tvd_confidence_level" DEFAULT 'medium' NOT NULL
);

CREATE TABLE "tvd_patent_anomalies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tvd_enterprise_id" uuid NOT NULL,
	"patent_id" uuid,
	"tenant_id" uuid NOT NULL,
	"bank_id" uuid NOT NULL,
	"status" "tvd_record_status" DEFAULT 'active' NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"anomaly_type" "tvd_patent_anomaly_type" NOT NULL,
	"rule_version" varchar(32) NOT NULL,
	"severity" varchar(16) DEFAULT 'warning' NOT NULL,
	"observed" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"threshold" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"detail" text NOT NULL,
	"related_patent_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"review_task_id" uuid,
	"detected_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "tvd_patent_inventors" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"patent_id" uuid NOT NULL,
	"person_id" uuid NOT NULL,
	"tenant_id" uuid NOT NULL,
	"bank_id" uuid NOT NULL,
	"status" "tvd_record_status" DEFAULT 'active' NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"role" varchar(16) DEFAULT 'inventor' NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"name_as_filed" varchar(128) NOT NULL
);

CREATE TABLE "tvd_patent_quality_assessments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"patent_id" uuid NOT NULL,
	"tenant_id" uuid NOT NULL,
	"bank_id" uuid NOT NULL,
	"status" "tvd_record_status" DEFAULT 'active' NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"rule_version" varchar(32) NOT NULL,
	"total_score" numeric(6, 2),
	"dimensions" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"grade" varchar(8),
	"weight_profile" varchar(64) DEFAULT 'default' NOT NULL,
	"insufficient_dimensions" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"reasons" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"computed_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "tvd_patent_stats" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tvd_enterprise_id" uuid NOT NULL,
	"tenant_id" uuid NOT NULL,
	"bank_id" uuid NOT NULL,
	"status" "tvd_record_status" DEFAULT 'active' NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"total" integer DEFAULT 0 NOT NULL,
	"invention_count" integer DEFAULT 0 NOT NULL,
	"utility_model_count" integer DEFAULT 0 NOT NULL,
	"design_count" integer DEFAULT 0 NOT NULL,
	"granted_count" integer DEFAULT 0 NOT NULL,
	"pending_count" integer DEFAULT 0 NOT NULL,
	"invalid_count" integer DEFAULT 0 NOT NULL,
	"valid_invention_ratio" numeric(4, 3),
	"avg_quality_score" numeric(6, 2),
	"recent_filing_ratio" numeric(4, 3),
	"original_ratio" numeric(4, 3),
	"anomaly_count" integer DEFAULT 0 NOT NULL,
	"by_tech_domain" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"by_year" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"rule_version" varchar(32) DEFAULT 'v1' NOT NULL,
	"computed_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "tvd_patents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tvd_enterprise_id" uuid NOT NULL,
	"tenant_id" uuid NOT NULL,
	"bank_id" uuid NOT NULL,
	"status" "tvd_record_status" DEFAULT 'active' NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"data_kind" "tvd_data_kind" DEFAULT 'UNVERIFIED' NOT NULL,
	"verification_status" "tvd_verification_status" DEFAULT 'unverified' NOT NULL,
	"publication_number" varchar(64) NOT NULL,
	"application_number" varchar(64),
	"title" varchar(512) NOT NULL,
	"patent_type" "tvd_patent_type" DEFAULT 'invention' NOT NULL,
	"legal_status" "tvd_patent_legal_status" DEFAULT 'unknown' NOT NULL,
	"filing_date" timestamp with time zone,
	"publication_date" timestamp with time zone,
	"grant_date" timestamp with time zone,
	"expiry_date" timestamp with time zone,
	"status_updated_at" timestamp with time zone,
	"applicant_raw" varchar(512),
	"applicant_normalized" varchar(256),
	"is_current_applicant" boolean DEFAULT true NOT NULL,
	"assignee_history" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"inventor_count" integer DEFAULT 0 NOT NULL,
	"inventor_names_raw" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"agency" varchar(256),
	"ipc_codes" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"tech_domains" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"abstract_text" text,
	"claim_count" integer DEFAULT 0 NOT NULL,
	"family_size" integer DEFAULT 1 NOT NULL,
	"cited_by_count" integer DEFAULT 0 NOT NULL,
	"source_record_id" uuid,
	"evidence_id" uuid
);

CREATE TABLE "tvd_people" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"bank_id" uuid NOT NULL,
	"status" "tvd_record_status" DEFAULT 'active' NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"name" varchar(128) NOT NULL,
	"name_normalized" varchar(128) NOT NULL,
	"merged_into" uuid,
	"identity_confidence" "tvd_confidence_level" DEFAULT 'low' NOT NULL,
	"alias_count" integer DEFAULT 1 NOT NULL,
	"note" text
);

CREATE TABLE "tvd_enterprise_chain_positions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tvd_enterprise_id" uuid NOT NULL,
	"node_code" varchar(64) NOT NULL,
	"tenant_id" uuid NOT NULL,
	"bank_id" uuid NOT NULL,
	"status" "tvd_record_status" DEFAULT 'active' NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"data_kind" "tvd_data_kind" DEFAULT 'UNVERIFIED' NOT NULL,
	"role" varchar(24) DEFAULT 'primary' NOT NULL,
	"positioning" varchar(64),
	"share_estimate" numeric(5, 2),
	"confidence" "tvd_confidence_level" DEFAULT 'medium' NOT NULL,
	"rationale" text,
	"evidence_ids" jsonb DEFAULT '[]'::jsonb NOT NULL
);

CREATE TABLE "tvd_industry_edges" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"bank_id" uuid NOT NULL,
	"status" "tvd_record_status" DEFAULT 'active' NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"from_node_code" varchar(64) NOT NULL,
	"to_node_code" varchar(64) NOT NULL,
	"edge_type" varchar(24) DEFAULT 'supply' NOT NULL,
	"strength" numeric(4, 3) DEFAULT '0.500' NOT NULL,
	"evidence_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"verification_status" "tvd_verification_status" DEFAULT 'unverified' NOT NULL,
	"note" text
);

CREATE TABLE "tvd_industry_nodes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"bank_id" uuid NOT NULL,
	"status" "tvd_record_status" DEFAULT 'active' NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"code" varchar(64) NOT NULL,
	"name" varchar(128) NOT NULL,
	"node_type" varchar(24) DEFAULT 'segment' NOT NULL,
	"industry_code" varchar(32) NOT NULL,
	"chain_position" varchar(16),
	"parent_code" varchar(64),
	"level" integer DEFAULT 1 NOT NULL,
	"description" text,
	"entry_barrier" varchar(32),
	"tags" jsonb DEFAULT '[]'::jsonb NOT NULL
);

CREATE TABLE "tvd_tracks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"bank_id" uuid NOT NULL,
	"status" "tvd_record_status" DEFAULT 'active' NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"code" varchar(64) NOT NULL,
	"name" varchar(128) NOT NULL,
	"description" text,
	"node_codes" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"industry_codes" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"policy_heat" varchar(16),
	"bank_priority" varchar(16),
	"enterprise_count" integer DEFAULT 0 NOT NULL
);

CREATE TABLE "tvd_assessment_indicators" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"model_version_id" uuid NOT NULL,
	"tenant_id" uuid NOT NULL,
	"bank_id" uuid NOT NULL,
	"status" "tvd_record_status" DEFAULT 'active' NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"code" varchar(64) NOT NULL,
	"name" varchar(128) NOT NULL,
	"dimension" "tvd_dimension" NOT NULL,
	"sub_dimension" varchar(64),
	"weight" numeric(6, 4) DEFAULT '0.0000' NOT NULL,
	"calculator_key" varchar(64) NOT NULL,
	"params" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"required_metric_keys" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"normalize_method" varchar(32) DEFAULT 'band' NOT NULL,
	"bands" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"unit" varchar(32),
	"description" text
);

CREATE TABLE "tvd_assessment_model_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"model_id" uuid NOT NULL,
	"tenant_id" uuid NOT NULL,
	"bank_id" uuid NOT NULL,
	"status" "tvd_record_status" DEFAULT 'active' NOT NULL,
	"version" varchar(32) NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"dimension_weights" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"scoring_config" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"grade_thresholds" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"min_data_coverage" numeric(4, 3) DEFAULT '0.600' NOT NULL,
	"min_independent_sources" integer DEFAULT 2 NOT NULL,
	"notes" text,
	"published_at" timestamp with time zone,
	"published_by" uuid
);

CREATE TABLE "tvd_assessment_models" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"bank_id" uuid NOT NULL,
	"status" "tvd_record_status" DEFAULT 'active' NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"code" varchar(64) NOT NULL,
	"name" varchar(128) NOT NULL,
	"description" text,
	"industry_codes" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"track_codes" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"active_version_id" uuid,
	"owner" varchar(64)
);

CREATE TABLE "tvd_assessment_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tvd_enterprise_id" uuid NOT NULL,
	"model_version_id" uuid NOT NULL,
	"tenant_id" uuid NOT NULL,
	"bank_id" uuid NOT NULL,
	"status" varchar(24) DEFAULT 'completed' NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"data_kind" "tvd_data_kind" DEFAULT 'UNVERIFIED' NOT NULL,
	"run_no" varchar(64) NOT NULL,
	"trigger" varchar(24) DEFAULT 'manual' NOT NULL,
	"tvd_profile_id" uuid,
	"data_cutoff_at" timestamp with time zone,
	"total_score" numeric(6, 2),
	"grade" varchar(8),
	"score_withheld_reason" text,
	"data_coverage" numeric(4, 3),
	"conflict_count" integer DEFAULT 0 NOT NULL,
	"pending_review_count" integer DEFAULT 0 NOT NULL,
	"independent_evidence_count" integer DEFAULT 0 NOT NULL,
	"feature_snapshot" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"derivation" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"ai_interpretation" text,
	"ai_run_id" uuid,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone,
	"duration_ms" integer
);

CREATE TABLE "tvd_assessment_scores" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"run_id" uuid NOT NULL,
	"indicator_id" uuid NOT NULL,
	"tenant_id" uuid NOT NULL,
	"bank_id" uuid NOT NULL,
	"status" "tvd_record_status" DEFAULT 'active' NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"dimension" "tvd_dimension" NOT NULL,
	"indicator_code" varchar(64) NOT NULL,
	"raw_value" numeric(18, 4),
	"normalized_score" numeric(6, 2),
	"weight" numeric(6, 4) DEFAULT '0.0000' NOT NULL,
	"weighted_score" numeric(8, 4),
	"insufficient_evidence" boolean DEFAULT false NOT NULL,
	"confidence" "tvd_confidence_level" DEFAULT 'medium' NOT NULL,
	"verification_status" "tvd_verification_status" DEFAULT 'unverified' NOT NULL,
	"independent_source_count" integer DEFAULT 0 NOT NULL,
	"explanation" text
);

CREATE TABLE "tvd_score_evidence_links" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"score_id" uuid NOT NULL,
	"evidence_id" uuid NOT NULL,
	"tenant_id" uuid NOT NULL,
	"bank_id" uuid NOT NULL,
	"status" "tvd_record_status" DEFAULT 'active' NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"contribution" numeric(4, 3) DEFAULT '1.000' NOT NULL,
	"role" varchar(16) DEFAULT 'primary' NOT NULL
);

CREATE TABLE "tvd_benchmark_members" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"set_id" uuid NOT NULL,
	"tvd_enterprise_id" uuid NOT NULL,
	"tenant_id" uuid NOT NULL,
	"bank_id" uuid NOT NULL,
	"status" "tvd_record_status" DEFAULT 'active' NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"is_subject" boolean DEFAULT false NOT NULL,
	"metrics" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"missing_metrics" jsonb DEFAULT '[]'::jsonb NOT NULL
);

CREATE TABLE "tvd_benchmark_results" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"set_id" uuid NOT NULL,
	"subject_enterprise_id" uuid NOT NULL,
	"assessment_run_id" uuid NOT NULL,
	"tenant_id" uuid NOT NULL,
	"bank_id" uuid NOT NULL,
	"status" "tvd_record_status" DEFAULT 'active' NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"metric_key" varchar(64) NOT NULL,
	"dimension" "tvd_dimension",
	"subject_value" numeric(18, 4),
	"sample_mean" numeric(18, 4),
	"sample_median" numeric(18, 4),
	"sample_p90" numeric(18, 4),
	"sample_min" numeric(18, 4),
	"sample_max" numeric(18, 4),
	"percentile" numeric(5, 2),
	"rank" integer,
	"sample_size" integer DEFAULT 0 NOT NULL,
	"usable" boolean DEFAULT true NOT NULL,
	"caveat" text,
	"computed_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "tvd_benchmark_sets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"bank_id" uuid NOT NULL,
	"status" "tvd_record_status" DEFAULT 'active' NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"code" varchar(64) NOT NULL,
	"name" varchar(128) NOT NULL,
	"method" varchar(32) NOT NULL,
	"criteria" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"member_count" integer DEFAULT 0 NOT NULL,
	"min_members" integer DEFAULT 5 NOT NULL,
	"note" text
);

CREATE TABLE "tvd_match_results" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tvd_enterprise_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"assessment_run_id" uuid NOT NULL,
	"tenant_id" uuid NOT NULL,
	"bank_id" uuid NOT NULL,
	"status" "tvd_record_status" DEFAULT 'active' NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"data_kind" "tvd_data_kind" DEFAULT 'UNVERIFIED' NOT NULL,
	"match_score" numeric(6, 2) DEFAULT '0.00' NOT NULL,
	"matched_rules" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"blocked_by" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"evidence_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"demand_type" varchar(32),
	"urgency" varchar(16),
	"suggested_amount" numeric(18, 2),
	"ai_reasoning" text,
	"verification_status" "tvd_verification_status" DEFAULT 'unverified' NOT NULL,
	"dismissed_reason" text,
	"computed_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "tvd_products" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"bank_id" uuid NOT NULL,
	"status" "tvd_record_status" DEFAULT 'active' NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"code" varchar(64) NOT NULL,
	"name" varchar(128) NOT NULL,
	"category" varchar(32) NOT NULL,
	"product_type" varchar(24) DEFAULT 'credit' NOT NULL,
	"target_stage" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"amount_min" numeric(18, 2),
	"amount_max" numeric(18, 2),
	"term_months" integer,
	"collateral_required" boolean DEFAULT false NOT NULL,
	"hard_requirements" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"selling_points" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"doc_url" varchar(512),
	"active" boolean DEFAULT true NOT NULL,
	"note" text
);

CREATE TABLE "tvd_report_sections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"report_id" uuid NOT NULL,
	"tenant_id" uuid NOT NULL,
	"bank_id" uuid NOT NULL,
	"status" "tvd_record_status" DEFAULT 'active' NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"section_key" varchar(64) NOT NULL,
	"title" varchar(256) NOT NULL,
	"order_index" integer DEFAULT 0 NOT NULL,
	"level" integer DEFAULT 1 NOT NULL,
	"parent_section_id" uuid,
	"body" text DEFAULT '' NOT NULL,
	"blocks" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"evidence_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"contains_ai_content" boolean DEFAULT false NOT NULL,
	"unverified_claims" jsonb DEFAULT '[]'::jsonb NOT NULL
);

CREATE TABLE "tvd_reports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tvd_enterprise_id" uuid NOT NULL,
	"assessment_run_id" uuid NOT NULL,
	"tenant_id" uuid NOT NULL,
	"bank_id" uuid NOT NULL,
	"status" "tvd_record_status" DEFAULT 'active' NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"data_kind" "tvd_data_kind" DEFAULT 'UNVERIFIED' NOT NULL,
	"report_no" varchar(64) NOT NULL,
	"title" varchar(256) NOT NULL,
	"template_key" varchar(64) DEFAULT 'tvd_standard_v1' NOT NULL,
	"stage" varchar(24) DEFAULT 'draft' NOT NULL,
	"summary" text,
	"stats" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"contains_ai_content" boolean DEFAULT true NOT NULL,
	"ai_disclaimer" text,
	"verification_status" "tvd_verification_status" DEFAULT 'unverified' NOT NULL,
	"reviewed_by" uuid,
	"reviewed_at" timestamp with time zone,
	"attachments" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"generated_at" timestamp with time zone DEFAULT now() NOT NULL
);

-- ===== 外键 =====
ALTER TABLE "tvd_enterprise_aliases" ADD CONSTRAINT "tvd_enterprise_aliases_tvd_enterprise_id_tvd_enterprises_id_fk" FOREIGN KEY ("tvd_enterprise_id") REFERENCES "public"."tvd_enterprises"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "tvd_enterprise_profiles" ADD CONSTRAINT "tvd_enterprise_profiles_tvd_enterprise_id_tvd_enterprises_id_fk" FOREIGN KEY ("tvd_enterprise_id") REFERENCES "public"."tvd_enterprises"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "tvd_signal_sources" ADD CONSTRAINT "tvd_signal_sources_signal_id_tvd_signals_id_fk" FOREIGN KEY ("signal_id") REFERENCES "public"."tvd_signals"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "tvd_signal_sources" ADD CONSTRAINT "tvd_signal_sources_source_record_id_tvd_source_records_id_fk" FOREIGN KEY ("source_record_id") REFERENCES "public"."tvd_source_records"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "tvd_signals" ADD CONSTRAINT "tvd_signals_tvd_enterprise_id_tvd_enterprises_id_fk" FOREIGN KEY ("tvd_enterprise_id") REFERENCES "public"."tvd_enterprises"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "tvd_source_lineage" ADD CONSTRAINT "tvd_source_lineage_derived_record_id_tvd_source_records_id_fk" FOREIGN KEY ("derived_record_id") REFERENCES "public"."tvd_source_records"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "tvd_source_lineage" ADD CONSTRAINT "tvd_source_lineage_original_record_id_tvd_source_records_id_fk" FOREIGN KEY ("original_record_id") REFERENCES "public"."tvd_source_records"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "tvd_source_records" ADD CONSTRAINT "tvd_source_records_data_source_id_tvd_data_sources_id_fk" FOREIGN KEY ("data_source_id") REFERENCES "public"."tvd_data_sources"("id") ON DELETE restrict ON UPDATE no action;
ALTER TABLE "tvd_conflict_resolutions" ADD CONSTRAINT "tvd_conflict_resolutions_conflict_id_tvd_fact_conflicts_id_fk" FOREIGN KEY ("conflict_id") REFERENCES "public"."tvd_fact_conflicts"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "tvd_evidence" ADD CONSTRAINT "tvd_evidence_tvd_enterprise_id_tvd_enterprises_id_fk" FOREIGN KEY ("tvd_enterprise_id") REFERENCES "public"."tvd_enterprises"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "tvd_evidence" ADD CONSTRAINT "tvd_evidence_source_record_id_tvd_source_records_id_fk" FOREIGN KEY ("source_record_id") REFERENCES "public"."tvd_source_records"("id") ON DELETE restrict ON UPDATE no action;
ALTER TABLE "tvd_evidence_links" ADD CONSTRAINT "tvd_evidence_links_evidence_id_tvd_evidence_id_fk" FOREIGN KEY ("evidence_id") REFERENCES "public"."tvd_evidence"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "tvd_fact_claims" ADD CONSTRAINT "tvd_fact_claims_tvd_enterprise_id_tvd_enterprises_id_fk" FOREIGN KEY ("tvd_enterprise_id") REFERENCES "public"."tvd_enterprises"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "tvd_fact_claims" ADD CONSTRAINT "tvd_fact_claims_evidence_id_tvd_evidence_id_fk" FOREIGN KEY ("evidence_id") REFERENCES "public"."tvd_evidence"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "tvd_fact_conflicts" ADD CONSTRAINT "tvd_fact_conflicts_tvd_enterprise_id_tvd_enterprises_id_fk" FOREIGN KEY ("tvd_enterprise_id") REFERENCES "public"."tvd_enterprises"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "tvd_review_tasks" ADD CONSTRAINT "tvd_review_tasks_tvd_enterprise_id_tvd_enterprises_id_fk" FOREIGN KEY ("tvd_enterprise_id") REFERENCES "public"."tvd_enterprises"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "tvd_patent_anomalies" ADD CONSTRAINT "tvd_patent_anomalies_tvd_enterprise_id_tvd_enterprises_id_fk" FOREIGN KEY ("tvd_enterprise_id") REFERENCES "public"."tvd_enterprises"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "tvd_patent_anomalies" ADD CONSTRAINT "tvd_patent_anomalies_patent_id_tvd_patents_id_fk" FOREIGN KEY ("patent_id") REFERENCES "public"."tvd_patents"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "tvd_patent_inventors" ADD CONSTRAINT "tvd_patent_inventors_patent_id_tvd_patents_id_fk" FOREIGN KEY ("patent_id") REFERENCES "public"."tvd_patents"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "tvd_patent_inventors" ADD CONSTRAINT "tvd_patent_inventors_person_id_tvd_people_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."tvd_people"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "tvd_patent_quality_assessments" ADD CONSTRAINT "tvd_patent_quality_assessments_patent_id_tvd_patents_id_fk" FOREIGN KEY ("patent_id") REFERENCES "public"."tvd_patents"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "tvd_patent_stats" ADD CONSTRAINT "tvd_patent_stats_tvd_enterprise_id_tvd_enterprises_id_fk" FOREIGN KEY ("tvd_enterprise_id") REFERENCES "public"."tvd_enterprises"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "tvd_patents" ADD CONSTRAINT "tvd_patents_tvd_enterprise_id_tvd_enterprises_id_fk" FOREIGN KEY ("tvd_enterprise_id") REFERENCES "public"."tvd_enterprises"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "tvd_patents" ADD CONSTRAINT "tvd_patents_evidence_id_tvd_evidence_id_fk" FOREIGN KEY ("evidence_id") REFERENCES "public"."tvd_evidence"("id") ON DELETE set null ON UPDATE no action;
ALTER TABLE "tvd_enterprise_chain_positions" ADD CONSTRAINT "tvd_enterprise_chain_positions_tvd_enterprise_id_tvd_enterprises_id_fk" FOREIGN KEY ("tvd_enterprise_id") REFERENCES "public"."tvd_enterprises"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "tvd_assessment_indicators" ADD CONSTRAINT "tvd_assessment_indicators_model_version_id_tvd_assessment_model_versions_id_fk" FOREIGN KEY ("model_version_id") REFERENCES "public"."tvd_assessment_model_versions"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "tvd_assessment_model_versions" ADD CONSTRAINT "tvd_assessment_model_versions_model_id_tvd_assessment_models_id_fk" FOREIGN KEY ("model_id") REFERENCES "public"."tvd_assessment_models"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "tvd_assessment_runs" ADD CONSTRAINT "tvd_assessment_runs_tvd_enterprise_id_tvd_enterprises_id_fk" FOREIGN KEY ("tvd_enterprise_id") REFERENCES "public"."tvd_enterprises"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "tvd_assessment_runs" ADD CONSTRAINT "tvd_assessment_runs_model_version_id_tvd_assessment_model_versions_id_fk" FOREIGN KEY ("model_version_id") REFERENCES "public"."tvd_assessment_model_versions"("id") ON DELETE restrict ON UPDATE no action;
ALTER TABLE "tvd_assessment_scores" ADD CONSTRAINT "tvd_assessment_scores_run_id_tvd_assessment_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."tvd_assessment_runs"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "tvd_assessment_scores" ADD CONSTRAINT "tvd_assessment_scores_indicator_id_tvd_assessment_indicators_id_fk" FOREIGN KEY ("indicator_id") REFERENCES "public"."tvd_assessment_indicators"("id") ON DELETE restrict ON UPDATE no action;
ALTER TABLE "tvd_score_evidence_links" ADD CONSTRAINT "tvd_score_evidence_links_score_id_tvd_assessment_scores_id_fk" FOREIGN KEY ("score_id") REFERENCES "public"."tvd_assessment_scores"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "tvd_benchmark_members" ADD CONSTRAINT "tvd_benchmark_members_set_id_tvd_benchmark_sets_id_fk" FOREIGN KEY ("set_id") REFERENCES "public"."tvd_benchmark_sets"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "tvd_benchmark_members" ADD CONSTRAINT "tvd_benchmark_members_tvd_enterprise_id_tvd_enterprises_id_fk" FOREIGN KEY ("tvd_enterprise_id") REFERENCES "public"."tvd_enterprises"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "tvd_benchmark_results" ADD CONSTRAINT "tvd_benchmark_results_set_id_tvd_benchmark_sets_id_fk" FOREIGN KEY ("set_id") REFERENCES "public"."tvd_benchmark_sets"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "tvd_benchmark_results" ADD CONSTRAINT "tvd_benchmark_results_subject_enterprise_id_tvd_enterprises_id_fk" FOREIGN KEY ("subject_enterprise_id") REFERENCES "public"."tvd_enterprises"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "tvd_benchmark_results" ADD CONSTRAINT "tvd_benchmark_results_assessment_run_id_tvd_assessment_runs_id_fk" FOREIGN KEY ("assessment_run_id") REFERENCES "public"."tvd_assessment_runs"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "tvd_match_results" ADD CONSTRAINT "tvd_match_results_tvd_enterprise_id_tvd_enterprises_id_fk" FOREIGN KEY ("tvd_enterprise_id") REFERENCES "public"."tvd_enterprises"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "tvd_match_results" ADD CONSTRAINT "tvd_match_results_product_id_tvd_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."tvd_products"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "tvd_match_results" ADD CONSTRAINT "tvd_match_results_assessment_run_id_tvd_assessment_runs_id_fk" FOREIGN KEY ("assessment_run_id") REFERENCES "public"."tvd_assessment_runs"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "tvd_report_sections" ADD CONSTRAINT "tvd_report_sections_report_id_tvd_reports_id_fk" FOREIGN KEY ("report_id") REFERENCES "public"."tvd_reports"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "tvd_reports" ADD CONSTRAINT "tvd_reports_tvd_enterprise_id_tvd_enterprises_id_fk" FOREIGN KEY ("tvd_enterprise_id") REFERENCES "public"."tvd_enterprises"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "tvd_reports" ADD CONSTRAINT "tvd_reports_assessment_run_id_tvd_assessment_runs_id_fk" FOREIGN KEY ("assessment_run_id") REFERENCES "public"."tvd_assessment_runs"("id") ON DELETE restrict ON UPDATE no action;

-- ===== 索引 =====
CREATE UNIQUE INDEX "tvd_enterprise_aliases_uniq" ON "tvd_enterprise_aliases" USING btree ("tvd_enterprise_id","normalized_alias");
CREATE INDEX "tvd_enterprise_aliases_norm_trgm_idx" ON "tvd_enterprise_aliases" USING btree ("normalized_alias");
CREATE INDEX "tvd_enterprise_aliases_tenant_idx" ON "tvd_enterprise_aliases" USING btree ("tenant_id","bank_id","status");
CREATE UNIQUE INDEX "tvd_enterprise_profiles_version_uniq" ON "tvd_enterprise_profiles" USING btree ("tvd_enterprise_id","profile_version");
CREATE INDEX "tvd_enterprise_profiles_active_idx" ON "tvd_enterprise_profiles" USING btree ("tvd_enterprise_id","effective_to");
CREATE INDEX "tvd_enterprise_profiles_run_idx" ON "tvd_enterprise_profiles" USING btree ("assessment_run_id");
CREATE INDEX "tvd_enterprises_enterprise_idx" ON "tvd_enterprises" USING btree ("enterprise_id","effective_to");
CREATE INDEX "tvd_enterprises_tenant_bank_idx" ON "tvd_enterprises" USING btree ("tenant_id","bank_id","status");
CREATE INDEX "tvd_enterprises_track_idx" ON "tvd_enterprises" USING btree ("tenant_id","track_code");
CREATE INDEX "tvd_enterprises_name_trgm_idx" ON "tvd_enterprises" USING btree ("display_name");
CREATE INDEX "tvd_enterprises_canonical_idx" ON "tvd_enterprises" USING btree ("canonical_id");
CREATE UNIQUE INDEX "tvd_data_sources_code_uniq" ON "tvd_data_sources" USING btree ("code");
CREATE INDEX "tvd_data_sources_tenant_idx" ON "tvd_data_sources" USING btree ("tenant_id","bank_id","status");
CREATE INDEX "tvd_data_sources_tier_idx" ON "tvd_data_sources" USING btree ("tier");
CREATE UNIQUE INDEX "tvd_signal_sources_pair_uniq" ON "tvd_signal_sources" USING btree ("signal_id","source_record_id");
CREATE INDEX "tvd_signal_sources_signal_idx" ON "tvd_signal_sources" USING btree ("signal_id");
CREATE INDEX "tvd_signals_enterprise_type_idx" ON "tvd_signals" USING btree ("tvd_enterprise_id","signal_type","status");
CREATE INDEX "tvd_signals_dedup_idx" ON "tvd_signals" USING btree ("dedup_key");
CREATE INDEX "tvd_signals_normalized_idx" ON "tvd_signals" USING btree ("normalized_key");
CREATE INDEX "tvd_signals_tenant_idx" ON "tvd_signals" USING btree ("tenant_id","bank_id","status");
CREATE INDEX "tvd_signals_occurred_idx" ON "tvd_signals" USING btree ("tvd_enterprise_id","occurred_at");
CREATE UNIQUE INDEX "tvd_source_lineage_derived_uniq" ON "tvd_source_lineage" USING btree ("derived_record_id","original_record_id");
CREATE INDEX "tvd_source_lineage_original_idx" ON "tvd_source_lineage" USING btree ("original_record_id");
CREATE INDEX "tvd_source_records_tenant_idx" ON "tvd_source_records" USING btree ("tenant_id","bank_id","status");
CREATE INDEX "tvd_source_records_source_idx" ON "tvd_source_records" USING btree ("data_source_id","retrieved_at");
CREATE INDEX "tvd_source_records_origin_idx" ON "tvd_source_records" USING btree ("origin_record_id");
CREATE INDEX "tvd_source_records_hash_idx" ON "tvd_source_records" USING btree ("content_hash");
CREATE INDEX "tvd_conflict_resolutions_conflict_idx" ON "tvd_conflict_resolutions" USING btree ("conflict_id","decided_at");
CREATE INDEX "tvd_evidence_enterprise_idx" ON "tvd_evidence" USING btree ("tvd_enterprise_id","status");
CREATE INDEX "tvd_evidence_source_idx" ON "tvd_evidence" USING btree ("source_record_id");
CREATE INDEX "tvd_evidence_metric_idx" ON "tvd_evidence" USING btree ("tvd_enterprise_id","metric_key");
CREATE INDEX "tvd_evidence_origin_idx" ON "tvd_evidence" USING btree ("origin_record_id");
CREATE INDEX "tvd_evidence_tenant_idx" ON "tvd_evidence" USING btree ("tenant_id","bank_id","status");
CREATE UNIQUE INDEX "tvd_evidence_independence_conclusion_uniq" ON "tvd_evidence_independence" USING btree ("conclusion_kind","conclusion_id");
CREATE UNIQUE INDEX "tvd_evidence_links_conclusion_uniq" ON "tvd_evidence_links" USING btree ("conclusion_kind","conclusion_id","evidence_id");
CREATE INDEX "tvd_evidence_links_evidence_idx" ON "tvd_evidence_links" USING btree ("evidence_id");
CREATE INDEX "tvd_fact_claims_fact_idx" ON "tvd_fact_claims" USING btree ("tvd_enterprise_id","fact_key","status");
CREATE INDEX "tvd_fact_claims_metric_idx" ON "tvd_fact_claims" USING btree ("metric_key","period");
CREATE INDEX "tvd_fact_conflicts_enterprise_idx" ON "tvd_fact_conflicts" USING btree ("tvd_enterprise_id","severity");
CREATE INDEX "tvd_fact_conflicts_fact_idx" ON "tvd_fact_conflicts" USING btree ("fact_key");
CREATE INDEX "tvd_fact_conflicts_unresolved_idx" ON "tvd_fact_conflicts" USING btree ("resolved","status");
CREATE INDEX "tvd_review_tasks_enterprise_idx" ON "tvd_review_tasks" USING btree ("tvd_enterprise_id","state");
CREATE INDEX "tvd_review_tasks_tenant_idx" ON "tvd_review_tasks" USING btree ("tenant_id","bank_id","state");
CREATE INDEX "tvd_patent_anomalies_enterprise_idx" ON "tvd_patent_anomalies" USING btree ("tvd_enterprise_id","anomaly_type");
CREATE INDEX "tvd_patent_anomalies_patent_idx" ON "tvd_patent_anomalies" USING btree ("patent_id");
CREATE INDEX "tvd_patent_anomalies_dedup_idx" ON "tvd_patent_anomalies" USING btree ("tvd_enterprise_id","anomaly_type","rule_version");
CREATE UNIQUE INDEX "tvd_patent_inventors_pair_uniq" ON "tvd_patent_inventors" USING btree ("patent_id","person_id","role");
CREATE INDEX "tvd_patent_inventors_person_idx" ON "tvd_patent_inventors" USING btree ("person_id");
CREATE UNIQUE INDEX "tvd_patent_quality_patent_uniq" ON "tvd_patent_quality_assessments" USING btree ("patent_id","rule_version");
CREATE INDEX "tvd_patent_quality_grade_idx" ON "tvd_patent_quality_assessments" USING btree ("grade","total_score");
CREATE UNIQUE INDEX "tvd_patent_stats_enterprise_uniq" ON "tvd_patent_stats" USING btree ("tvd_enterprise_id","rule_version");
CREATE UNIQUE INDEX "tvd_patents_publication_uniq" ON "tvd_patents" USING btree ("publication_number");
CREATE INDEX "tvd_patents_enterprise_idx" ON "tvd_patents" USING btree ("tvd_enterprise_id","status");
CREATE INDEX "tvd_patents_filing_idx" ON "tvd_patents" USING btree ("filing_date");
CREATE INDEX "tvd_patents_type_idx" ON "tvd_patents" USING btree ("patent_type","legal_status");
CREATE INDEX "tvd_patents_tenant_idx" ON "tvd_patents" USING btree ("tenant_id","bank_id","status");
CREATE INDEX "tvd_people_name_idx" ON "tvd_people" USING btree ("name_normalized","status");
CREATE INDEX "tvd_people_tenant_idx" ON "tvd_people" USING btree ("tenant_id","bank_id","status");
CREATE UNIQUE INDEX "tvd_chain_position_uniq" ON "tvd_enterprise_chain_positions" USING btree ("tvd_enterprise_id","node_code","role");
CREATE INDEX "tvd_chain_position_node_idx" ON "tvd_enterprise_chain_positions" USING btree ("node_code","role");
CREATE UNIQUE INDEX "tvd_industry_edges_pair_uniq" ON "tvd_industry_edges" USING btree ("from_node_code","to_node_code","edge_type");
CREATE INDEX "tvd_industry_edges_from_idx" ON "tvd_industry_edges" USING btree ("from_node_code");
CREATE INDEX "tvd_industry_edges_to_idx" ON "tvd_industry_edges" USING btree ("to_node_code");
CREATE UNIQUE INDEX "tvd_industry_nodes_code_uniq" ON "tvd_industry_nodes" USING btree ("code");
CREATE INDEX "tvd_industry_nodes_parent_idx" ON "tvd_industry_nodes" USING btree ("parent_code");
CREATE INDEX "tvd_industry_nodes_industry_idx" ON "tvd_industry_nodes" USING btree ("industry_code","node_type");
CREATE UNIQUE INDEX "tvd_tracks_code_uniq" ON "tvd_tracks" USING btree ("code");
CREATE UNIQUE INDEX "tvd_assessment_indicator_uniq" ON "tvd_assessment_indicators" USING btree ("model_version_id","code");
CREATE INDEX "tvd_assessment_indicator_dimension_idx" ON "tvd_assessment_indicators" USING btree ("model_version_id","dimension");
CREATE UNIQUE INDEX "tvd_assessment_model_version_uniq" ON "tvd_assessment_model_versions" USING btree ("model_id","version");
CREATE UNIQUE INDEX "tvd_assessment_models_code_uniq" ON "tvd_assessment_models" USING btree ("code");
CREATE INDEX "tvd_assessment_models_tenant_idx" ON "tvd_assessment_models" USING btree ("tenant_id","bank_id","status");
CREATE UNIQUE INDEX "tvd_assessment_runs_no_uniq" ON "tvd_assessment_runs" USING btree ("run_no");
CREATE INDEX "tvd_assessment_runs_enterprise_idx" ON "tvd_assessment_runs" USING btree ("tvd_enterprise_id","started_at");
CREATE INDEX "tvd_assessment_runs_tenant_idx" ON "tvd_assessment_runs" USING btree ("tenant_id","bank_id","status");
CREATE UNIQUE INDEX "tvd_assessment_scores_run_uniq" ON "tvd_assessment_scores" USING btree ("run_id","indicator_id");
CREATE INDEX "tvd_assessment_scores_dimension_idx" ON "tvd_assessment_scores" USING btree ("run_id","dimension");
CREATE UNIQUE INDEX "tvd_score_evidence_link_uniq" ON "tvd_score_evidence_links" USING btree ("score_id","evidence_id");
CREATE INDEX "tvd_score_evidence_link_evidence_idx" ON "tvd_score_evidence_links" USING btree ("evidence_id");
CREATE UNIQUE INDEX "tvd_benchmark_member_uniq" ON "tvd_benchmark_members" USING btree ("set_id","tvd_enterprise_id");
CREATE INDEX "tvd_benchmark_member_set_idx" ON "tvd_benchmark_members" USING btree ("set_id","is_subject");
CREATE UNIQUE INDEX "tvd_benchmark_result_uniq" ON "tvd_benchmark_results" USING btree ("set_id","subject_enterprise_id","metric_key","assessment_run_id");
CREATE INDEX "tvd_benchmark_result_subject_idx" ON "tvd_benchmark_results" USING btree ("subject_enterprise_id","computed_at");
CREATE UNIQUE INDEX "tvd_benchmark_sets_code_uniq" ON "tvd_benchmark_sets" USING btree ("code");
CREATE UNIQUE INDEX "tvd_match_result_uniq" ON "tvd_match_results" USING btree ("tvd_enterprise_id","product_id","assessment_run_id");
CREATE INDEX "tvd_match_result_enterprise_idx" ON "tvd_match_results" USING btree ("tvd_enterprise_id","match_score");
CREATE INDEX "tvd_match_result_product_idx" ON "tvd_match_results" USING btree ("product_id");
CREATE UNIQUE INDEX "tvd_products_code_uniq" ON "tvd_products" USING btree ("code");
CREATE INDEX "tvd_products_type_idx" ON "tvd_products" USING btree ("product_type","active");
CREATE UNIQUE INDEX "tvd_report_sections_order_uniq" ON "tvd_report_sections" USING btree ("report_id","section_key");
CREATE INDEX "tvd_report_sections_report_idx" ON "tvd_report_sections" USING btree ("report_id","order_index");
CREATE UNIQUE INDEX "tvd_reports_no_uniq" ON "tvd_reports" USING btree ("report_no");
CREATE INDEX "tvd_reports_enterprise_idx" ON "tvd_reports" USING btree ("tvd_enterprise_id","stage");
CREATE INDEX "tvd_reports_run_idx" ON "tvd_reports" USING btree ("assessment_run_id");
