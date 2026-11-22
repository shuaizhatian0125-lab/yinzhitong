import { getSupabaseClient } from '@/storage/database/supabase-client';
import { createNotification } from '@/server/platform/notification/service';

export type RiskAlertType =
  | 'task_overdue'
  | 'work_anomaly'
  | 'enterprise_risk'
  | 'industry_risk'
  | 'info_change';

export type RiskSeverity = 'low' | 'medium' | 'high' | 'critical';

export type RiskAlertStatus = 'open' | 'acknowledged' | 'resolved' | 'false_positive';

export type RiskAlertRow = {
  id: string;
  tenant_id: string;
  rule_id: string | null;
  resource_type: string;
  resource_id: string;
  severity: string;
  title: string;
  detail: Record<string, unknown>;
  status: string;
  assignee_id: string | null;
  resolved_at: string | null;
  created_at: string;
};

export type RiskAlertFilter = {
  type?: RiskAlertType;
  severity?: RiskSeverity;
  status?: RiskAlertStatus;
  assigneeId?: string;
  page?: number;
  pageSize?: number;
};

export type RiskAlertDetail = RiskAlertRow & {
  evidence: Array<Record<string, unknown>>;
  suggestion: string;
  handler: string | null;
  resolutionLog: Array<Record<string, unknown>>;
};

const ALERT_TYPE_LABEL: Record<string, string> = {
  task_overdue: '任务逾期',
  work_anomaly: '工作异常',
  enterprise_risk: '企业风险',
  industry_risk: '行业风险',
  info_change: '信息变更',
};

const SEVERITY_LABEL: Record<string, string> = {
  low: '低',
  medium: '中',
  high: '高',
  critical: '严重',
};

export function getAlertTypeLabel(type: string): string {
  return ALERT_TYPE_LABEL[type] ?? type;
}

export function getSeverityLabel(severity: string): string {
  return SEVERITY_LABEL[severity] ?? severity;
}

export async function listAlerts(
  tenantId: string,
  filter: RiskAlertFilter,
): Promise<{ items: RiskAlertRow[]; total: number }> {
  const db = getSupabaseClient();
  const page = filter.page ?? 1;
  const pageSize = filter.pageSize ?? 20;
  const offset = (page - 1) * pageSize;

  let query = db
    .from('risk_alert')
    .select('*', { count: 'exact' })
    .eq('tenant_id', tenantId);

  if (filter.status) {
    query = query.eq('status', filter.status);
  }
  if (filter.severity) {
    query = query.eq('severity', filter.severity);
  }
  if (filter.assigneeId) {
    query = query.eq('assignee_id', filter.assigneeId);
  }
  if (filter.type) {
    query = query.eq('resource_type', filter.type);
  }

  query = query.order('created_at', { ascending: false }).range(offset, offset + pageSize - 1);

  const { data, count } = await query;

  return {
    items: (data ?? []) as RiskAlertRow[],
    total: count ?? 0,
  };
}

export async function getAlert(
  tenantId: string,
  alertId: string,
): Promise<RiskAlertDetail | null> {
  const db = getSupabaseClient();

  const { data } = await db
    .from('risk_alert')
    .select('*')
    .eq('id', alertId)
    .eq('tenant_id', tenantId)
    .limit(1);

  const row = (data?.[0] as RiskAlertRow | undefined) ?? null;
  if (!row) return null;

  const detail = row.detail ?? {};
  return {
    ...row,
    evidence: (detail['evidence'] as Array<Record<string, unknown>>) ?? [],
    suggestion: (detail['suggestion'] as string) ?? '',
    handler: (detail['handler'] as string) ?? null,
    resolutionLog: (detail['resolutionLog'] as Array<Record<string, unknown>>) ?? [],
  };
}

export async function ackAlert(
  tenantId: string,
  alertId: string,
  userId: string,
): Promise<RiskAlertRow | null> {
  const db = getSupabaseClient();

  const { data: existing } = await db
    .from('risk_alert')
    .select('*')
    .eq('id', alertId)
    .eq('tenant_id', tenantId)
    .eq('status', 'open')
    .limit(1);

  const alert = existing?.[0] as RiskAlertRow | undefined;
  if (!alert) {
    throw new Error('预警不存在或已被认领');
  }

  const detail = alert.detail ?? {};
  const updatedDetail = {
    ...detail,
    handler: userId,
    acknowledgedAt: new Date().toISOString(),
  };

  const { data, error } = await db
    .from('risk_alert')
    .update({
      status: 'acknowledged',
      assignee_id: userId,
      detail: updatedDetail,
    })
    .eq('id', alertId)
    .eq('tenant_id', tenantId)
    .select('*')
    .limit(1);

  if (error || !data?.[0]) {
    throw new Error(`认领预警失败: ${error?.message ?? '未知错误'}`);
  }

  return data[0] as RiskAlertRow;
}

export async function resolveAlert(
  tenantId: string,
  alertId: string,
  resolution: string,
  userId: string,
): Promise<RiskAlertRow | null> {
  const db = getSupabaseClient();

  const { data: existing } = await db
    .from('risk_alert')
    .select('*')
    .eq('id', alertId)
    .eq('tenant_id', tenantId)
    .limit(1);

  const alert = existing?.[0] as RiskAlertRow | undefined;
  if (!alert) {
    throw new Error('预警不存在');
  }

  const detail = alert.detail ?? {};
  const resolutionLog = (detail['resolutionLog'] as Array<Record<string, unknown>>) ?? [];
  const updatedDetail = {
    ...detail,
    resolutionLog: [
      ...resolutionLog,
      {
        action: 'resolved',
        by: userId,
        resolution,
        at: new Date().toISOString(),
      },
    ],
  };

  const now = new Date().toISOString();

  const { data, error } = await db
    .from('risk_alert')
    .update({
      status: 'resolved',
      resolved_at: now,
      detail: updatedDetail,
    })
    .eq('id', alertId)
    .eq('tenant_id', tenantId)
    .select('*')
    .limit(1);

  if (error || !data?.[0]) {
    throw new Error(`处置预警失败: ${error?.message ?? '未知错误'}`);
  }

  return data[0] as RiskAlertRow;
}

export async function markFalsePositive(
  tenantId: string,
  alertId: string,
  reason: string,
  userId: string,
): Promise<RiskAlertRow | null> {
  const db = getSupabaseClient();

  const { data: existing } = await db
    .from('risk_alert')
    .select('*')
    .eq('id', alertId)
    .eq('tenant_id', tenantId)
    .limit(1);

  const alert = existing?.[0] as RiskAlertRow | undefined;
  if (!alert) {
    throw new Error('预警不存在');
  }

  const detail = alert.detail ?? {};
  const resolutionLog = (detail['resolutionLog'] as Array<Record<string, unknown>>) ?? [];
  const updatedDetail = {
    ...detail,
    resolutionLog: [
      ...resolutionLog,
      {
        action: 'false_positive',
        by: userId,
        reason,
        at: new Date().toISOString(),
      },
    ],
  };

  const now = new Date().toISOString();

  const { data, error } = await db
    .from('risk_alert')
    .update({
      status: 'false_positive',
      resolved_at: now,
      detail: updatedDetail,
    })
    .eq('id', alertId)
    .eq('tenant_id', tenantId)
    .select('*')
    .limit(1);

  if (error || !data?.[0]) {
    throw new Error(`标记误报失败: ${error?.message ?? '未知错误'}`);
  }

  return data[0] as RiskAlertRow;
}

export async function createAlert(
  tenantId: string,
  input: {
    ruleId?: string;
    resourceType: RiskAlertType;
    resourceId: string;
    severity: RiskSeverity;
    title: string;
    detail?: Record<string, unknown>;
  },
): Promise<RiskAlertRow | null> {
  const db = getSupabaseClient();
  const id = crypto.randomUUID();
  const now = new Date().toISOString();

  const { data, error } = await db
    .from('risk_alert')
    .insert({
      id,
      tenant_id: tenantId,
      rule_id: input.ruleId ?? null,
      resource_type: input.resourceType,
      resource_id: input.resourceId,
      severity: input.severity,
      title: input.title,
      detail: input.detail ?? {},
      status: 'open',
      created_at: now,
    })
    .select('*')
    .limit(1);

  if (error || !data?.[0]) return null;

  const alert = data[0] as RiskAlertRow;

  return alert;
}