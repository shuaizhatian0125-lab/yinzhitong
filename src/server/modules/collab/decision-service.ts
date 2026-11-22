import { getSupabaseClient } from '@/storage/database/supabase-client';
import type { SessionUser } from '@/lib/auth';

export type DecisionType =
  | 'STRATEGIC'
  | 'RESOURCE'
  | 'SCOPE'
  | 'PRIORITY'
  | 'RISK_MITIGATION'
  | 'PROCESS'
  | 'TECHNICAL'
  | 'PERSONNEL'
  | 'BUDGET'
  | 'EXTERNAL';

export type DecisionStatus =
  | 'DRAFT'
  | 'ANALYZING'
  | 'PENDING'
  | 'APPROVED'
  | 'REJECTED'
  | 'REVISED'
  | 'EXECUTING'
  | 'COMPLETED'
  | 'CANCELLED';

export type DecisionOption = {
  id: string;
  label: string;
  description: string;
  pros: string[];
  cons: string[];
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
};

export type Decision = {
  id: string;
  tenantId: string;
  collaborationId: string;
  type: DecisionType;
  title: string;
  description: string;
  options: DecisionOption[];
  selectedOption: string | null;
  aiAnalysis: AiAnalysis | null;
  status: DecisionStatus;
  requiredApprovers: string[];
  deadline: string | null;
  resolvedAt: string | null;
  createdAt: string;
};

export type AiAnalysis = {
  recommendation: string;
  riskAssessment: string;
  evidenceSummary: string[];
  impactSimulation: string;
  isAiSuggestion: boolean;
};

const APPROVAL_REQUIREMENTS: Record<DecisionType, string[]> = {
  STRATEGIC: ['OWNER', 'COORDINATOR'],
  RESOURCE: ['COORDINATOR'],
  SCOPE: ['OWNER'],
  PRIORITY: ['COORDINATOR'],
  RISK_MITIGATION: ['COORDINATOR', 'LEADER'],
  PROCESS: ['COORDINATOR'],
  TECHNICAL: ['LEADER'],
  PERSONNEL: ['OWNER'],
  BUDGET: ['OWNER'],
  EXTERNAL: ['OWNER', 'COORDINATOR'],
};

export function getApprovalRequirement(type: DecisionType): string[] {
  return APPROVAL_REQUIREMENTS[type];
}

export async function createDecision(
  tenantId: string,
  collaborationId: string,
  type: DecisionType,
  title: string,
  description: string,
  options: DecisionOption[],
  deadline?: string,
  requiredApprovers?: string[],
): Promise<Decision> {
  const db = await getSupabaseClient();

  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  const approvers = requiredApprovers ?? getApprovalRequirement(type);

  const { data, error } = await db.from('collaboration_decisions').insert({
    id,
    tenant_id: tenantId,
    collaboration_id: collaborationId,
    type,
    title,
    description,
    options: options as unknown[],
    selected_option: null,
    ai_analysis: null,
    status: 'DRAFT',
    required_approvers: approvers,
    deadline: deadline ?? null,
    resolved_at: null,
  }).select('*').limit(1);

  if (error || !data?.[0]) {
    throw new Error(`创建决策失败: ${error?.message ?? '未知错误'}`);
  }

  return mapRowToDecision(data[0] as Record<string, unknown>);
}

export async function getDecision(
  tenantId: string,
  decisionId: string,
): Promise<Decision | null> {
  const db = await getSupabaseClient();
  const { data } = await db.from('collaboration_decisions')
    .select('*')
    .eq('id', decisionId)
    .eq('tenant_id', tenantId)
    .limit(1);

  if (!data?.[0]) return null;
  return mapRowToDecision(data[0] as Record<string, unknown>);
}

export async function listDecisions(
  tenantId: string,
  collaborationId: string,
  filter?: { status?: DecisionStatus; type?: DecisionType },
): Promise<Decision[]> {
  const db = await getSupabaseClient();

  let query = db.from('collaboration_decisions')
    .select('*')
    .eq('collaboration_id', collaborationId)
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false });

  if (filter?.status) {
    query = query.eq('status', filter.status.toLowerCase());
  }
  if (filter?.type) {
    query = query.eq('type', filter.type);
  }

  const { data } = await query;
  return (data ?? []).map(row => mapRowToDecision(row as Record<string, unknown>));
}

export async function analyzeDecision(
  tenantId: string,
  decisionId: string,
  aiAnalysis: AiAnalysis,
): Promise<Decision> {
  const db = await getSupabaseClient();

  const { data: existing } = await db.from('collaboration_decisions')
    .select('status')
    .eq('id', decisionId)
    .eq('tenant_id', tenantId)
    .single();

  if (!existing) {
    throw new Error('决策不存在');
  }

  if (existing.status !== 'DRAFT' && existing.status !== 'ANALYZING') {
    throw new Error('当前状态不允许分析');
  }

  await db.from('collaboration_decisions')
    .update({
      status: 'PENDING',
      ai_analysis: aiAnalysis as unknown as Record<string, unknown>,
    })
    .eq('id', decisionId)
    .eq('tenant_id', tenantId);

  const { data } = await db.from('collaboration_decisions')
    .select('*')
    .eq('id', decisionId)
    .eq('tenant_id', tenantId)
    .limit(1);

  return mapRowToDecision(data![0] as Record<string, unknown>);
}

export async function approveDecision(
  tenantId: string,
  decisionId: string,
  selectedOption: string,
  user: SessionUser,
): Promise<Decision> {
  const db = await getSupabaseClient();

  const { data: existing } = await db.from('collaboration_decisions')
    .select('status,required_approvers,type')
    .eq('id', decisionId)
    .eq('tenant_id', tenantId)
    .single();

  if (!existing) {
    throw new Error('决策不存在');
  }

  if (existing.status !== 'PENDING') {
    throw new Error('当前状态不允许批准');
  }

  const requiredApprovers = existing.required_approvers as string[];
  const userRole = mapRoleCodeToApproverRole(user.roleCode);

  if (!requiredApprovers.includes(userRole) && user.roleCode !== 'admin') {
    throw new Error(`无决策权限，需要: ${requiredApprovers.join(', ')}`);
  }

  await db.from('collaboration_decisions')
    .update({
      status: 'APPROVED',
      selected_option: selectedOption,
      resolved_at: new Date().toISOString(),
    })
    .eq('id', decisionId)
    .eq('tenant_id', tenantId);

  const { data } = await db.from('collaboration_decisions')
    .select('*')
    .eq('id', decisionId)
    .eq('tenant_id', tenantId)
    .limit(1);

  return mapRowToDecision(data![0] as Record<string, unknown>);
}

export async function rejectDecision(
  tenantId: string,
  decisionId: string,
  reason: string,
  user: SessionUser,
): Promise<Decision> {
  const db = await getSupabaseClient();

  const { data: existing } = await db.from('collaboration_decisions')
    .select('status')
    .eq('id', decisionId)
    .eq('tenant_id', tenantId)
    .single();

  if (!existing) {
    throw new Error('决策不存在');
  }

  if (existing.status !== 'PENDING') {
    throw new Error('当前状态不允许拒绝');
  }

  await db.from('collaboration_decisions')
    .update({
      status: 'REJECTED',
      resolved_at: new Date().toISOString(),
    })
    .eq('id', decisionId)
    .eq('tenant_id', tenantId);

  const { data } = await db.from('collaboration_decisions')
    .select('*')
    .eq('id', decisionId)
    .eq('tenant_id', tenantId)
    .limit(1);

  return mapRowToDecision(data![0] as Record<string, unknown>);
}

export async function reviseDecision(
  tenantId: string,
  decisionId: string,
  revisedOptions: DecisionOption[],
  user: SessionUser,
): Promise<Decision> {
  const db = await getSupabaseClient();

  const { data: existing } = await db.from('collaboration_decisions')
    .select('status')
    .eq('id', decisionId)
    .eq('tenant_id', tenantId)
    .single();

  if (!existing) {
    throw new Error('决策不存在');
  }

  if (existing.status !== 'PENDING' && existing.status !== 'REJECTED') {
    throw new Error('当前状态不允许修改');
  }

  await db.from('collaboration_decisions')
    .update({
      status: 'REVISED',
      options: revisedOptions as unknown[],
    })
    .eq('id', decisionId)
    .eq('tenant_id', tenantId);

  const { data } = await db.from('collaboration_decisions')
    .select('*')
    .eq('id', decisionId)
    .eq('tenant_id', tenantId)
    .limit(1);

  return mapRowToDecision(data![0] as Record<string, unknown>);
}

export async function executeDecision(
  tenantId: string,
  decisionId: string,
): Promise<Decision> {
  const db = await getSupabaseClient();

  const { data: existing } = await db.from('collaboration_decisions')
    .select('status,selected_option')
    .eq('id', decisionId)
    .eq('tenant_id', tenantId)
    .single();

  if (!existing) {
    throw new Error('决策不存在');
  }

  if (existing.status !== 'APPROVED') {
    throw new Error('只有已批准的决策可以执行');
  }

  await db.from('collaboration_decisions')
    .update({
      status: 'EXECUTING',
    })
    .eq('id', decisionId)
    .eq('tenant_id', tenantId);

  await db.from('collaboration_decisions')
    .update({
      status: 'COMPLETED',
      resolved_at: new Date().toISOString(),
    })
    .eq('id', decisionId)
    .eq('tenant_id', tenantId);

  const { data } = await db.from('collaboration_decisions')
    .select('*')
    .eq('id', decisionId)
    .eq('tenant_id', tenantId)
    .limit(1);

  return mapRowToDecision(data![0] as Record<string, unknown>);
}

function mapRoleCodeToApproverRole(roleCode: string): string {
  switch (roleCode) {
    case 'admin': return 'OWNER';
    case 'dept_head': return 'OWNER';
    case 'team_lead': return 'COORDINATOR';
    case 'staff': return 'LEADER';
    default: return 'LEADER';
  }
}

function mapRowToDecision(row: Record<string, unknown>): Decision {
  return {
    id: row.id as string,
    tenantId: row.tenant_id as string,
    collaborationId: row.collaboration_id as string,
    type: row.type as DecisionType,
    title: row.title as string,
    description: row.description as string,
    options: (row.options as DecisionOption[]) ?? [],
    selectedOption: row.selected_option as string | null,
    aiAnalysis: row.ai_analysis as AiAnalysis | null,
    status: (row.status as string).toUpperCase() as DecisionStatus,
    requiredApprovers: (row.required_approvers as string[]) ?? [],
    deadline: row.deadline as string | null,
    resolvedAt: row.resolved_at as string | null,
    createdAt: row.created_at as string,
  };
}