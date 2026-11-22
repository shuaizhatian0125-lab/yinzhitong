import {
  pgTable,
  varchar,
  text,
  integer,
  boolean,
  timestamp,
  jsonb,
  serial,
  index,
  uniqueIndex,
} from 'drizzle-orm/pg-core';

/* ============================================================
 * 银智通 Bank AI OS · 数据库基线 Schema V1.0
 * 约定：主键统一 varchar(36) UUID（除了 audit_log/task_event/event_outbox 用 serial）；
 *       所有业务表带 tenant_id；时间统一 timestamptz；软删除使用 deleted_at。
 *       vector 类型列使用 jsonb 占位（Drizzle ORM 不直接支持 pgvector）。
 *       text[] 数组类型使用 jsonb 占位；numeric 使用 integer 占位。
 * ============================================================ */

/* ============================================================
 * 1. 平台域：租户 / 组织 / 用户 / 权限 / 审计
 * ============================================================ */

export const tenant = pgTable('tenant', {
  id: varchar('id', { length: 36 }).primaryKey().notNull(),
  code: varchar('code', { length: 64 }).notNull(),
  name: varchar('name', { length: 128 }).notNull(),
  shortName: varchar('short_name', { length: 64 }),
  brand: jsonb('brand').$type<Record<string, unknown>>(),
  status: varchar('status', { length: 16 }).notNull().default('active'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const orgUnit = pgTable(
  'org_unit',
  {
    id: varchar('id', { length: 36 }).primaryKey().notNull(),
    tenantId: varchar('tenant_id', { length: 36 }).notNull(),
    parentId: varchar('parent_id', { length: 36 }),
    name: varchar('name', { length: 128 }).notNull(),
    code: varchar('code', { length: 64 }).notNull(),
    type: varchar('type', { length: 32 }).notNull().default('department'),
    level: integer('level').notNull().default(1),
    path: text('path').notNull().default(''),
    sort: integer('sort').notNull().default(0),
    status: varchar('status', { length: 16 }).notNull().default('active'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index('org_unit_tenant_idx').on(t.tenantId), index('org_unit_parent_idx').on(t.parentId)],
);

export const appUser = pgTable(
  'app_user',
  {
    id: varchar('id', { length: 36 }).primaryKey().notNull(),
    tenantId: varchar('tenant_id', { length: 36 }).notNull(),
    username: varchar('username', { length: 64 }).notNull(),
    displayName: varchar('display_name', { length: 64 }).notNull(),
    passwordHash: text('password_hash').notNull(),
    orgUnitId: varchar('org_unit_id', { length: 36 }),
    title: varchar('title', { length: 64 }),
    roleCode: varchar('role_code', { length: 64 }).notNull().default('staff'),
    employeeNo: varchar('employee_no', { length: 32 }),
    status: varchar('status', { length: 16 }).notNull().default('active'),
    mustChangePwd: boolean('must_change_pwd').notNull().default(false),
    lastLoginAt: timestamp('last_login_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex('app_user_username_uk').on(t.tenantId, t.username),
    index('app_user_org_idx').on(t.orgUnitId),
  ],
);

export const wechatUserLink = pgTable(
  'wechat_user_link',
  {
    id: varchar('id', { length: 36 }).primaryKey().notNull(),
    openid: varchar('openid', { length: 64 }).notNull(),
    unionid: varchar('unionid', { length: 64 }),
    userId: varchar('user_id', { length: 36 }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex('wechat_user_link_openid_uk').on(t.openid),
    index('wechat_user_link_user_idx').on(t.userId),
  ],
);

export const permission = pgTable(
  'permission',
  {
    id: varchar('id', { length: 36 }).primaryKey().notNull(),
    code: varchar('code', { length: 96 }).notNull(),
    name: varchar('name', { length: 128 }).notNull(),
    module: varchar('module', { length: 48 }).notNull(),
    resource: varchar('resource', { length: 64 }).notNull(),
    action: varchar('action', { length: 32 }).notNull(),
    description: text('description'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex('permission_code_uk').on(t.code),
    index('permission_module_idx').on(t.module),
  ],
);

export const role = pgTable(
  'role',
  {
    id: varchar('id', { length: 36 }).primaryKey().notNull(),
    tenantId: varchar('tenant_id', { length: 36 }).notNull(),
    code: varchar('code', { length: 64 }).notNull(),
    name: varchar('name', { length: 64 }).notNull(),
    description: text('description'),
    isSystem: boolean('is_system').notNull().default(false),
    dataScope: varchar('data_scope', { length: 32 }).notNull().default('self'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [uniqueIndex('role_code_uk').on(t.tenantId, t.code)],
);

export const userRole = pgTable(
  'user_role',
  {
    id: varchar('id', { length: 36 }).primaryKey().notNull(),
    tenantId: varchar('tenant_id', { length: 36 }).notNull(),
    userId: varchar('user_id', { length: 36 }).notNull(),
    roleId: varchar('role_id', { length: 36 }).notNull(),
    scopeOrgId: varchar('scope_org_id', { length: 36 }),
    grantedBy: varchar('granted_by', { length: 36 }),
    expiresAt: timestamp('expires_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex('user_role_uk').on(t.userId, t.roleId, t.scopeOrgId),
    index('user_role_user_idx').on(t.userId),
  ],
);

export const rolePermission = pgTable(
  'role_permission',
  {
    roleId: varchar('role_id', { length: 36 }).notNull(),
    permissionCode: varchar('permission_code', { length: 96 }).notNull(),
    tenantId: varchar('tenant_id', { length: 36 }).notNull(),
  },
  (t) => [uniqueIndex('role_permission_uk').on(t.roleId, t.permissionCode)],
);

export const dataScopePolicy = pgTable(
  'data_scope_policy',
  {
    id: varchar('id', { length: 36 }).primaryKey().notNull(),
    tenantId: varchar('tenant_id', { length: 36 }).notNull(),
    roleId: varchar('role_id', { length: 36 }).notNull(),
    resourceType: varchar('resource_type', { length: 48 }).notNull(),
    scope: varchar('scope', { length: 24 }).notNull().default('self'),
    orgIds: jsonb('org_ids').$type<string[]>().notNull().default([]),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [uniqueIndex('data_scope_policy_uk').on(t.roleId, t.resourceType)],
);

export const session = pgTable(
  'session',
  {
    id: varchar('id', { length: 36 }).primaryKey().notNull(),
    tenantId: varchar('tenant_id', { length: 36 }).notNull(),
    userId: varchar('user_id', { length: 36 }).notNull(),
    tokenHash: varchar('token_hash', { length: 128 }).notNull(),
    ip: varchar('ip', { length: 64 }),
    userAgent: text('user_agent'),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [uniqueIndex('session_token_uk').on(t.tokenHash), index('session_user_idx').on(t.userId)],
);

export const moduleRegistry = pgTable(
  'module_registry',
  {
    code: varchar('code', { length: 48 }).primaryKey().notNull(),
    name: varchar('name', { length: 64 }).notNull(),
    route: varchar('route', { length: 128 }).notNull(),
    icon: varchar('icon', { length: 48 }),
    sort: integer('sort').notNull().default(0),
    tier: varchar('tier', { length: 8 }).notNull().default('P0'),
    dependsOn: jsonb('depends_on').$type<string[]>().notNull().default([]),
    status: varchar('status', { length: 16 }).notNull().default('active'),
  },
);

export const moduleGrant = pgTable(
  'module_grant',
  {
    id: varchar('id', { length: 36 }).primaryKey().notNull(),
    tenantId: varchar('tenant_id', { length: 36 }).notNull(),
    moduleCode: varchar('module_code', { length: 48 }).notNull(),
    enabled: boolean('enabled').notNull().default(true),
    grantedAt: timestamp('granted_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [uniqueIndex('module_grant_uk').on(t.tenantId, t.moduleCode)],
);

export const configItem = pgTable(
  'config_item',
  {
    id: varchar('id', { length: 36 }).primaryKey().notNull(),
    tenantId: varchar('tenant_id', { length: 36 }).notNull(),
    key: varchar('key', { length: 128 }).notNull(),
    value: jsonb('value').$type<Record<string, unknown>>().notNull().default({}),
    description: text('description'),
    updatedBy: varchar('updated_by', { length: 36 }),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [uniqueIndex('config_item_uk').on(t.tenantId, t.key)],
);

export const auditLog = pgTable(
  'audit_log',
  {
    id: serial('id').primaryKey().notNull(),
    tenantId: varchar('tenant_id', { length: 36 }).notNull(),
    userId: varchar('user_id', { length: 36 }),
    username: varchar('username', { length: 64 }),
    action: varchar('action', { length: 64 }).notNull(),
    resourceType: varchar('resource_type', { length: 48 }).notNull(),
    resourceId: varchar('resource_id', { length: 64 }),
    detail: jsonb('detail').$type<Record<string, unknown>>(),
    beforeData: jsonb('before_data').$type<Record<string, unknown>>(),
    afterData: jsonb('after_data').$type<Record<string, unknown>>(),
    hashPrev: varchar('hash_prev', { length: 128 }),
    hashCurrent: varchar('hash_current', { length: 128 }),
    ip: varchar('ip', { length: 64 }),
    result: varchar('result', { length: 16 }).notNull().default('success'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index('audit_tenant_time_idx').on(t.tenantId, t.createdAt),
    index('audit_resource_idx').on(t.resourceType, t.resourceId),
    index('audit_user_idx').on(t.tenantId, t.userId, t.createdAt),
  ],
);

export const notification = pgTable(
  'notification',
  {
    id: varchar('id', { length: 36 }).primaryKey().notNull(),
    tenantId: varchar('tenant_id', { length: 36 }).notNull(),
    userId: varchar('user_id', { length: 36 }).notNull(),
    type: varchar('type', { length: 32 }).notNull(),
    title: varchar('title', { length: 255 }).notNull(),
    body: text('body'),
    link: varchar('link', { length: 512 }),
    channel: varchar('channel', { length: 16 }).notNull().default('inapp'),
    readAt: timestamp('read_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index('notification_user_idx').on(t.tenantId, t.userId, t.readAt, t.createdAt)],
);

export const fileObject = pgTable(
  'file_object',
  {
    id: varchar('id', { length: 36 }).primaryKey().notNull(),
    tenantId: varchar('tenant_id', { length: 36 }).notNull(),
    bucket: varchar('bucket', { length: 64 }).notNull(),
    objectKey: varchar('object_key', { length: 512 }).notNull(),
    filename: varchar('filename', { length: 255 }).notNull(),
    mime: varchar('mime', { length: 128 }),
    sizeBytes: integer('size_bytes'),
    checksum: varchar('checksum', { length: 64 }),
    ownerId: varchar('owner_id', { length: 36 }),
    sensitivity: varchar('sensitivity', { length: 16 }).notNull().default('internal'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index('file_owner_idx').on(t.tenantId, t.ownerId)],
);

export const job = pgTable(
  'job',
  {
    id: varchar('id', { length: 36 }).primaryKey().notNull(),
    tenantId: varchar('tenant_id', { length: 36 }).notNull(),
    kind: varchar('kind', { length: 48 }).notNull(),
    status: varchar('status', { length: 16 }).notNull().default('queued'),
    payload: jsonb('payload').$type<Record<string, unknown>>().notNull().default({}),
    result: jsonb('result').$type<Record<string, unknown>>(),
    progress: integer('progress').notNull().default(0),
    error: text('error'),
    createdBy: varchar('created_by', { length: 36 }),
    startedAt: timestamp('started_at', { withTimezone: true }),
    finishedAt: timestamp('finished_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index('job_status_idx').on(t.tenantId, t.status, t.createdAt)],
);

/* ============================================================
 * 2. AI 域：模型 / Agent / 会话 / 执行 / 记忆
 * ============================================================ */

export const aiProvider = pgTable(
  'ai_provider',
  {
    id: varchar('id', { length: 36 }).primaryKey().notNull(),
    tenantId: varchar('tenant_id', { length: 36 }).notNull(),
    name: varchar('name', { length: 64 }).notNull(),
    kind: varchar('kind', { length: 32 }).notNull(),
    baseUrl: varchar('base_url', { length: 255 }).notNull(),
    apiKeyEnc: text('api_key_enc'),
    models: jsonb('models').$type<unknown[]>().notNull().default([]),
    capabilities: jsonb('capabilities').$type<string[]>().notNull().default(['chat']),
    priority: integer('priority').notNull().default(100),
    status: varchar('status', { length: 16 }).notNull().default('active'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [uniqueIndex('ai_provider_uk').on(t.tenantId, t.name)],
);

export const aiModelRoute = pgTable(
  'ai_model_route',
  {
    id: varchar('id', { length: 36 }).primaryKey().notNull(),
    tenantId: varchar('tenant_id', { length: 36 }).notNull(),
    purpose: varchar('purpose', { length: 48 }).notNull(),
    primaryProviderId: varchar('primary_provider_id', { length: 36 }),
    primaryModel: varchar('primary_model', { length: 96 }).notNull(),
    fallbackChain: jsonb('fallback_chain').$type<unknown[]>().notNull().default([]),
    params: jsonb('params').$type<Record<string, unknown>>().notNull().default({}),
    enabled: boolean('enabled').notNull().default(true),
  },
  (t) => [uniqueIndex('ai_model_route_uk').on(t.tenantId, t.purpose)],
);

export const agent = pgTable(
  'agent',
  {
    id: varchar('id', { length: 36 }).primaryKey().notNull(),
    tenantId: varchar('tenant_id', { length: 36 }).notNull(),
    code: varchar('code', { length: 64 }).notNull(),
    name: varchar('name', { length: 64 }).notNull(),
    module: varchar('module', { length: 48 }).notNull(),
    description: text('description'),
    version: varchar('version', { length: 16 }).notNull().default('1.0.0'),
    definition: jsonb('definition').$type<Record<string, unknown>>().notNull(),
    tools: jsonb('tools').$type<string[]>().notNull().default([]),
    dataDomains: jsonb('data_domains').$type<string[]>().notNull().default([]),
    riskLevel: varchar('risk_level', { length: 8 }).notNull().default('L0'),
    isBuiltin: boolean('is_builtin').notNull().default(true),
    status: varchar('status', { length: 16 }).notNull().default('active'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [uniqueIndex('agent_uk').on(t.tenantId, t.code, t.version)],
);

export const promptTemplate = pgTable(
  'prompt_template',
  {
    id: varchar('id', { length: 36 }).primaryKey().notNull(),
    tenantId: varchar('tenant_id', { length: 36 }).notNull(),
    code: varchar('code', { length: 96 }).notNull(),
    name: varchar('name', { length: 128 }).notNull(),
    module: varchar('module', { length: 48 }).notNull(),
    version: integer('version').notNull().default(1),
    content: text('content').notNull(),
    variables: jsonb('variables').$type<unknown[]>().notNull().default([]),
    status: varchar('status', { length: 16 }).notNull().default('draft'),
    createdBy: varchar('created_by', { length: 36 }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [uniqueIndex('prompt_template_uk').on(t.tenantId, t.code, t.version)],
);

export const conversation = pgTable(
  'conversation',
  {
    id: varchar('id', { length: 36 }).primaryKey().notNull(),
    tenantId: varchar('tenant_id', { length: 36 }).notNull(),
    userId: varchar('user_id', { length: 36 }).notNull(),
    title: varchar('title', { length: 200 }).notNull().default('新会话'),
    agentCode: varchar('agent_code', { length: 64 }).notNull().default('assistant'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index('conversation_user_idx').on(t.userId)],
);

export const message = pgTable(
  'message',
  {
    id: varchar('id', { length: 36 }).primaryKey().notNull(),
    tenantId: varchar('tenant_id', { length: 36 }).notNull(),
    conversationId: varchar('conversation_id', { length: 36 }).notNull(),
    role: varchar('role', { length: 16 }).notNull(),
    content: text('content').notNull(),
    model: varchar('model', { length: 64 }),
    tokens: integer('tokens'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index('message_conversation_idx').on(t.conversationId, t.createdAt)],
);

export const aiRun = pgTable(
  'ai_run',
  {
    id: varchar('id', { length: 36 }).primaryKey().notNull(),
    tenantId: varchar('tenant_id', { length: 36 }).notNull(),
    conversationId: varchar('conversation_id', { length: 36 }),
    messageId: varchar('message_id', { length: 36 }),
    userId: varchar('user_id', { length: 36 }).notNull(),
    agentCode: varchar('agent_code', { length: 64 }).notNull(),
    goal: text('goal').notNull(),
    plan: jsonb('plan').$type<Record<string, unknown>>(),
    status: varchar('status', { length: 20 }).notNull().default('queued'),
    riskLevel: varchar('risk_level', { length: 8 }).notNull().default('L0'),
    result: jsonb('result').$type<Record<string, unknown>>(),
    error: text('error'),
    maxTokens: integer('max_tokens'),
    maxToolCalls: integer('max_tool_calls'),
    maxSteps: integer('max_steps'),
    timeoutSeconds: integer('timeout_seconds'),
    startedAt: timestamp('started_at', { withTimezone: true }),
    finishedAt: timestamp('finished_at', { withTimezone: true }),
    latencyMs: integer('latency_ms'),
    cost: integer('cost').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index('ai_run_user_idx').on(t.tenantId, t.userId, t.createdAt),
    index('ai_run_status_idx').on(t.tenantId, t.status),
  ],
);

export const aiRunStep = pgTable(
  'ai_run_step',
  {
    id: varchar('id', { length: 36 }).primaryKey().notNull(),
    tenantId: varchar('tenant_id', { length: 36 }).notNull(),
    runId: varchar('run_id', { length: 36 }).notNull(),
    seq: integer('seq').notNull(),
    kind: varchar('kind', { length: 16 }).notNull(),
    name: varchar('name', { length: 128 }).notNull(),
    input: jsonb('input').$type<Record<string, unknown>>(),
    output: jsonb('output').$type<Record<string, unknown>>(),
    status: varchar('status', { length: 16 }).notNull().default('pending'),
    error: text('error'),
    startedAt: timestamp('started_at', { withTimezone: true }),
    finishedAt: timestamp('finished_at', { withTimezone: true }),
  },
  (t) => [uniqueIndex('ai_run_step_uk').on(t.runId, t.seq)],
);

export const aiToolCall = pgTable(
  'ai_tool_call',
  {
    id: varchar('id', { length: 36 }).primaryKey().notNull(),
    tenantId: varchar('tenant_id', { length: 36 }).notNull(),
    runId: varchar('run_id', { length: 36 }).notNull(),
    stepId: varchar('step_id', { length: 36 }),
    toolCode: varchar('tool_code', { length: 96 }).notNull(),
    args: jsonb('args').$type<Record<string, unknown>>(),
    result: jsonb('result').$type<Record<string, unknown>>(),
    permissionChecked: boolean('permission_checked').notNull().default(false),
    riskLevel: varchar('risk_level', { length: 8 }).notNull().default('L0'),
    status: varchar('status', { length: 16 }).notNull().default('pending'),
    inputHash: varchar('input_hash', { length: 128 }),
    outputHash: varchar('output_hash', { length: 128 }),
    approvalId: varchar('approval_id', { length: 36 }),
    executionStatus: varchar('execution_status', { length: 24 }),
    latencyMs: integer('latency_ms'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index('ai_tool_call_run_idx').on(t.runId)],
);

export const aiModelUsage = pgTable(
  'ai_model_usage',
  {
    id: varchar('id', { length: 36 }).primaryKey().notNull(),
    tenantId: varchar('tenant_id', { length: 36 }).notNull(),
    runId: varchar('run_id', { length: 36 }),
    provider: varchar('provider', { length: 64 }).notNull(),
    model: varchar('model', { length: 96 }).notNull(),
    purpose: varchar('purpose', { length: 48 }),
    promptTokens: integer('prompt_tokens').notNull().default(0),
    completionTokens: integer('completion_tokens').notNull().default(0),
    cost: integer('cost').notNull().default(0),
    latencyMs: integer('latency_ms'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index('ai_model_usage_tenant_idx').on(t.tenantId, t.createdAt)],
);

export const aiMemory = pgTable(
  'ai_memory',
  {
    id: varchar('id', { length: 36 }).primaryKey().notNull(),
    tenantId: varchar('tenant_id', { length: 36 }).notNull(),
    userId: varchar('user_id', { length: 36 }),
    scope: varchar('scope', { length: 16 }).notNull(),
    memoryType: varchar('memory_type', { length: 24 }),
    scopeLevel: varchar('scope_level', { length: 24 }),
    key: varchar('key', { length: 128 }).notNull(),
    content: text('content').notNull(),
    embedding: jsonb('embedding').$type<number[]>(),
    importance: integer('importance').notNull().default(3),
    confidence: integer('confidence'),
    sensitivity: varchar('sensitivity', { length: 16 }),
    status: varchar('status', { length: 16 }),
    expiresAt: timestamp('expires_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index('ai_memory_user_idx').on(t.tenantId, t.userId, t.scope)],
);

export const aiFeedback = pgTable(
  'ai_feedback',
  {
    id: varchar('id', { length: 36 }).primaryKey().notNull(),
    tenantId: varchar('tenant_id', { length: 36 }).notNull(),
    runId: varchar('run_id', { length: 36 }),
    userId: varchar('user_id', { length: 36 }).notNull(),
    rating: integer('rating'),
    comment: text('comment'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
);

/* ============================================================
 * 3. 任务域
 * ============================================================ */

export const task = pgTable(
  'task',
  {
    id: varchar('id', { length: 36 }).primaryKey().notNull(),
    tenantId: varchar('tenant_id', { length: 36 }).notNull(),
    code: varchar('code', { length: 32 }).notNull(),
    title: varchar('title', { length: 200 }).notNull(),
    description: text('description'),
    module: varchar('module', { length: 32 }).notNull().default('general'),
    category: varchar('category', { length: 32 }),
    priority: varchar('priority', { length: 8 }).notNull().default('P2'),
    status: varchar('status', { length: 16 }).notNull().default('draft'),
    ownerId: varchar('owner_id', { length: 36 }).notNull(),
    assigneeId: varchar('assignee_id', { length: 36 }),
    orgUnitId: varchar('org_unit_id', { length: 36 }),
    parentId: varchar('parent_id', { length: 36 }),
    dueAt: timestamp('due_at', { withTimezone: true }),
    progress: integer('progress').notNull().default(0),
    source: varchar('source', { length: 16 }).notNull().default('manual'),
    tags: jsonb('tags').$type<string[]>().notNull().default([]),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
    completedAt: timestamp('completed_at', { withTimezone: true }),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (t) => [
    index('task_tenant_status_idx').on(t.tenantId, t.status),
    index('task_assignee_idx').on(t.assigneeId),
    index('task_created_idx').on(t.createdAt),
    index('task_parent_idx').on(t.parentId),
  ],
);

export const taskDependency = pgTable(
  'task_dependency',
  {
    id: varchar('id', { length: 36 }).primaryKey().notNull(),
    tenantId: varchar('tenant_id', { length: 36 }).notNull(),
    taskId: varchar('task_id', { length: 36 }).notNull(),
    dependsOnId: varchar('depends_on_id', { length: 36 }).notNull(),
    type: varchar('type', { length: 24 }).notNull().default('finish_to_start'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [uniqueIndex('task_dependency_uk').on(t.taskId, t.dependsOnId)],
);

export const taskEvent = pgTable(
  'task_event',
  {
    id: serial('id').primaryKey().notNull(),
    tenantId: varchar('tenant_id', { length: 36 }).notNull(),
    taskId: varchar('task_id', { length: 36 }).notNull(),
    actorId: varchar('actor_id', { length: 36 }),
    action: varchar('action', { length: 32 }).notNull(),
    fromStatus: varchar('from_status', { length: 24 }),
    toStatus: varchar('to_status', { length: 24 }),
    reason: text('reason'),
    note: text('note'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index('task_event_task_idx').on(t.taskId, t.createdAt)],
);

export const taskComment = pgTable(
  'task_comment',
  {
    id: varchar('id', { length: 36 }).primaryKey().notNull(),
    tenantId: varchar('tenant_id', { length: 36 }).notNull(),
    taskId: varchar('task_id', { length: 36 }).notNull(),
    userId: varchar('user_id', { length: 36 }).notNull(),
    content: text('content').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index('task_comment_task_idx').on(t.taskId, t.createdAt)],
);

export const calendarEvent = pgTable(
  'calendar_event',
  {
    id: varchar('id', { length: 36 }).primaryKey().notNull(),
    tenantId: varchar('tenant_id', { length: 36 }).notNull(),
    userId: varchar('user_id', { length: 36 }).notNull(),
    title: varchar('title', { length: 255 }).notNull(),
    startAt: timestamp('start_at', { withTimezone: true }).notNull(),
    endAt: timestamp('end_at', { withTimezone: true }).notNull(),
    allDay: boolean('all_day').notNull().default(false),
    location: varchar('location', { length: 255 }),
    taskId: varchar('task_id', { length: 36 }),
    source: varchar('source', { length: 16 }).notNull().default('manual'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index('calendar_event_user_idx').on(t.tenantId, t.userId, t.startAt)],
);

/* ============================================================
 * 4. 协同域：协同事项 / 工作流 / 审批
 * ============================================================ */

export const collaboration = pgTable(
  'collaboration',
  {
    id: varchar('id', { length: 36 }).primaryKey().notNull(),
    tenantId: varchar('tenant_id', { length: 36 }).notNull(),
    code: varchar('code', { length: 32 }).notNull(),
    title: varchar('title', { length: 255 }).notNull(),
    type: varchar('type', { length: 24 }).notNull().default('project'),
    scale: varchar('scale', { length: 24 }),
    structureType: varchar('structure_type', { length: 24 }),
    coordinatorMode: varchar('coordinator_mode', { length: 24 }),
    description: text('description'),
    ownerId: varchar('owner_id', { length: 36 }),
    orgUnitId: varchar('org_unit_id', { length: 36 }),
    status: varchar('status', { length: 24 }).notNull().default('draft'),
    successCriteria: text('success_criteria'),
    completionCriteria: jsonb('completion_criteria').$type<Record<string, unknown>>(),
    coordinatorAgentId: varchar('coordinator_agent_id', { length: 36 }),
    startedAt: timestamp('started_at', { withTimezone: true }),
    completedAt: timestamp('completed_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [uniqueIndex('collaboration_uk').on(t.tenantId, t.code)],
);

export const collaborationMember = pgTable(
  'collaboration_member',
  {
    id: varchar('id', { length: 36 }).primaryKey().notNull(),
    tenantId: varchar('tenant_id', { length: 36 }).notNull(),
    collaborationId: varchar('collaboration_id', { length: 36 }).notNull(),
    userId: varchar('user_id', { length: 36 }).notNull(),
    role: varchar('role', { length: 24 }).notNull().default('member'),
    joinedAt: timestamp('joined_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [uniqueIndex('collaboration_member_uk').on(t.collaborationId, t.userId)],
);

export const workflowDef = pgTable(
  'workflow_def',
  {
    id: varchar('id', { length: 36 }).primaryKey().notNull(),
    tenantId: varchar('tenant_id', { length: 36 }).notNull(),
    code: varchar('code', { length: 64 }).notNull(),
    name: varchar('name', { length: 128 }).notNull(),
    version: integer('version').notNull().default(1),
    definition: jsonb('definition').$type<Record<string, unknown>>().notNull(),
    status: varchar('status', { length: 16 }).notNull().default('draft'),
    createdBy: varchar('created_by', { length: 36 }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [uniqueIndex('workflow_def_uk').on(t.tenantId, t.code, t.version)],
);

export const workflowInstance = pgTable(
  'workflow_instance',
  {
    id: varchar('id', { length: 36 }).primaryKey().notNull(),
    tenantId: varchar('tenant_id', { length: 36 }).notNull(),
    defId: varchar('def_id', { length: 36 }).notNull(),
    defVersion: integer('def_version').notNull(),
    businessType: varchar('business_type', { length: 48 }),
    businessId: varchar('business_id', { length: 36 }),
    status: varchar('status', { length: 16 }).notNull().default('running'),
    context: jsonb('context').$type<Record<string, unknown>>().notNull().default({}),
    startedBy: varchar('started_by', { length: 36 }),
    startedAt: timestamp('started_at', { withTimezone: true }).defaultNow().notNull(),
    finishedAt: timestamp('finished_at', { withTimezone: true }),
  },
  (t) => [index('workflow_instance_business_idx').on(t.tenantId, t.businessType, t.businessId)],
);

export const workflowNodeInstance = pgTable(
  'workflow_node_instance',
  {
    id: varchar('id', { length: 36 }).primaryKey().notNull(),
    tenantId: varchar('tenant_id', { length: 36 }).notNull(),
    instanceId: varchar('instance_id', { length: 36 }).notNull(),
    nodeKey: varchar('node_key', { length: 64 }).notNull(),
    nodeType: varchar('node_type', { length: 24 }).notNull(),
    status: varchar('status', { length: 16 }).notNull().default('pending'),
    assigneeId: varchar('assignee_id', { length: 36 }),
    input: jsonb('input').$type<Record<string, unknown>>(),
    output: jsonb('output').$type<Record<string, unknown>>(),
    dueAt: timestamp('due_at', { withTimezone: true }),
    retryCount: integer('retry_count').notNull().default(0),
    error: text('error'),
    startedAt: timestamp('started_at', { withTimezone: true }),
    finishedAt: timestamp('finished_at', { withTimezone: true }),
  },
  (t) => [index('workflow_node_instance_idx').on(t.instanceId, t.nodeKey)],
);

export const approval = pgTable(
  'approval',
  {
    id: varchar('id', { length: 36 }).primaryKey().notNull(),
    tenantId: varchar('tenant_id', { length: 36 }).notNull(),
    instanceId: varchar('instance_id', { length: 36 }),
    nodeKey: varchar('node_key', { length: 64 }),
    businessType: varchar('business_type', { length: 48 }).notNull(),
    businessId: varchar('business_id', { length: 36 }).notNull(),
    approverId: varchar('approver_id', { length: 36 }).notNull(),
    decision: varchar('decision', { length: 16 }).notNull().default('pending'),
    comment: text('comment'),
    decidedAt: timestamp('decided_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index('approval_approver_idx').on(t.tenantId, t.approverId, t.decision)],
);

/* ============================================================
 * 5. 文档域
 * ============================================================ */

export const document = pgTable(
  'document',
  {
    id: varchar('id', { length: 36 }).primaryKey().notNull(),
    tenantId: varchar('tenant_id', { length: 36 }).notNull(),
    code: varchar('code', { length: 32 }).notNull(),
    title: varchar('title', { length: 255 }).notNull(),
    docType: varchar('doc_type', { length: 48 }).notNull().default('report'),
    module: varchar('module', { length: 48 }).notNull().default('office'),
    ownerId: varchar('owner_id', { length: 36 }).notNull(),
    orgUnitId: varchar('org_unit_id', { length: 36 }),
    status: varchar('status', { length: 16 }).notNull().default('draft'),
    visibility: varchar('visibility', { length: 16 }).notNull().default('org'),
    templateId: varchar('template_id', { length: 36 }),
    currentVersionId: varchar('current_version_id', { length: 36 }),
    aiRunId: varchar('ai_run_id', { length: 36 }),
    qualityScore: integer('quality_score'),
    tags: jsonb('tags').$type<string[]>().notNull().default([]),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (t) => [
    uniqueIndex('document_uk').on(t.tenantId, t.code),
    index('document_owner_idx').on(t.tenantId, t.ownerId, t.updatedAt),
    index('document_status_idx').on(t.tenantId, t.status),
  ],
);

export const documentVersion = pgTable(
  'document_version',
  {
    id: varchar('id', { length: 36 }).primaryKey().notNull(),
    tenantId: varchar('tenant_id', { length: 36 }).notNull(),
    documentId: varchar('document_id', { length: 36 }).notNull(),
    versionNo: integer('version_no').notNull(),
    title: varchar('title', { length: 255 }).notNull(),
    editorId: varchar('editor_id', { length: 36 }),
    changeNote: text('change_note'),
    wordCount: integer('word_count').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [uniqueIndex('document_version_uk').on(t.documentId, t.versionNo)],
);

export const documentContent = pgTable(
  'document_content',
  {
    id: varchar('id', { length: 36 }).primaryKey().notNull(),
    tenantId: varchar('tenant_id', { length: 36 }).notNull(),
    documentId: varchar('document_id', { length: 36 }).notNull(),
    versionId: varchar('version_id', { length: 36 }).notNull(),
    blocks: jsonb('blocks').$type<unknown[]>().notNull().default([]),
    plainText: text('plain_text').notNull().default(''),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [uniqueIndex('document_content_uk').on(t.versionId)],
);

export const documentTemplate = pgTable(
  'document_template',
  {
    id: varchar('id', { length: 36 }).primaryKey().notNull(),
    tenantId: varchar('tenant_id', { length: 36 }).notNull(),
    code: varchar('code', { length: 64 }).notNull(),
    name: varchar('name', { length: 128 }).notNull(),
    docType: varchar('doc_type', { length: 48 }).notNull(),
    scope: varchar('scope', { length: 16 }).notNull().default('tenant'),
    definition: jsonb('definition').$type<Record<string, unknown>>().notNull(),
    status: varchar('status', { length: 16 }).notNull().default('active'),
    createdBy: varchar('created_by', { length: 36 }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [uniqueIndex('document_template_uk').on(t.tenantId, t.code)],
);

export const documentShare = pgTable(
  'document_share',
  {
    id: varchar('id', { length: 36 }).primaryKey().notNull(),
    tenantId: varchar('tenant_id', { length: 36 }).notNull(),
    documentId: varchar('document_id', { length: 36 }).notNull(),
    targetType: varchar('target_type', { length: 16 }).notNull(),
    targetId: varchar('target_id', { length: 36 }).notNull(),
    permission: varchar('permission', { length: 16 }).notNull().default('view'),
    createdBy: varchar('created_by', { length: 36 }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index('document_share_doc_idx').on(t.documentId)],
);

export const documentSourceRef = pgTable(
  'document_source_ref',
  {
    id: varchar('id', { length: 36 }).primaryKey().notNull(),
    tenantId: varchar('tenant_id', { length: 36 }).notNull(),
    documentId: varchar('document_id', { length: 36 }).notNull(),
    sectionKey: varchar('section_key', { length: 64 }),
    sourceType: varchar('source_type', { length: 24 }).notNull(),
    sourceId: varchar('source_id', { length: 64 }),
    title: varchar('title', { length: 255 }),
    url: varchar('url', { length: 1024 }),
    snippet: text('snippet'),
    confidence: integer('confidence'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index('document_source_ref_doc_idx').on(t.documentId)],
);

/* ============================================================
 * 6. 会议域
 * ============================================================ */

export const meeting = pgTable(
  'meeting',
  {
    id: varchar('id', { length: 36 }).primaryKey().notNull(),
    tenantId: varchar('tenant_id', { length: 36 }).notNull(),
    title: varchar('title', { length: 255 }).notNull(),
    organizerId: varchar('organizer_id', { length: 36 }).notNull(),
    startAt: timestamp('start_at', { withTimezone: true }).notNull(),
    endAt: timestamp('end_at', { withTimezone: true }),
    participants: jsonb('participants').$type<unknown[]>().notNull().default([]),
    audioFileId: varchar('audio_file_id', { length: 36 }),
    status: varchar('status', { length: 16 }).notNull().default('scheduled'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
);

export const meetingMinutes = pgTable(
  'meeting_minutes',
  {
    id: varchar('id', { length: 36 }).primaryKey().notNull(),
    tenantId: varchar('tenant_id', { length: 36 }).notNull(),
    meetingId: varchar('meeting_id', { length: 36 }).notNull(),
    summary: text('summary'),
    decisions: jsonb('decisions').$type<unknown[]>().notNull().default([]),
    actions: jsonb('actions').$type<unknown[]>().notNull().default([]),
    docId: varchar('doc_id', { length: 36 }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index('meeting_minutes_meeting_idx').on(t.meetingId)],
);

/* ============================================================
 * 7. 知识库域
 * ============================================================ */

export const knowledgeBase = pgTable(
  'knowledge_base',
  {
    id: varchar('id', { length: 36 }).primaryKey().notNull(),
    tenantId: varchar('tenant_id', { length: 36 }).notNull(),
    code: varchar('code', { length: 64 }).notNull(),
    name: varchar('name', { length: 128 }).notNull(),
    description: text('description'),
    ownerId: varchar('owner_id', { length: 36 }),
    orgUnitId: varchar('org_unit_id', { length: 36 }),
    visibility: varchar('visibility', { length: 16 }).notNull().default('org'),
    embeddingModel: varchar('embedding_model', { length: 96 }).notNull().default('default'),
    status: varchar('status', { length: 16 }).notNull().default('active'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [uniqueIndex('knowledge_base_uk').on(t.tenantId, t.code)],
);

export const knowledgeDoc = pgTable(
  'knowledge_doc',
  {
    id: varchar('id', { length: 36 }).primaryKey().notNull(),
    tenantId: varchar('tenant_id', { length: 36 }).notNull(),
    kbId: varchar('kb_id', { length: 36 }).notNull(),
    fileId: varchar('file_id', { length: 36 }),
    title: varchar('title', { length: 255 }).notNull(),
    sourceType: varchar('source_type', { length: 24 }).notNull().default('upload'),
    sourceUrl: varchar('source_url', { length: 1024 }),
    status: varchar('status', { length: 16 }).notNull().default('pending'),
    chunkCount: integer('chunk_count').notNull().default(0),
    error: text('error'),
    metadata: jsonb('metadata').$type<Record<string, unknown>>().notNull().default({}),
    createdBy: varchar('created_by', { length: 36 }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index('knowledge_doc_kb_idx').on(t.kbId, t.status)],
);

export const knowledgeChunk = pgTable(
  'knowledge_chunk',
  {
    id: varchar('id', { length: 36 }).primaryKey().notNull(),
    tenantId: varchar('tenant_id', { length: 36 }).notNull(),
    kbId: varchar('kb_id', { length: 36 }).notNull(),
    docId: varchar('doc_id', { length: 36 }).notNull(),
    seq: integer('seq').notNull(),
    content: text('content').notNull(),
    tokens: integer('tokens').notNull().default(0),
    heading: varchar('heading', { length: 255 }),
    pageNo: integer('page_no'),
    embedding: jsonb('embedding').$type<number[]>(),
    metadata: jsonb('metadata').$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index('knowledge_chunk_doc_idx').on(t.docId, t.seq)],
);

export const knowledgeGrant = pgTable(
  'knowledge_grant',
  {
    id: varchar('id', { length: 36 }).primaryKey().notNull(),
    tenantId: varchar('tenant_id', { length: 36 }).notNull(),
    kbId: varchar('kb_id', { length: 36 }).notNull(),
    targetType: varchar('target_type', { length: 16 }).notNull(),
    targetId: varchar('target_id', { length: 36 }).notNull(),
    permission: varchar('permission', { length: 16 }).notNull().default('view'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index('knowledge_grant_kb_idx').on(t.kbId)],
);

export const knowledgeQaLog = pgTable(
  'knowledge_qa_log',
  {
    id: varchar('id', { length: 36 }).primaryKey().notNull(),
    tenantId: varchar('tenant_id', { length: 36 }).notNull(),
    kbId: varchar('kb_id', { length: 36 }).notNull(),
    userId: varchar('user_id', { length: 36 }).notNull(),
    question: text('question').notNull(),
    answer: text('answer'),
    refs: jsonb('refs').$type<unknown[]>().notNull().default([]),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index('knowledge_qa_log_kb_idx').on(t.kbId, t.createdAt)],
);

/* ============================================================
 * 8. 企业域
 * ============================================================ */

export const enterprise = pgTable(
  'enterprise',
  {
    id: varchar('id', { length: 36 }).primaryKey().notNull(),
    tenantId: varchar('tenant_id', { length: 36 }).notNull(),
    name: varchar('name', { length: 255 }).notNull(),
    unifiedCode: varchar('unified_code', { length: 32 }),
    industry: varchar('industry', { length: 128 }),
    scale: varchar('scale', { length: 32 }),
    region: varchar('region', { length: 64 }),
    level: varchar('level', { length: 16 }),
    ownerId: varchar('owner_id', { length: 36 }),
    riskLevel: varchar('risk_level', { length: 16 }).notNull().default('unknown'),
    profile: jsonb('profile').$type<Record<string, unknown>>().notNull().default({}),
    tags: jsonb('tags').$type<string[]>().notNull().default([]),
    isTech: boolean('is_tech').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (t) => [index('enterprise_owner_idx').on(t.tenantId, t.ownerId)],
);

export const enterpriseAnalysis = pgTable(
  'enterprise_analysis',
  {
    id: varchar('id', { length: 36 }).primaryKey().notNull(),
    tenantId: varchar('tenant_id', { length: 36 }).notNull(),
    enterpriseId: varchar('enterprise_id', { length: 36 }).notNull(),
    type: varchar('type', { length: 24 }).notNull(),
    aiRunId: varchar('ai_run_id', { length: 36 }),
    summary: text('summary'),
    scores: jsonb('scores').$type<Record<string, unknown>>().notNull().default({}),
    evidence: jsonb('evidence').$type<unknown[]>().notNull().default([]),
    demands: jsonb('demands').$type<unknown[]>().notNull().default([]),
    reportContent: jsonb('report_content').$type<Record<string, unknown>>().notNull().default({}),
    docId: varchar('doc_id', { length: 36 }),
    createdBy: varchar('created_by', { length: 36 }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index('enterprise_analysis_ent_idx').on(t.enterpriseId)],
);

/* ============================================================
 * 9. 行业域
 * ============================================================ */

export const industry = pgTable(
  'industry',
  {
    id: varchar('id', { length: 36 }).primaryKey().notNull(),
    tenantId: varchar('tenant_id', { length: 36 }).notNull(),
    name: varchar('name', { length: 128 }).notNull(),
    code: varchar('code', { length: 32 }),
    parentId: varchar('parent_id', { length: 36 }),
    level: integer('level').notNull().default(1),
    description: text('description'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index('industry_parent_idx').on(t.parentId)],
);

export const industryResearch = pgTable(
  'industry_research',
  {
    id: varchar('id', { length: 36 }).primaryKey().notNull(),
    tenantId: varchar('tenant_id', { length: 36 }).notNull(),
    industryId: varchar('industry_id', { length: 36 }),
    title: varchar('title', { length: 255 }).notNull(),
    period: varchar('period', { length: 32 }),
    keyFindings: jsonb('key_findings').$type<unknown[]>().notNull().default([]),
    contentDocId: varchar('content_doc_id', { length: 36 }),
    createdBy: varchar('created_by', { length: 36 }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index('industry_research_industry_idx').on(t.industryId)],
);

/* ============================================================
 * 10. 客户域
 * ============================================================ */

export const customer = pgTable(
  'customer',
  {
    id: varchar('id', { length: 36 }).primaryKey().notNull(),
    tenantId: varchar('tenant_id', { length: 36 }).notNull(),
    name: varchar('name', { length: 255 }).notNull(),
    type: varchar('type', { length: 16 }).notNull().default('corp'),
    enterpriseId: varchar('enterprise_id', { length: 36 }),
    managerId: varchar('manager_id', { length: 36 }),
    orgUnitId: varchar('org_unit_id', { length: 36 }),
    level: varchar('level', { length: 16 }),
    status: varchar('status', { length: 16 }).notNull().default('active'),
    profile: jsonb('profile').$type<Record<string, unknown>>().notNull().default({}),
    tags: jsonb('tags').$type<string[]>().notNull().default([]),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (t) => [index('customer_manager_idx').on(t.tenantId, t.managerId)],
);

export const customerContact = pgTable(
  'customer_contact',
  {
    id: varchar('id', { length: 36 }).primaryKey().notNull(),
    tenantId: varchar('tenant_id', { length: 36 }).notNull(),
    customerId: varchar('customer_id', { length: 36 }).notNull(),
    name: varchar('name', { length: 64 }).notNull(),
    title: varchar('title', { length: 64 }),
    mobileEnc: text('mobile_enc'),
    email: varchar('email', { length: 128 }),
    decisionRole: varchar('decision_role', { length: 16 }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index('customer_contact_customer_idx').on(t.customerId)],
);

export const opportunity = pgTable(
  'opportunity',
  {
    id: varchar('id', { length: 36 }).primaryKey().notNull(),
    tenantId: varchar('tenant_id', { length: 36 }).notNull(),
    customerId: varchar('customer_id', { length: 36 }).notNull(),
    title: varchar('title', { length: 255 }).notNull(),
    stage: varchar('stage', { length: 24 }).notNull().default('initial'),
    amount: integer('amount'),
    probability: integer('probability'),
    expectedCloseAt: timestamp('expected_close_at', { withTimezone: true }),
    ownerId: varchar('owner_id', { length: 36 }),
    aiRunId: varchar('ai_run_id', { length: 36 }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index('opportunity_customer_idx').on(t.customerId)],
);

export const visitRecord = pgTable(
  'visit_record',
  {
    id: varchar('id', { length: 36 }).primaryKey().notNull(),
    tenantId: varchar('tenant_id', { length: 36 }).notNull(),
    customerId: varchar('customer_id', { length: 36 }).notNull(),
    userId: varchar('user_id', { length: 36 }).notNull(),
    visitedAt: timestamp('visited_at', { withTimezone: true }).notNull(),
    purpose: varchar('purpose', { length: 255 }),
    summary: text('summary'),
    nextAction: varchar('next_action', { length: 512 }),
    docId: varchar('doc_id', { length: 36 }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index('visit_record_customer_idx').on(t.customerId, t.visitedAt)],
);

/* ============================================================
 * 11. 营销域
 * ============================================================ */

export const segment = pgTable(
  'segment',
  {
    id: varchar('id', { length: 36 }).primaryKey().notNull(),
    tenantId: varchar('tenant_id', { length: 36 }).notNull(),
    name: varchar('name', { length: 128 }).notNull(),
    definition: jsonb('definition').$type<Record<string, unknown>>().notNull(),
    sizeEstimate: integer('size_estimate'),
    createdBy: varchar('created_by', { length: 36 }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
);

export const campaign = pgTable(
  'campaign',
  {
    id: varchar('id', { length: 36 }).primaryKey().notNull(),
    tenantId: varchar('tenant_id', { length: 36 }).notNull(),
    name: varchar('name', { length: 255 }).notNull(),
    segmentId: varchar('segment_id', { length: 36 }),
    objective: varchar('objective', { length: 255 }),
    channel: varchar('channel', { length: 64 }),
    startAt: timestamp('start_at', { withTimezone: true }),
    endAt: timestamp('end_at', { withTimezone: true }),
    status: varchar('status', { length: 16 }).notNull().default('draft'),
    budget: integer('budget'),
    ownerId: varchar('owner_id', { length: 36 }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index('campaign_status_idx').on(t.tenantId, t.status)],
);

export const campaignMetric = pgTable(
  'campaign_metric',
  {
    id: varchar('id', { length: 36 }).primaryKey().notNull(),
    tenantId: varchar('tenant_id', { length: 36 }).notNull(),
    campaignId: varchar('campaign_id', { length: 36 }).notNull(),
    metric: varchar('metric', { length: 48 }).notNull(),
    value: integer('value').notNull(),
    capturedAt: timestamp('captured_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index('campaign_metric_campaign_idx').on(t.campaignId)],
);

/* ============================================================
 * 12. 风险域
 * ============================================================ */

export const riskRule = pgTable(
  'risk_rule',
  {
    id: varchar('id', { length: 36 }).primaryKey().notNull(),
    tenantId: varchar('tenant_id', { length: 36 }).notNull(),
    code: varchar('code', { length: 64 }).notNull(),
    name: varchar('name', { length: 128 }).notNull(),
    scope: varchar('scope', { length: 32 }).notNull(),
    condition: jsonb('condition').$type<Record<string, unknown>>().notNull(),
    severity: varchar('severity', { length: 16 }).notNull().default('medium'),
    action: varchar('action', { length: 32 }).notNull().default('notify'),
    enabled: boolean('enabled').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [uniqueIndex('risk_rule_uk').on(t.tenantId, t.code)],
);

export const riskAlert = pgTable(
  'risk_alert',
  {
    id: varchar('id', { length: 36 }).primaryKey().notNull(),
    tenantId: varchar('tenant_id', { length: 36 }).notNull(),
    ruleId: varchar('rule_id', { length: 36 }),
    resourceType: varchar('resource_type', { length: 48 }).notNull(),
    resourceId: varchar('resource_id', { length: 36 }).notNull(),
    severity: varchar('severity', { length: 16 }).notNull().default('medium'),
    title: varchar('title', { length: 255 }).notNull(),
    detail: jsonb('detail').$type<Record<string, unknown>>().notNull().default({}),
    status: varchar('status', { length: 16 }).notNull().default('open'),
    assigneeId: varchar('assignee_id', { length: 36 }),
    resolvedAt: timestamp('resolved_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index('risk_alert_status_idx').on(t.tenantId, t.status, t.severity, t.createdAt)],
);

/* ============================================================
 * 13. 分析域：指标 / 看板
 * ============================================================ */

export const metricDefinition = pgTable(
  'metric_definition',
  {
    id: varchar('id', { length: 36 }).primaryKey().notNull(),
    tenantId: varchar('tenant_id', { length: 36 }).notNull(),
    code: varchar('code', { length: 64 }).notNull(),
    name: varchar('name', { length: 128 }).notNull(),
    domain: varchar('domain', { length: 48 }).notNull(),
    unit: varchar('unit', { length: 16 }),
    formula: text('formula'),
    source: varchar('source', { length: 128 }),
    dimensions: jsonb('dimensions').$type<unknown[]>().notNull().default([]),
    ownerId: varchar('owner_id', { length: 36 }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [uniqueIndex('metric_definition_uk').on(t.tenantId, t.code)],
);

export const metricSnapshot = pgTable(
  'metric_snapshot',
  {
    id: varchar('id', { length: 36 }).primaryKey().notNull(),
    tenantId: varchar('tenant_id', { length: 36 }).notNull(),
    metricCode: varchar('metric_code', { length: 64 }).notNull(),
    period: varchar('period', { length: 16 }).notNull(),
    dimensionValues: jsonb('dimension_values').$type<Record<string, unknown>>().notNull().default({}),
    value: integer('value').notNull(),
    capturedAt: timestamp('captured_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index('metric_snapshot_idx').on(t.tenantId, t.metricCode, t.period)],
);

export const dashboard = pgTable(
  'dashboard',
  {
    id: varchar('id', { length: 36 }).primaryKey().notNull(),
    tenantId: varchar('tenant_id', { length: 36 }).notNull(),
    code: varchar('code', { length: 64 }).notNull(),
    name: varchar('name', { length: 128 }).notNull(),
    type: varchar('type', { length: 16 }).notNull().default('personal'),
    layout: jsonb('layout').$type<unknown[]>().notNull().default([]),
    ownerId: varchar('owner_id', { length: 36 }),
    visibility: varchar('visibility', { length: 16 }).notNull().default('private'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [uniqueIndex('dashboard_uk').on(t.tenantId, t.code)],
);

export const dashboardWidget = pgTable(
  'dashboard_widget',
  {
    id: varchar('id', { length: 36 }).primaryKey().notNull(),
    tenantId: varchar('tenant_id', { length: 36 }).notNull(),
    dashboardId: varchar('dashboard_id', { length: 36 }).notNull(),
    widgetType: varchar('widget_type', { length: 32 }).notNull(),
    title: varchar('title', { length: 128 }).notNull(),
    config: jsonb('config').$type<Record<string, unknown>>().notNull().default({}),
    sort: integer('sort').notNull().default(0),
  },
  (t) => [index('dashboard_widget_dashboard_idx').on(t.dashboardId)],
);

/* ============================================================
 * 14. 事件 Outbox
 * ============================================================ */

export const eventOutbox = pgTable(
  'event_outbox',
  {
    id: serial('id').primaryKey().notNull(),
    tenantId: varchar('tenant_id', { length: 36 }).notNull(),
    eventType: varchar('event_type', { length: 96 }).notNull(),
    payload: jsonb('payload').$type<Record<string, unknown>>().notNull().default({}),
    status: varchar('status', { length: 16 }).notNull().default('pending'),
    attempts: integer('attempts').notNull().default(0),
    availableAt: timestamp('available_at', { withTimezone: true }).defaultNow().notNull(),
    processedAt: timestamp('processed_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index('event_outbox_pending_idx').on(t.status, t.availableAt)],
);
/* ============================================================
 * 15. AI 增量域：Plans / Confirmations / Tool Registry
 * ============================================================ */

export const aiPlans = pgTable(
  'ai_plans',
  {
    id: varchar('id', { length: 36 }).primaryKey().notNull(),
    tenantId: varchar('tenant_id', { length: 36 }).notNull(),
    runId: varchar('run_id', { length: 36 }),
    agentCode: varchar('agent_code', { length: 64 }).notNull(),
    userGoal: text('user_goal').notNull(),
    complexity: varchar('complexity', { length: 4 }).notNull().default('L1'),
    status: varchar('status', { length: 24 }).notNull().default('draft'),
    version: integer('version').notNull().default(1),
    maxTokens: integer('max_tokens'),
    maxToolCalls: integer('max_tool_calls'),
    maxSteps: integer('max_steps'),
    timeoutSeconds: integer('timeout_seconds'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index('idx_plans_run').on(t.runId),
    index('idx_plans_status').on(t.tenantId, t.status),
  ],
);

export const aiPlanSteps = pgTable(
  'ai_plan_steps',
  {
    id: varchar('id', { length: 36 }).primaryKey().notNull(),
    planId: varchar('plan_id', { length: 36 }).notNull(),
    seq: integer('seq').notNull(),
    stepType: varchar('step_type', { length: 24 }).notNull(),
    description: text('description').notNull(),
    agentCode: varchar('agent_code', { length: 64 }),
    toolCode: varchar('tool_code', { length: 96 }),
    toolParams: jsonb('tool_params').$type<Record<string, unknown>>(),
    dependencies: jsonb('dependencies').$type<string[]>(),
    permissionRequired: jsonb('permission_required').$type<string[]>(),
    riskLevel: varchar('risk_level', { length: 8 }).notNull().default('L0'),
    retryPolicy: jsonb('retry_policy').$type<Record<string, unknown>>(),
    status: varchar('status', { length: 16 }).notNull().default('pending'),
  },
  (t) => [index('idx_steps_plan').on(t.planId, t.seq)],
);

export const aiConfirmations = pgTable(
  'ai_confirmations',
  {
    id: varchar('id', { length: 36 }).primaryKey().notNull(),
    tenantId: varchar('tenant_id', { length: 36 }).notNull(),
    runId: varchar('run_id', { length: 36 }).notNull(),
    stepId: varchar('step_id', { length: 36 }),
    type: varchar('type', { length: 32 }).notNull(),
    payload: jsonb('payload').$type<Record<string, unknown>>().notNull().default({}),
    idempotencyKey: varchar('idempotency_key', { length: 128 }).notNull(),
    status: varchar('status', { length: 20 }).notNull().default('pending'),
    userId: varchar('user_id', { length: 36 }).notNull(),
    responseAction: varchar('response_action', { length: 16 }),
    responsePayload: jsonb('response_payload').$type<Record<string, unknown>>(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    respondedAt: timestamp('responded_at', { withTimezone: true }),
    expiresAt: timestamp('expires_at', { withTimezone: true }),
  },
  (t) => [
    index('idx_conf_run').on(t.runId),
    uniqueIndex('idx_conf_idempotency').on(t.tenantId, t.idempotencyKey),
    index('idx_conf_status').on(t.tenantId, t.status, t.expiresAt),
  ],
);

export const toolRegistry = pgTable(
  'tool_registry',
  {
    id: varchar('id', { length: 36 }).primaryKey().notNull(),
    tenantId: varchar('tenant_id', { length: 36 }).notNull(),
    code: varchar('code', { length: 96 }).notNull(),
    name: varchar('name', { length: 128 }).notNull(),
    category: varchar('category', { length: 32 }).notNull(),
    description: text('description'),
    inputSchema: jsonb('input_schema').$type<Record<string, unknown>>(),
    outputSchema: jsonb('output_schema').$type<Record<string, unknown>>(),
    executionType: varchar('execution_type', { length: 16 }).notNull().default('local'),
    endpoint: varchar('endpoint', { length: 512 }),
    approvalPolicy: jsonb('approval_policy').$type<Record<string, unknown>>().notNull().default({}),
    rateLimit: jsonb('rate_limit').$type<Record<string, unknown>>().notNull().default({}),
    retryPolicy: jsonb('retry_policy').$type<Record<string, unknown>>().notNull().default({}),
    timeoutMs: integer('timeout_ms'),
    status: varchar('status', { length: 16 }).notNull().default('active'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex('idx_tool_code').on(t.tenantId, t.code),
    index('idx_tool_category').on(t.tenantId, t.category),
  ],
);

/* ============================================================
 * 16. 协作增量域：Participants / Workstreams / Decisions / Conflicts / Context / Deliverables / Templates
 * ============================================================ */

export const collaborationParticipants = pgTable(
  'collaboration_participants',
  {
    id: varchar('id', { length: 36 }).primaryKey().notNull(),
    tenantId: varchar('tenant_id', { length: 36 }).notNull(),
    collaborationId: varchar('collaboration_id', { length: 36 }).notNull(),
    participantType: varchar('participant_type', { length: 16 }).notNull(),
    nativeEntityId: varchar('native_entity_id', { length: 36 }).notNull(),
    role: varchar('role', { length: 24 }).notNull().default('member'),
    permissions: jsonb('permissions').$type<string[]>().notNull().default([]),
    status: varchar('status', { length: 16 }).notNull().default('invited'),
    joinedAt: timestamp('joined_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index('idx_part_collab').on(t.collaborationId),
    index('idx_part_native').on(t.participantType, t.nativeEntityId),
  ],
);

export const collaborationWorkstreams = pgTable(
  'collaboration_workstreams',
  {
    id: varchar('id', { length: 36 }).primaryKey().notNull(),
    tenantId: varchar('tenant_id', { length: 36 }).notNull(),
    collaborationId: varchar('collaboration_id', { length: 36 }).notNull(),
    name: varchar('name', { length: 128 }).notNull(),
    phase: varchar('phase', { length: 32 }),
    objectives: jsonb('objectives').$type<string[]>().notNull().default([]),
    milestone: jsonb('milestone').$type<Record<string, unknown>>(),
    dependencies: jsonb('dependencies').$type<string[]>(),
    status: varchar('status', { length: 16 }).notNull().default('planning'),
    progress: integer('progress').notNull().default(0),
    dynamicAdjustment: jsonb('dynamic_adjustment').$type<Record<string, unknown>>(),
  },
  (t) => [index('idx_ws_collab').on(t.collaborationId, t.phase)],
);

export const collaborationDecisions = pgTable(
  'collaboration_decisions',
  {
    id: varchar('id', { length: 36 }).primaryKey().notNull(),
    tenantId: varchar('tenant_id', { length: 36 }).notNull(),
    collaborationId: varchar('collaboration_id', { length: 36 }).notNull(),
    type: varchar('type', { length: 32 }).notNull(),
    title: varchar('title', { length: 255 }).notNull(),
    description: text('description'),
    options: jsonb('options').$type<unknown[]>().notNull().default([]),
    selectedOption: varchar('selected_option', { length: 64 }),
    aiAnalysis: jsonb('ai_analysis').$type<Record<string, unknown>>(),
    status: varchar('status', { length: 16 }).notNull().default('pending'),
    requiredApprovers: jsonb('required_approvers').$type<string[]>(),
    deadline: timestamp('deadline', { withTimezone: true }),
    resolvedAt: timestamp('resolved_at', { withTimezone: true }),
  },
  (t) => [index('idx_dec_collab').on(t.collaborationId, t.status)],
);

export const collaborationConflicts = pgTable(
  'collaboration_conflicts',
  {
    id: varchar('id', { length: 36 }).primaryKey().notNull(),
    tenantId: varchar('tenant_id', { length: 36 }).notNull(),
    collaborationId: varchar('collaboration_id', { length: 36 }).notNull(),
    type: varchar('type', { length: 32 }).notNull(),
    description: text('description').notNull(),
    contextIds: jsonb('context_ids').$type<string[]>(),
    severity: varchar('severity', { length: 16 }).notNull().default('medium'),
    status: varchar('status', { length: 16 }).notNull().default('open'),
    resolution: text('resolution'),
    resolvedBy: varchar('resolved_by', { length: 36 }),
    resolvedAt: timestamp('resolved_at', { withTimezone: true }),
  },
  (t) => [index('idx_conf_collab').on(t.collaborationId, t.severity, t.status)],
);

export const collaborationContext = pgTable(
  'collaboration_context',
  {
    id: varchar('id', { length: 36 }).primaryKey().notNull(),
    tenantId: varchar('tenant_id', { length: 36 }).notNull(),
    collaborationId: varchar('collaboration_id', { length: 36 }).notNull(),
    contextType: varchar('context_type', { length: 24 }).notNull(),
    content: text('content').notNull(),
    confidence: varchar('confidence', { length: 16 }).notNull().default('medium'),
    source: varchar('source', { length: 128 }),
    sensitivity: varchar('sensitivity', { length: 16 }).notNull().default('internal'),
    createdBy: varchar('created_by', { length: 36 }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index('idx_ctx_collab_type').on(t.collaborationId, t.contextType)],
);

export const collaborationDeliverables = pgTable(
  'collaboration_deliverables',
  {
    id: varchar('id', { length: 36 }).primaryKey().notNull(),
    tenantId: varchar('tenant_id', { length: 36 }).notNull(),
    collaborationId: varchar('collaboration_id', { length: 36 }).notNull(),
    title: varchar('title', { length: 255 }).notNull(),
    type: varchar('type', { length: 32 }).notNull(),
    content: text('content'),
    sourceWorkstreamId: varchar('source_workstream_id', { length: 36 }),
    sourceTaskIds: jsonb('source_task_ids').$type<string[]>(),
    traceability: jsonb('traceability').$type<Record<string, unknown>>(),
    status: varchar('status', { length: 16 }).notNull().default('draft'),
    submittedAt: timestamp('submitted_at', { withTimezone: true }),
    approvedAt: timestamp('approved_at', { withTimezone: true }),
    deliveredAt: timestamp('delivered_at', { withTimezone: true }),
  },
  (t) => [index('idx_del_collab').on(t.collaborationId, t.status)],
);

export const collaborationTemplates = pgTable(
  'collaboration_templates',
  {
    id: varchar('id', { length: 36 }).primaryKey().notNull(),
    tenantId: varchar('tenant_id', { length: 36 }).notNull(),
    name: varchar('name', { length: 128 }).notNull(),
    description: text('description'),
    collaborationType: varchar('collaboration_type', { length: 24 }).notNull(),
    structureType: varchar('structure_type', { length: 24 }).notNull().default('flat'),
    participantTemplate: jsonb('participant_template').$type<unknown[]>().notNull().default([]),
    workstreamTemplate: jsonb('workstream_template').$type<unknown[]>().notNull().default([]),
    ruleTemplate: jsonb('rule_template').$type<Record<string, unknown>>().notNull().default({}),
    sourceCollaborationId: varchar('source_collaboration_id', { length: 36 }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index('idx_tpl_type').on(t.tenantId, t.collaborationType)],
);
/* ============================================================
 * 13. 企业洞察增强域
 * ============================================================ */

export const bankProduct = pgTable(
  'bank_product',
  {
    id: varchar('id', { length: 36 }).primaryKey().notNull(),
    tenantId: varchar('tenant_id', { length: 36 }).notNull(),
    name: varchar('name', { length: 128 }).notNull(),
    category: varchar('category', { length: 32 }).notNull(),
    description: text('description'),
    targetIndustry: jsonb('target_industry').$type<string[]>().notNull().default([]),
    minAmount: integer('min_amount'),
    maxAmount: integer('max_amount'),
    rateRange: varchar('rate_range', { length: 64 }),
    termRange: varchar('term_range', { length: 64 }),
    status: varchar('status', { length: 16 }).notNull().default('active'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index('idx_bank_product_tenant').on(t.tenantId, t.category)],
);

export const serviceMatchResult = pgTable(
  'service_match_result',
  {
    id: varchar('id', { length: 36 }).primaryKey().notNull(),
    tenantId: varchar('tenant_id', { length: 36 }).notNull(),
    enterpriseId: varchar('enterprise_id', { length: 36 }).notNull(),
    analysisId: varchar('analysis_id', { length: 36 }),
    productId: varchar('product_id', { length: 36 }).notNull(),
    matchReason: text('match_reason').notNull(),
    matchScore: integer('match_score').notNull(),
    priority: varchar('priority', { length: 16 }).notNull().default('medium'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index('idx_service_match_ent').on(t.tenantId, t.enterpriseId, t.createdAt)],
);

export const researchProject = pgTable(
  'research_project',
  {
    id: varchar('id', { length: 36 }).primaryKey().notNull(),
    tenantId: varchar('tenant_id', { length: 36 }).notNull(),
    name: varchar('name', { length: 255 }).notNull(),
    type: varchar('type', { length: 24 }).notNull().default('industry'),
    objective: text('objective'),
    status: varchar('status', { length: 16 }).notNull().default('draft'),
    plannedCompletionAt: timestamp('planned_completion_at', { withTimezone: true }),
    industryId: varchar('industry_id', { length: 36 }),
    createdBy: varchar('created_by', { length: 36 }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (t) => [index('idx_research_project_status').on(t.tenantId, t.status, t.type)],
);

export const opportunityStageHistory = pgTable(
  'opportunity_stage_history',
  {
    id: varchar('id', { length: 36 }).primaryKey().notNull(),
    tenantId: varchar('tenant_id', { length: 36 }).notNull(),
    opportunityId: varchar('opportunity_id', { length: 36 }).notNull(),
    fromStage: varchar('from_stage', { length: 24 }).notNull(),
    toStage: varchar('to_stage', { length: 24 }).notNull(),
    transitionReason: text('transition_reason'),
    lostReason: text('lost_reason'),
    transitionedBy: varchar('transitioned_by', { length: 36 }).notNull(),
    transitionedAt: timestamp('transitioned_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index('idx_opp_stage_history').on(t.tenantId, t.opportunityId, t.transitionedAt)],
);

export const collaborationCoordinatorLog = pgTable(
  'collaboration_coordinator_log',
  {
    id: varchar('id', { length: 36 }).primaryKey().notNull(),
    tenantId: varchar('tenant_id', { length: 36 }).notNull(),
    collaborationId: varchar('collaboration_id', { length: 36 }).notNull(),
    status: varchar('status', { length: 16 }).notNull().default('running'),
    logSummary: text('log_summary'),
    aiSuggestions: jsonb('ai_suggestions').$type<unknown[]>().notNull().default([]),
    startedAt: timestamp('started_at', { withTimezone: true }).defaultNow().notNull(),
    finishedAt: timestamp('finished_at', { withTimezone: true }),
  },
  (t) => [index('idx_coord_log_collab').on(t.collaborationId, t.startedAt)],
);

export const killSwitchRecord = pgTable(
  'kill_switch_record',
  {
    id: varchar('id', { length: 36 }).primaryKey().notNull(),
    tenantId: varchar('tenant_id', { length: 36 }).notNull(),
    collaborationId: varchar('collaboration_id', { length: 36 }).notNull(),
    action: varchar('action', { length: 48 }).notNull(),
    reason: text('reason'),
    scope: varchar('scope', { length: 32 }).notNull().default('collaboration'),
    executedBy: varchar('executed_by', { length: 36 }).notNull(),
    executedAt: timestamp('executed_at', { withTimezone: true }).defaultNow().notNull(),
    recoverable: boolean('recoverable').notNull().default(true),
    recovered: boolean('recovered').notNull().default(false),
    recoveredAt: timestamp('recovered_at', { withTimezone: true }),
  },
  (t) => [index('idx_kill_switch_collab').on(t.collaborationId, t.executedAt)],
);
