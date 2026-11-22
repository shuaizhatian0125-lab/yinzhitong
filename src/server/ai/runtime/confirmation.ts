import { getSupabaseClient } from '@/storage/database/supabase-client';
import type { SessionUser } from '@/lib/auth';

/* ============================================================
 * 类型定义
 * ============================================================ */

export type ConfirmationType =
  | 'INPUT_REQUIRED'
  | 'PLAN_CONFIRMATION'
  | 'TOOL_CONFIRMATION'
  | 'DATA_CONFIRMATION'
  | 'APPROVAL_REQUIRED'
  | 'RESULT_REVIEW'
  | 'PUBLISH_CONFIRMATION'
  | 'HIGH_RISK_CONFIRMATION';

export type ConfirmationStatus =
  | 'PENDING'
  | 'CONFIRMED'
  | 'REJECTED'
  | 'EXPIRED'
  | 'CANCELLED'
  | 'EXECUTED'
  | 'EXECUTION_FAILED';

export type AutonomyLevel = 'A0' | 'A1' | 'A2' | 'A3' | 'A4';

export type Confirmation = {
  id: string;
  tenantId: string;
  runId: string;
  stepId?: string;
  type: ConfirmationType;
  payload: Record<string, unknown>;
  idempotencyKey: string;
  status: ConfirmationStatus;
  userId: string;
  responseAction?: string;
  responsePayload?: Record<string, unknown>;
  createdAt: string;
  respondedAt?: string;
  expiresAt?: string;
};

export type ConfirmationRequest = {
  runId: string;
  type: ConfirmationType;
  payload: ConfirmationPayload;
  userId: string;
  tenantId: string;
  stepId?: string;
  autonomyLevel?: AutonomyLevel;
  expiresInSeconds?: number;
};

export type ConfirmationPayload = {
  whatWillExecute: string;
  whatDataUsed: string;
  whatObjectsAffected: string;
  hasExternalImpact: boolean;
  isReversible: boolean;
  expectedResult: string;
  riskLevel: string;
  whoExecutes: string;
  permissionSource: string;
};

export type ConfirmationResponse = {
  action: 'confirm' | 'reject' | 'modify';
  modifications?: Record<string, unknown>;
};

/* ============================================================
 * 常量定义
 * ============================================================ */

const DEFAULT_EXPIRY_SECONDS = 300;
const MAX_EXPIRY_SECONDS = 3600;

const AUTONOMY_LEVEL_CONFIG: Record<AutonomyLevel, {
  description: string;
  confirmationRequired: boolean;
  confirmationType?: ConfirmationType;
}> = {
  A0: { description: '全自主', confirmationRequired: false },
  A1: { description: '低风险自主', confirmationRequired: false },
  A2: { description: '中风险确认', confirmationRequired: true, confirmationType: 'TOOL_CONFIRMATION' },
  A3: { description: '高风险确认', confirmationRequired: true, confirmationType: 'PLAN_CONFIRMATION' },
  A4: { description: '极高风险确认', confirmationRequired: true, confirmationType: 'HIGH_RISK_CONFIRMATION' },
};

const CONFIRMATION_TYPE_TRIGGER: Record<ConfirmationType, string> = {
  INPUT_REQUIRED: 'L2+需用户补充信息',
  PLAN_CONFIRMATION: 'L3/L4计划执行前',
  TOOL_CONFIRMATION: 'L2+风险工具执行前',
  DATA_CONFIRMATION: '涉及数据修改/删除',
  APPROVAL_REQUIRED: 'L3+需审批流程',
  RESULT_REVIEW: 'L3+结果需人工审核',
  PUBLISH_CONFIRMATION: '对外发布/通知前',
  HIGH_RISK_CONFIRMATION: 'L4+极高风险操作',
};

const MANDATORY_CONFIRMATION_SCENARIOS = [
  '数据删除操作',
  '对外发布内容',
  '跨租户数据访问',
  '系统配置修改',
  '审批流程绕过',
  '权限提升请求',
  '高风险工具调用',
  '不可逆操作',
  '外部API调用',
  '批量数据修改',
];

/* ============================================================
 * 幂等性 Key 生成
 * ============================================================ */

function generateIdempotencyKey(
  tenantId: string,
  userId: string,
  type: ConfirmationType,
  payload: Record<string, unknown>,
): string {
  const payloadStr = JSON.stringify(payload);
  const hash = simpleHash(`${tenantId}:${userId}:${type}:${payloadStr}`);
  return `conf-${hash}`;
}

function simpleHash(input: string): string {
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    const char = input.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(36);
}

/* ============================================================
 * 自主级别判断
 * ============================================================ */

export function getAutonomyLevel(
  riskLevel: string,
  toolCategory?: string,
  tenantConfig?: Record<string, AutonomyLevel>,
): AutonomyLevel {
  if (tenantConfig) {
    if (riskLevel === 'L4' && tenantConfig['L4']) return tenantConfig['L4'];
    if (riskLevel === 'L3' && tenantConfig['L3']) return tenantConfig['L3'];
    if (riskLevel === 'L2' && tenantConfig['L2']) return tenantConfig['L2'];
  }

  if (riskLevel === 'L4') return 'A4';
  if (riskLevel === 'L3') return 'A3';
  if (riskLevel === 'L2') return 'A2';
  return 'A1';
}

export function requiresConfirmation(
  autonomyLevel: AutonomyLevel,
  scenario?: string,
): boolean {
  const config = AUTONOMY_LEVEL_CONFIG[autonomyLevel];
  if (config.confirmationRequired) return true;

  if (scenario && MANDATORY_CONFIRMATION_SCENARIOS.includes(scenario)) {
    return true;
  }

  return false;
}

export function getConfirmationTypeForLevel(
  autonomyLevel: AutonomyLevel,
  scenario?: string,
): ConfirmationType {
  if (scenario === '数据删除操作' || scenario === '批量数据修改') {
    return 'DATA_CONFIRMATION';
  }
  if (scenario === '对外发布内容') {
    return 'PUBLISH_CONFIRMATION';
  }
  if (scenario === '审批流程绕过' || scenario === '审批流程') {
    return 'APPROVAL_REQUIRED';
  }

  const config = AUTONOMY_LEVEL_CONFIG[autonomyLevel];
  return config.confirmationType ?? 'TOOL_CONFIRMATION';
}

/* ============================================================
 * CRUD 函数
 * ============================================================ */

export async function createConfirmation(
  request: ConfirmationRequest,
): Promise<Confirmation> {
  const db = await getSupabaseClient();

  const idempotencyKey = generateIdempotencyKey(
    request.tenantId,
    request.userId,
    request.type,
    request.payload as Record<string, unknown>,
  );

  const { data: existing } = await db
    .from('ai_confirmations')
    .select('id,status')
    .eq('tenant_id', request.tenantId)
    .eq('idempotency_key', idempotencyKey)
    .limit(1);

  if (existing && existing.length > 0) {
    const existingStatus = existing[0].status as ConfirmationStatus;
    if (existingStatus === 'PENDING' || existingStatus === 'CONFIRMED') {
      throw new Error(`确认请求已存在 (状态: ${existingStatus})，幂等Key: ${idempotencyKey}`);
    }
  }

  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  const expiresAt = new Date(
    Date.now() + (request.expiresInSeconds ?? DEFAULT_EXPIRY_SECONDS) * 1000,
  ).toISOString();

  const { data, error } = await db
    .from('ai_confirmations')
    .insert({
      id,
      tenant_id: request.tenantId,
      run_id: request.runId,
      step_id: request.stepId ?? null,
      type: request.type,
      payload: request.payload as Record<string, unknown>,
      idempotency_key: idempotencyKey,
      status: 'PENDING',
      user_id: request.userId,
      created_at: now,
      expires_at: expiresAt,
    })
    .select('*')
    .limit(1);

  if (error || !data?.[0]) {
    throw new Error(`创建确认请求失败: ${error?.message ?? '未知错误'}`);
  }

  return mapRowToConfirmation(data[0]);
}

export async function respondConfirmation(
  confirmationId: string,
  tenantId: string,
  response: ConfirmationResponse,
): Promise<Confirmation> {
  const db = await getSupabaseClient();

  const { data: existing } = await db
    .from('ai_confirmations')
    .select('*')
    .eq('id', confirmationId)
    .eq('tenant_id', tenantId)
    .limit(1);

  if (!existing?.[0]) {
    throw new Error('确认请求不存在');
  }

  const confirmation = mapRowToConfirmation(existing[0]);

  if (confirmation.status !== 'PENDING') {
    throw new Error(`确认请求已响应 (状态: ${confirmation.status})`);
  }

  const now = new Date().toISOString();
  if (confirmation.expiresAt && new Date(confirmation.expiresAt) < new Date(now)) {
    await db.from('ai_confirmations')
      .update({ status: 'EXPIRED' })
      .eq('id', confirmationId);
    throw new Error('确认请求已过期');
  }

  let newStatus: ConfirmationStatus;
  if (response.action === 'confirm') {
    newStatus = 'CONFIRMED';
  } else if (response.action === 'reject') {
    newStatus = 'REJECTED';
  } else {
    newStatus = 'CONFIRMED';
  }

  const { data, error } = await db
    .from('ai_confirmations')
    .update({
      status: newStatus,
      response_action: response.action,
      response_payload: response.modifications ?? null,
      responded_at: now,
    })
    .eq('id', confirmationId)
    .eq('tenant_id', tenantId)
    .select('*')
    .limit(1);

  if (error || !data?.[0]) {
    throw new Error(`响应确认请求失败: ${error?.message ?? '未知错误'}`);
  }

  return mapRowToConfirmation(data[0]);
}

export async function getConfirmation(
  confirmationId: string,
  tenantId: string,
): Promise<Confirmation | null> {
  const db = await getSupabaseClient();

  const { data } = await db
    .from('ai_confirmations')
    .select('*')
    .eq('id', confirmationId)
    .eq('tenant_id', tenantId)
    .limit(1);

  if (!data?.[0]) return null;

  return mapRowToConfirmation(data[0]);
}

export async function listConfirmations(
  tenantId: string,
  filter: {
    runId?: string;
    status?: ConfirmationStatus;
    type?: ConfirmationType;
    userId?: string;
  },
): Promise<Confirmation[]> {
  const db = await getSupabaseClient();

  let query = db
    .from('ai_confirmations')
    .select('*')
    .eq('tenant_id', tenantId);

  if (filter.runId) query = query.eq('run_id', filter.runId);
  if (filter.status) query = query.eq('status', filter.status);
  if (filter.type) query = query.eq('type', filter.type);
  if (filter.userId) query = query.eq('user_id', filter.userId);

  query = query.order('created_at', { ascending: false });

  const { data } = await query;

  return (data ?? []).map(mapRowToConfirmation);
}

export async function expirePendingConfirmations(tenantId: string): Promise<number> {
  const db = await getSupabaseClient();

  const now = new Date().toISOString();

  const { data, error } = await db
    .from('ai_confirmations')
    .update({ status: 'EXPIRED' })
    .eq('tenant_id', tenantId)
    .eq('status', 'PENDING')
    .lt('expires_at', now)
    .select('id');

  if (error) return 0;

  return data?.length ?? 0;
}

export async function markAsExecuted(
  confirmationId: string,
  tenantId: string,
  success: boolean,
): Promise<Confirmation> {
  const db = await getSupabaseClient();

  const newStatus: ConfirmationStatus = success ? 'EXECUTED' : 'EXECUTION_FAILED';

  const { data, error } = await db
    .from('ai_confirmations')
    .update({ status: newStatus })
    .eq('id', confirmationId)
    .eq('tenant_id', tenantId)
    .eq('status', 'CONFIRMED')
    .select('*')
    .limit(1);

  if (error || !data?.[0]) {
    throw new Error(`标记执行状态失败: ${error?.message ?? '未知错误'}`);
  }

  return mapRowToConfirmation(data[0]);
}

/* ============================================================
 * 工具函数
 * ============================================================ */

function mapRowToConfirmation(row: Record<string, unknown>): Confirmation {
  return {
    id: row.id as string,
    tenantId: row.tenant_id as string,
    runId: row.run_id as string,
    stepId: row.step_id as string | undefined,
    type: row.type as ConfirmationType,
    payload: (row.payload as Record<string, unknown>) ?? {},
    idempotencyKey: row.idempotency_key as string,
    status: row.status as ConfirmationStatus,
    userId: row.user_id as string,
    responseAction: row.response_action as string | undefined,
    responsePayload: row.response_payload as Record<string, unknown> | undefined,
    createdAt: row.created_at as string,
    respondedAt: row.responded_at as string | undefined,
    expiresAt: row.expires_at as string | undefined,
  };
}

export function getConfirmationTypeDescription(type: ConfirmationType): string {
  return CONFIRMATION_TYPE_TRIGGER[type];
}

export function getAutonomyLevelDescription(level: AutonomyLevel): string {
  return AUTONOMY_LEVEL_CONFIG[level].description;
}

export function isMandatoryConfirmationScenario(scenario: string): boolean {
  return MANDATORY_CONFIRMATION_SCENARIOS.includes(scenario);
}