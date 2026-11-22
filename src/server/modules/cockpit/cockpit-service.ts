import { getSupabaseClient } from '@/storage/database/supabase-client';
import type { SessionUser } from '@/lib/auth';

export type DashboardDataScope = 'self' | 'department' | 'global';

export type MetricItem = {
  code: string;
  name: string;
  value: number;
  unit: string;
  trend: number;
  trendLabel: string;
  isMock: boolean;
};

export type TrendPoint = {
  period: string;
  value: number;
};

export type DepartmentTaskItem = {
  department: string;
  total: number;
  completed: number;
  overdue: number;
  completionRate: number;
};

export type RiskAlertItem = {
  id: string;
  title: string;
  severity: 'low' | 'medium' | 'high';
  resourceType: string;
  status: string;
  createdAt: string;
};

export type KeyWorkItem = {
  id: string;
  title: string;
  priority: string;
  status: string;
  owner: string;
  progress: number;
  dueAt: string | null;
};

export type AiUsageItem = {
  agentCode: string;
  agentName: string;
  runCount: number;
  successCount: number;
  avgLatencyMs: number;
  totalCost: number;
};

export type CollaborationItem = {
  id: string;
  title: string;
  type: string;
  status: string;
  memberCount: number;
};

export type WorkloadItem = {
  userId: string;
  userName: string;
  totalTasks: number;
  inProgressTasks: number;
  completedTasks: number;
  overdueTasks: number;
};

export type BusinessMetricItem = {
  code: string;
  name: string;
  value: number;
  unit: string;
  period: string;
  source: string;
  isMock: boolean;
};

export type OrgRunningItem = {
  orgUnitName: string;
  totalUsers: number;
  activeUsers: number;
  taskCompletionRate: number;
};

export type DashboardData = {
  scope: DashboardDataScope;
  scopeLabel: string;
  isMock: boolean;
  metrics: MetricItem[];
  taskTrend: TrendPoint[];
  departmentTasks: DepartmentTaskItem[];
  riskAlerts: RiskAlertItem[];
  keyWorks: KeyWorkItem[];
  aiUsage: AiUsageItem[];
  collaborations: CollaborationItem[];
  workloads: WorkloadItem[];
  businessMetrics: BusinessMetricItem[];
  orgRunning: OrgRunningItem[];
  businessTrend: TrendPoint[];
};

function resolveScope(user: SessionUser): DashboardDataScope {
  if (user.dataScope === 'global' || user.roleCode === 'president' || user.roleCode === 'admin') {
    return 'global';
  }
  if (user.dataScope === 'department' || user.roleCode === 'dept_head' || user.roleCode === 'manager') {
    return 'department';
  }
  return 'self';
}

function getScopeLabel(scope: DashboardDataScope): string {
  switch (scope) {
    case 'global':
      return '全行视角';
    case 'department':
      return '部门视角';
    case 'self':
      return '个人视角';
  }
}

function generateMockMetrics(scope: DashboardDataScope): MetricItem[] {
  const baseMetrics: Record<DashboardDataScope, MetricItem[]> = {
    global: [
      { code: 'task_total', name: '全局任务总数', value: 1286, unit: '项', trend: 8.2, trendLabel: '环比上升', isMock: true },
      { code: 'task_completion_rate', name: '任务完成率', value: 72.5, unit: '%', trend: 3.1, trendLabel: '环比上升', isMock: true },
      { code: 'task_overdue_rate', name: '任务延期率', value: 12.8, unit: '%', trend: -2.3, trendLabel: '环比下降', isMock: true },
      { code: 'ai_usage_count', name: 'AI调用次数', value: 3420, unit: '次', trend: 15.6, trendLabel: '环比上升', isMock: true },
      { code: 'risk_alert_count', name: '风险预警数', value: 23, unit: '条', trend: 4.5, trendLabel: '环比上升', isMock: true },
      { code: 'collaboration_count', name: '协同事项数', value: 48, unit: '项', trend: 6.2, trendLabel: '环比上升', isMock: true },
    ],
    department: [
      { code: 'task_total', name: '部门任务总数', value: 326, unit: '项', trend: 5.1, trendLabel: '环比上升', isMock: true },
      { code: 'task_completion_rate', name: '任务完成率', value: 68.4, unit: '%', trend: 2.0, trendLabel: '环比上升', isMock: true },
      { code: 'task_overdue_rate', name: '任务延期率', value: 15.2, unit: '%', trend: -1.5, trendLabel: '环比下降', isMock: true },
      { code: 'ai_usage_count', name: 'AI调用次数', value: 856, unit: '次', trend: 12.3, trendLabel: '环比上升', isMock: true },
      { code: 'risk_alert_count', name: '风险预警数', value: 8, unit: '条', trend: 2.0, trendLabel: '环比上升', isMock: true },
      { code: 'collaboration_count', name: '协同事项数', value: 15, unit: '项', trend: 3.5, trendLabel: '环比上升', isMock: true },
    ],
    self: [
      { code: 'task_total', name: '我的任务总数', value: 28, unit: '项', trend: 2.0, trendLabel: '环比上升', isMock: true },
      { code: 'task_completion_rate', name: '任务完成率', value: 75.0, unit: '%', trend: 5.0, trendLabel: '环比上升', isMock: true },
      { code: 'task_overdue_rate', name: '任务延期率', value: 7.1, unit: '%', trend: -3.0, trendLabel: '环比下降', isMock: true },
      { code: 'ai_usage_count', name: 'AI调用次数', value: 64, unit: '次', trend: 20.0, trendLabel: '环比上升', isMock: true },
      { code: 'risk_alert_count', name: '风险预警数', value: 2, unit: '条', trend: 0, trendLabel: '持平', isMock: true },
      { code: 'collaboration_count', name: '协同事项数', value: 3, unit: '项', trend: 1.0, trendLabel: '环比上升', isMock: true },
    ],
  };
  return baseMetrics[scope];
}

function generateMockTaskTrend(scope: DashboardDataScope): TrendPoint[] {
  const months = ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'];
  const baseValues: Record<DashboardDataScope, number[]> = {
    global: [980, 1020, 1080, 1120, 1180, 1200, 1220, 1250, 1260, 1280, 1286, 1300],
    department: [260, 280, 290, 300, 310, 315, 320, 322, 325, 326, 326, 330],
    self: [20, 22, 24, 25, 26, 27, 27, 28, 28, 28, 28, 30],
  };
  return months.map((period, i) => ({ period, value: baseValues[scope][i] }));
}

function generateMockDepartmentTasks(scope: DashboardDataScope): DepartmentTaskItem[] {
  if (scope === 'self') {
    return [];
  }
  const departments: Record<DashboardDataScope, DepartmentTaskItem[]> = {
    global: [
      { department: '公司金融部', total: 286, completed: 210, overdue: 32, completionRate: 73.4 },
      { department: '零售金融部', total: 245, completed: 180, overdue: 28, completionRate: 73.5 },
      { department: '风险管理部', total: 198, completed: 145, overdue: 22, completionRate: 73.2 },
      { department: '运营管理部', total: 176, completed: 128, overdue: 18, completionRate: 72.7 },
      { department: '信息科技部', total: 165, completed: 120, overdue: 15, completionRate: 72.7 },
      { department: '人力资源部', total: 120, completed: 88, overdue: 10, completionRate: 73.3 },
    ],
    department: [
      { department: '信贷审批组', total: 120, completed: 85, overdue: 14, completionRate: 70.8 },
      { department: '客户服务组', total: 105, completed: 78, overdue: 12, completionRate: 74.3 },
      { department: '产品创新组', total: 68, completed: 45, overdue: 8, completionRate: 66.2 },
      { department: '风险控制组', total: 33, completed: 25, overdue: 5, completionRate: 75.8 },
    ],
    self: [],
  };
  return departments[scope];
}

function generateMockRiskAlerts(scope: DashboardDataScope): RiskAlertItem[] {
  const alerts: Record<DashboardDataScope, RiskAlertItem[]> = {
    global: [
      { id: 'ra-001', title: '某企业贷款逾期风险预警', severity: 'high', resourceType: 'enterprise', status: 'open', createdAt: '2026-11-18' },
      { id: 'ra-002', title: '信贷审批流程超时预警', severity: 'medium', resourceType: 'workflow', status: 'open', createdAt: '2026-11-19' },
      { id: 'ra-003', title: '客户投诉率异常上升', severity: 'medium', resourceType: 'customer', status: 'open', createdAt: '2026-11-20' },
      { id: 'ra-004', title: '系统可用性低于阈值', severity: 'high', resourceType: 'system', status: 'resolved', createdAt: '2026-11-15' },
      { id: 'ra-005', title: '合规检查未通过项', severity: 'low', resourceType: 'compliance', status: 'open', createdAt: '2026-11-21' },
    ],
    department: [
      { id: 'ra-006', title: '部门任务延期率超标', severity: 'medium', resourceType: 'task', status: 'open', createdAt: '2026-11-19' },
      { id: 'ra-007', title: '客户回访未完成预警', severity: 'low', resourceType: 'customer', status: 'open', createdAt: '2026-11-20' },
      { id: 'ra-008', title: '审批流程超时预警', severity: 'medium', resourceType: 'workflow', status: 'open', createdAt: '2026-11-18' },
    ],
    self: [
      { id: 'ra-009', title: '个人任务延期预警', severity: 'low', resourceType: 'task', status: 'open', createdAt: '2026-11-20' },
      { id: 'ra-010', title: '待审批事项超时', severity: 'medium', resourceType: 'approval', status: 'open', createdAt: '2026-11-21' },
    ],
  };
  return alerts[scope];
}

function generateMockKeyWorks(scope: DashboardDataScope): KeyWorkItem[] {
  const works: Record<DashboardDataScope, KeyWorkItem[]> = {
    global: [
      { id: 'kw-001', title: '年度信贷投放计划执行', priority: 'P0', status: 'in_progress', owner: '行长办公室', progress: 68, dueAt: '2026-12-31' },
      { id: 'kw-002', title: '数字化转型推进项目', priority: 'P1', status: 'in_progress', owner: '信息科技部', progress: 45, dueAt: '2027-03-31' },
      { id: 'kw-003', title: '风险管理体系优化', priority: 'P1', status: 'in_progress', owner: '风险管理部', progress: 52, dueAt: '2026-12-15' },
      { id: 'kw-004', title: '客户满意度提升行动', priority: 'P2', status: 'in_progress', owner: '零售金融部', progress: 30, dueAt: '2027-01-31' },
    ],
    department: [
      { id: 'kw-005', title: '部门季度业绩目标', priority: 'P0', status: 'in_progress', owner: '部门负责人', progress: 72, dueAt: '2026-12-31' },
      { id: 'kw-006', title: '重点客户走访计划', priority: 'P1', status: 'in_progress', owner: '客户经理组', progress: 55, dueAt: '2026-11-30' },
      { id: 'kw-007', title: '新产品上线准备', priority: 'P1', status: 'in_progress', owner: '产品组', progress: 40, dueAt: '2027-01-15' },
    ],
    self: [
      { id: 'kw-008', title: '月度工作报告撰写', priority: 'P1', status: 'in_progress', owner: '本人', progress: 60, dueAt: '2026-11-30' },
      { id: 'kw-009', title: '客户授信方案审批', priority: 'P0', status: 'pending', owner: '本人', progress: 0, dueAt: '2026-11-25' },
    ],
  };
  return works[scope];
}

function generateMockAiUsage(scope: DashboardDataScope): AiUsageItem[] {
  const usage: Record<DashboardDataScope, AiUsageItem[]> = {
    global: [
      { agentCode: 'assistant', agentName: '智能助手', runCount: 1850, successCount: 1720, avgLatencyMs: 1200, totalCost: 320 },
      { agentCode: 'credit_analyst', agentName: '信贷分析师', runCount: 680, successCount: 620, avgLatencyMs: 2800, totalCost: 180 },
      { agentCode: 'risk_advisor', agentName: '风险顾问', runCount: 420, successCount: 395, avgLatencyMs: 1500, totalCost: 95 },
      { agentCode: 'doc_writer', agentName: '文档撰写', runCount: 470, successCount: 440, avgLatencyMs: 900, totalCost: 65 },
    ],
    department: [
      { agentCode: 'assistant', agentName: '智能助手', runCount: 450, successCount: 420, avgLatencyMs: 1100, totalCost: 80 },
      { agentCode: 'credit_analyst', agentName: '信贷分析师', runCount: 210, successCount: 195, avgLatencyMs: 2600, totalCost: 55 },
      { agentCode: 'doc_writer', agentName: '文档撰写', runCount: 196, successCount: 180, avgLatencyMs: 850, totalCost: 30 },
    ],
    self: [
      { agentCode: 'assistant', agentName: '智能助手', runCount: 38, successCount: 35, avgLatencyMs: 1000, totalCost: 8 },
      { agentCode: 'doc_writer', agentName: '文档撰写', runCount: 26, successCount: 24, avgLatencyMs: 800, totalCost: 4 },
    ],
  };
  return usage[scope];
}

function generateMockCollaborations(scope: DashboardDataScope): CollaborationItem[] {
  const collabs: Record<DashboardDataScope, CollaborationItem[]> = {
    global: [
      { id: 'co-001', title: '年度信贷投放协同', type: 'project', status: 'active', memberCount: 12 },
      { id: 'co-002', title: '数字化转型推进', type: 'project', status: 'active', memberCount: 8 },
      { id: 'co-003', title: '风险管控联防', type: 'task', status: 'active', memberCount: 6 },
      { id: 'co-004', title: '客户服务优化', type: 'project', status: 'active', memberCount: 10 },
    ],
    department: [
      { id: 'co-005', title: '部门季度业绩冲刺', type: 'project', status: 'active', memberCount: 5 },
      { id: 'co-006', title: '重点客户联合服务', type: 'task', status: 'active', memberCount: 4 },
      { id: 'co-007', title: '新产品评审', type: 'approval', status: 'active', memberCount: 3 },
    ],
    self: [
      { id: 'co-008', title: '授信方案协作', type: 'task', status: 'active', memberCount: 3 },
      { id: 'co-009', title: '月度报告联编', type: 'document', status: 'active', memberCount: 2 },
    ],
  };
  return collabs[scope];
}

function generateMockWorkloads(scope: DashboardDataScope): WorkloadItem[] {
  if (scope === 'self') {
    return [];
  }
  const workloads: Record<DashboardDataScope, WorkloadItem[]> = {
    global: [
      { userId: 'u-001', userName: '张三', totalTasks: 32, inProgressTasks: 12, completedTasks: 18, overdueTasks: 2 },
      { userId: 'u-002', userName: '李四', totalTasks: 28, inProgressTasks: 10, completedTasks: 16, overdueTasks: 2 },
      { userId: 'u-003', userName: '王五', totalTasks: 25, inProgressTasks: 8, completedTasks: 15, overdueTasks: 2 },
      { userId: 'u-004', userName: '赵六', totalTasks: 22, inProgressTasks: 7, completedTasks: 14, overdueTasks: 1 },
      { userId: 'u-005', userName: '钱七', totalTasks: 18, inProgressTasks: 5, completedTasks: 12, overdueTasks: 1 },
    ],
    department: [
      { userId: 'u-006', userName: '孙八', totalTasks: 20, inProgressTasks: 8, completedTasks: 10, overdueTasks: 2 },
      { userId: 'u-007', userName: '周九', totalTasks: 16, inProgressTasks: 6, completedTasks: 9, overdueTasks: 1 },
      { userId: 'u-008', userName: '吴十', totalTasks: 14, inProgressTasks: 5, completedTasks: 8, overdueTasks: 1 },
    ],
    self: [],
  };
  return workloads[scope];
}

function generateMockBusinessMetrics(scope: DashboardDataScope): BusinessMetricItem[] {
  if (scope === 'self') {
    return [];
  }
  const metrics: Record<DashboardDataScope, BusinessMetricItem[]> = {
    global: [
      { code: 'loan_balance', name: '贷款余额', value: 5280000, unit: '万元', period: '2026Q4', source: '核心系统', isMock: true },
      { code: 'deposit_balance', name: '存款余额', value: 8650000, unit: '万元', period: '2026Q4', source: '核心系统', isMock: true },
      { code: 'npl_ratio', name: '不良贷款率', value: 1.32, unit: '%', period: '2026Q4', source: '风险系统', isMock: true },
      { code: 'roa', name: '资产收益率', value: 0.85, unit: '%', period: '2026Q4', source: '财务系统', isMock: true },
      { code: 'cost_income_ratio', name: '成本收入比', value: 32.5, unit: '%', period: '2026Q4', source: '财务系统', isMock: true },
      { code: 'customer_count', name: '客户总数', value: 125600, unit: '户', period: '2026Q4', source: 'CRM系统', isMock: true },
    ],
    department: [
      { code: 'dept_loan_balance', name: '部门贷款余额', value: 860000, unit: '万元', period: '2026Q4', source: '核心系统', isMock: true },
      { code: 'dept_deposit_balance', name: '部门存款余额', value: 1200000, unit: '万元', period: '2026Q4', source: '核心系统', isMock: true },
      { code: 'dept_customer_count', name: '部门客户数', value: 3200, unit: '户', period: '2026Q4', source: 'CRM系统', isMock: true },
      { code: 'dept_revenue', name: '部门营收', value: 18500, unit: '万元', period: '2026Q4', source: '财务系统', isMock: true },
    ],
    self: [],
  };
  return metrics[scope];
}

function generateMockOrgRunning(scope: DashboardDataScope): OrgRunningItem[] {
  if (scope === 'self') {
    return [];
  }
  const orgs: Record<DashboardDataScope, OrgRunningItem[]> = {
    global: [
      { orgUnitName: '公司金融部', totalUsers: 45, activeUsers: 42, taskCompletionRate: 73.4 },
      { orgUnitName: '零售金融部', totalUsers: 38, activeUsers: 35, taskCompletionRate: 73.5 },
      { orgUnitName: '风险管理部', totalUsers: 28, activeUsers: 26, taskCompletionRate: 73.2 },
      { orgUnitName: '运营管理部', totalUsers: 22, activeUsers: 20, taskCompletionRate: 72.7 },
      { orgUnitName: '信息科技部', totalUsers: 18, activeUsers: 17, taskCompletionRate: 72.7 },
    ],
    department: [
      { orgUnitName: '信贷审批组', totalUsers: 12, activeUsers: 11, taskCompletionRate: 70.8 },
      { orgUnitName: '客户服务组', totalUsers: 10, activeUsers: 9, taskCompletionRate: 74.3 },
      { orgUnitName: '产品创新组', totalUsers: 6, activeUsers: 5, taskCompletionRate: 66.2 },
    ],
    self: [],
  };
  return orgs[scope];
}

function generateMockBusinessTrend(scope: DashboardDataScope): TrendPoint[] {
  const quarters = ['2025Q1', '2025Q2', '2025Q3', '2025Q4', '2026Q1', '2026Q2', '2026Q3', '2026Q4'];
  const baseValues: Record<DashboardDataScope, number[]> = {
    global: [4800000, 4950000, 5100000, 5200000, 5220000, 5250000, 5280000, 5280000],
    department: [780000, 800000, 830000, 850000, 855000, 858000, 860000, 860000],
    self: [],
  };
  if (scope === 'self') {
    return [];
  }
  return quarters.map((period, i) => ({ period, value: baseValues[scope][i] }));
}

async function fetchRealTaskStats(user: SessionUser, scope: DashboardDataScope): Promise<{
  total: number;
  completed: number;
  overdue: number;
  completionRate: number;
  overdueRate: number;
} | null> {
  try {
    const db = getSupabaseClient();
    let query = db
      .from('task')
      .select('id,status,due_at,assignee_id,org_unit_id')
      .eq('tenant_id', user.tenantId)
      .is('deleted_at', null);

    if (scope === 'self') {
      query = query.eq('assignee_id', user.id);
    } else if (scope === 'department' && user.orgUnitId) {
      query = query.eq('org_unit_id', user.orgUnitId);
    }

    const { data, error } = await query;
    if (error || !data) return null;

    const total = data.length;
    const completed = data.filter((t: Record<string, unknown>) => t.status === 'done' || t.status === 'completed').length;
    const now = new Date().toISOString();
    const overdue = data.filter((t: Record<string, unknown>) => {
      const dueAt = t.due_at as string | null;
      const status = t.status as string;
      return dueAt && dueAt < now && status !== 'done' && status !== 'completed';
    }).length;

    return {
      total,
      completed,
      overdue,
      completionRate: total > 0 ? Math.round((completed / total) * 1000) / 10 : 0,
      overdueRate: total > 0 ? Math.round((overdue / total) * 1000) / 10 : 0,
    };
  } catch {
    return null;
  }
}

async function fetchRealRiskAlerts(user: SessionUser, scope: DashboardDataScope): Promise<RiskAlertItem[] | null> {
  try {
    const db = getSupabaseClient();
    let query = db
      .from('risk_alert')
      .select('id,title,severity,resource_type,status,created_at')
      .eq('tenant_id', user.tenantId)
      .order('created_at', { ascending: false })
      .limit(10);

    if (scope === 'self') {
      query = query.eq('assignee_id', user.id);
    }

    const { data, error } = await query;
    if (error || !data) return null;

    return (data as Record<string, unknown>[]).map((row) => ({
      id: row.id as string,
      title: row.title as string,
      severity: row.severity as 'low' | 'medium' | 'high',
      resourceType: row.resource_type as string,
      status: row.status as string,
      createdAt: row.created_at as string,
    }));
  } catch {
    return null;
  }
}

export async function getDashboardData(
  user: SessionUser,
  dashboardCode: string,
): Promise<DashboardData | null> {
  const scope = resolveScope(user);
  const scopeLabel = getScopeLabel(scope);

  const realTaskStats = await fetchRealTaskStats(user, scope);
  const realRiskAlerts = await fetchRealRiskAlerts(user, scope);

  let metrics = generateMockMetrics(scope);
  let isMock = true;

  if (realTaskStats) {
    isMock = false;
    metrics = metrics.map((m) => {
      if (m.code === 'task_total') {
        return { ...m, value: realTaskStats.total, isMock: false };
      }
      if (m.code === 'task_completion_rate') {
        return { ...m, value: realTaskStats.completionRate, isMock: false };
      }
      if (m.code === 'task_overdue_rate') {
        return { ...m, value: realTaskStats.overdueRate, isMock: false };
      }
      return m;
    });
  }

  let riskAlerts = generateMockRiskAlerts(scope);
  if (realRiskAlerts && realRiskAlerts.length > 0) {
    riskAlerts = realRiskAlerts;
    isMock = false;
  }

  return {
    scope,
    scopeLabel,
    isMock,
    metrics,
    taskTrend: generateMockTaskTrend(scope),
    departmentTasks: generateMockDepartmentTasks(scope),
    riskAlerts,
    keyWorks: generateMockKeyWorks(scope),
    aiUsage: generateMockAiUsage(scope),
    collaborations: generateMockCollaborations(scope),
    workloads: generateMockWorkloads(scope),
    businessMetrics: generateMockBusinessMetrics(scope),
    orgRunning: generateMockOrgRunning(scope),
    businessTrend: generateMockBusinessTrend(scope),
  };
}