import { getSupabaseClient } from '@/storage/database/supabase-client';
import type { SessionUser } from '@/lib/auth';

export type CoordinatorMode =
  | 'HUMAN'
  | 'AI_ASSISTED'
  | 'AI_COORDINATED'
  | 'AUTO';

export type CoordinatorStatus =
  | 'INITIALIZING'
  | 'ACTIVE'
  | 'MONITORING'
  | 'REPLANNING'
  | 'WAITING_HUMAN'
  | 'FINALIZING'
  | 'COMPLETED'
  | 'PAUSED'
  | 'FAILED'
  | 'CANCELLED'
  | 'BLOCKED';

export type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export type CoordinatorInstance = {
  id: string;
  collaborationId: string;
  mode: CoordinatorMode;
  status: CoordinatorStatus;
  lastDecision: CoordinatorDecision | null;
  pendingItems: PendingItem[];
  budget: CoordinatorBudget;
  triggeredBy: 'event' | 'schedule' | 'request';
  triggeredAt: string;
  finishedAt: string | null;
};

export type CoordinatorDecision = {
  id: string;
  collaborationId: string;
  type: CoordinatorDecisionType;
  description: string;
  recommendation: string;
  riskLevel: RiskLevel;
  requiredApproval: boolean;
  approvedBy: string | null;
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'EXECUTED' | 'SUPERSEDED';
  createdAt: string;
  resolvedAt: string | null;
};

export type CoordinatorDecisionType =
  | 'PLAN_ADJUSTMENT'
  | 'RESOURCE_REALLOCATION'
  | 'PRIORITY_CHANGE'
  | 'CONFLICT_RESOLUTION'
  | 'MILESTONE_CHECK'
  | 'BUDGET_ALERT'
  | 'RISK_WARNING'
  | 'PARTICIPANT_NOTIFICATION'
  | 'WORKSTREAM_SPLIT'
  | 'WORKSTREAM_MERGE'
  | 'DELIVERABLE_INTEGRATION'
  | 'SCOPE_CHANGE';

export type PendingItem = {
  id: string;
  type: 'DECISION' | 'CONFLICT' | 'APPROVAL' | 'MILESTONE' | 'BUDGET';
  description: string;
  urgency: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  createdAt: string;
};

export type CoordinatorBudget = {
  maxTokensPerCycle: number;
  maxCyclesPerHour: number;
  timeoutSecondsPerCycle: number;
  tokensUsed: number;
  cyclesRun: number;
  lastCycleAt: string | null;
};

export type CollaborationSnapshot = {
  collaborationId: string;
  status: string;
  participants: ParticipantSnapshot[];
  workstreams: WorkstreamSnapshot[];
  decisions: DecisionSnapshot[];
  conflicts: ConflictSnapshot[];
  goalProgress: number;
};

export type ParticipantSnapshot = {
  id: string;
  type: string;
  role: string;
  status: string;
  contributionScore: number;
  blockedItems: string[];
};

export type WorkstreamSnapshot = {
  id: string;
  name: string;
  phase: string;
  status: string;
  progress: number;
  dependencies: string[];
  milestone: Record<string, unknown> | null;
};

export type DecisionSnapshot = {
  id: string;
  type: string;
  title: string;
  status: string;
  deadline: string | null;
};

export type ConflictSnapshot = {
  id: string;
  type: string;
  description: string;
  severity: string;
  status: string;
};

const DEFAULT_BUDGET: CoordinatorBudget = {
  maxTokensPerCycle: 10_000,
  maxCyclesPerHour: 6,
  timeoutSecondsPerCycle: 60,
  tokensUsed: 0,
  cyclesRun: 0,
  lastCycleAt: null,
};

const COORDINATOR_FREQUENCY_LIMIT_MS = 10 * 60 * 1000;

export async function startCoordinator(
  collaborationId: string,
  mode: CoordinatorMode,
  user: SessionUser,
): Promise<CoordinatorInstance> {
  const db = await getSupabaseClient();

  const { data: existing } = await db.from('collaborations')
    .select('id,coordinator_mode,status')
    .eq('id', collaborationId)
    .eq('tenant_id', user.tenantId)
    .single();

  if (!existing) {
    throw new Error('协作不存在');
  }

  const existingMode = existing.coordinator_mode as CoordinatorMode | null;
  if (existingMode && mode !== existingMode) {
    throw new Error(`协作已配置为 ${existingMode} 模式，无法切换为 ${mode}`);
  }

  const coordinatorId = crypto.randomUUID();
  const instance: CoordinatorInstance = {
    id: coordinatorId,
    collaborationId,
    mode,
    status: 'INITIALIZING',
    lastDecision: null,
    pendingItems: [],
    budget: { ...DEFAULT_BUDGET },
    triggeredBy: 'request',
    triggeredAt: new Date().toISOString(),
    finishedAt: null,
  };

  await db.from('collaborations').update({
    coordinator_mode: mode,
  }).eq('id', collaborationId);

  instance.status = 'ACTIVE';
  return instance;
}

export async function getCoordinatorStatus(
  collaborationId: string,
  user: SessionUser,
): Promise<CoordinatorInstance | null> {
  const db = await getSupabaseClient();

  const { data: collab } = await db.from('collaborations')
    .select('id,coordinator_mode,status')
    .eq('id', collaborationId)
    .eq('tenant_id', user.tenantId)
    .single();

  if (!collab || !collab.coordinator_mode) {
    return null;
  }

  const snapshot = await readCollaborationState(collaborationId, user);
  const pendingItems = await identifyPendingItems(collaborationId, user);
  const lastDecision = await getLastDecision(collaborationId, user);

  return {
    id: `coord-${collaborationId}`,
    collaborationId,
    mode: collab.coordinator_mode as CoordinatorMode,
    status: deriveCoordinatorStatus(collab.status as string, pendingItems),
    lastDecision,
    pendingItems,
    budget: DEFAULT_BUDGET,
    triggeredBy: 'request',
    triggeredAt: new Date().toISOString(),
    finishedAt: null,
  };
}

export async function runDecisionCycle(
  collaborationId: string,
  user: SessionUser,
  trigger: 'event' | 'schedule' | 'request' = 'event',
): Promise<CoordinatorDecision[]> {
  const db = await getSupabaseClient();

  const { data: collab } = await db.from('collaborations')
    .select('id,coordinator_mode,status')
    .eq('id', collaborationId)
    .eq('tenant_id', user.tenantId)
    .single();

  if (!collab || !collab.coordinator_mode) {
    throw new Error('协作不存在或未配置 Coordinator');
  }

  const mode = collab.coordinator_mode as CoordinatorMode;

  if (mode === 'HUMAN') {
    return [];
  }

  const snapshot = await readCollaborationState(collaborationId, user);
  const progressAnalysis = analyzeGoalProgress(snapshot);
  const participantAnalysis = analyzeParticipants(snapshot);
  const dependencyAnalysis = analyzeDependencyRisks(snapshot);
  const gaps = identifyGaps(snapshot, progressAnalysis);
  const decisions: CoordinatorDecision[] = [];

  if (gaps.length > 0) {
    for (const gap of gaps) {
      const adjustment = generateAdjustmentPlan(gap, mode);
      const requiresApproval = checkPermission(adjustment, mode);

      const decision: CoordinatorDecision = {
        id: crypto.randomUUID(),
        collaborationId,
        type: adjustment.type,
        description: adjustment.description,
        recommendation: adjustment.recommendation,
        riskLevel: adjustment.riskLevel,
        requiredApproval: requiresApproval,
        approvedBy: null,
        status: requiresApproval ? 'PENDING' : 'APPROVED',
        createdAt: new Date().toISOString(),
        resolvedAt: requiresApproval ? null : new Date().toISOString(),
      };

      await db.from('collaboration_decisions').insert({
        id: decision.id,
        tenant_id: user.tenantId,
        collaboration_id: collaborationId,
        type: decision.type,
        title: decision.description,
        description: decision.recommendation,
        status: decision.status.toLowerCase(),
        required_approvers: requiresApproval ? [user.id] : null,
        ai_analysis: { riskLevel: decision.riskLevel, mode },
      });

      decisions.push(decision);

      if (!requiresApproval) {
        await executeAdjustment(decision, collaborationId, user);
        decision.status = 'EXECUTED';
      }
    }
  }

  const conflicts = await detectConflicts(collaborationId, user);
  for (const conflict of conflicts) {
    const resolution = generateConflictResolution(conflict, mode);
    const decision: CoordinatorDecision = {
      id: crypto.randomUUID(),
      collaborationId,
      type: 'CONFLICT_RESOLUTION',
      description: `冲突处理: ${conflict.description}`,
      recommendation: resolution,
      riskLevel: conflict.severity === 'high' ? 'HIGH' : 'MEDIUM',
      requiredApproval: mode === 'AI_ASSISTED',
      approvedBy: null,
      status: mode === 'AI_ASSISTED' ? 'PENDING' : 'APPROVED',
      createdAt: new Date().toISOString(),
      resolvedAt: mode === 'AI_ASSISTED' ? null : new Date().toISOString(),
    };

    await db.from('collaboration_decisions').insert({
      id: decision.id,
      tenant_id: user.tenantId,
      collaboration_id: collaborationId,
      type: 'CONFLICT_RESOLUTION',
      title: decision.description,
      description: decision.recommendation,
      status: decision.status.toLowerCase(),
      required_approvers: decision.requiredApproval ? [user.id] : null,
      ai_analysis: { conflictId: conflict.id, severity: conflict.severity },
    });

    decisions.push(decision);
  }

  await pushPendingDecisions(collaborationId, user);
  await monitorBudget(collaborationId, user);
  await triggerAlerts(collaborationId, user, snapshot, dependencyAnalysis);

  return decisions;
}

export async function respondToDecision(
  decisionId: string,
  response: 'APPROVED' | 'REJECTED',
  user: SessionUser,
): Promise<CoordinatorDecision> {
  const db = await getSupabaseClient();

  const { data: decision } = await db.from('collaboration_decisions')
    .select('id,collaboration_id,type,title,description,status,ai_analysis')
    .eq('id', decisionId)
    .eq('tenant_id', user.tenantId)
    .single();

  if (!decision) {
    throw new Error('决策不存在');
  }

  if (decision.status !== 'pending') {
    throw new Error('决策已处理');
  }

  await db.from('collaboration_decisions').update({
    status: response.toLowerCase(),
    resolved_at: new Date().toISOString(),
  }).eq('id', decisionId);

  if (response === 'APPROVED') {
    const updatedDecision: CoordinatorDecision = {
      id: decisionId,
      collaborationId: decision.collaboration_id as string,
      type: decision.type as CoordinatorDecisionType,
      description: decision.title as string,
      recommendation: decision.description as string,
      riskLevel: ((decision.ai_analysis as Record<string, unknown>)?.['riskLevel'] as RiskLevel) ?? 'MEDIUM',
      requiredApproval: true,
      approvedBy: user.id,
      status: 'APPROVED',
      createdAt: new Date().toISOString(),
      resolvedAt: new Date().toISOString(),
    };

    await executeAdjustment(updatedDecision, decision.collaboration_id as string, user);

    await db.from('collaboration_decisions').update({
      status: 'executed',
    }).eq('id', decisionId);

    updatedDecision.status = 'EXECUTED';
    return updatedDecision;
  }

  return {
    id: decisionId,
    collaborationId: decision.collaboration_id as string,
    type: decision.type as CoordinatorDecisionType,
    description: decision.title as string,
    recommendation: decision.description as string,
    riskLevel: 'MEDIUM',
    requiredApproval: true,
    approvedBy: user.id,
    status: 'REJECTED',
    createdAt: new Date().toISOString(),
    resolvedAt: new Date().toISOString(),
  };
}

async function readCollaborationState(
  collaborationId: string,
  user: SessionUser,
): Promise<CollaborationSnapshot> {
  const db = await getSupabaseClient();

  const { data: collab } = await db.from('collaborations')
    .select('id,status,success_criteria')
    .eq('id', collaborationId)
    .eq('tenant_id', user.tenantId)
    .single();

  const { data: participants } = await db.from('collaboration_participants')
    .select('id,participant_type,role,status')
    .eq('collaboration_id', collaborationId)
    .eq('tenant_id', user.tenantId);

  const { data: workstreams } = await db.from('collaboration_workstreams')
    .select('id,name,phase,status,progress,dependencies,milestone')
    .eq('collaboration_id', collaborationId)
    .eq('tenant_id', user.tenantId);

  const { data: decisions } = await db.from('collaboration_decisions')
    .select('id,type,title,status,deadline')
    .eq('collaboration_id', collaborationId)
    .eq('tenant_id', user.tenantId);

  const { data: conflicts } = await db.from('collaboration_conflicts')
    .select('id,type,description,severity,status')
    .eq('collaboration_id', collaborationId)
    .eq('tenant_id', user.tenantId);

  const goalProgress = workstreams && workstreams.length > 0
    ? Math.round(workstreams.reduce((sum: number, ws: Record<string, unknown>) => sum + (ws.progress as number ?? 0), 0) / workstreams.length)
    : 0;

  return {
    collaborationId,
    status: collab?.status as string ?? 'unknown',
    participants: (participants ?? []).map((p: Record<string, unknown>) => ({
      id: p.id as string,
      type: p.participant_type as string,
      role: p.role as string,
      status: p.status as string,
      contributionScore: 0,
      blockedItems: [],
    })),
    workstreams: (workstreams ?? []).map((ws: Record<string, unknown>) => ({
      id: ws.id as string,
      name: ws.name as string,
      phase: ws.phase as string,
      status: ws.status as string,
      progress: ws.progress as number,
      dependencies: (ws.dependencies as string[]) ?? [],
      milestone: ws.milestone as Record<string, unknown> | null,
    })),
    decisions: (decisions ?? []).map((d: Record<string, unknown>) => ({
      id: d.id as string,
      type: d.type as string,
      title: d.title as string,
      status: d.status as string,
      deadline: d.deadline as string | null,
    })),
    conflicts: (conflicts ?? []).map((c: Record<string, unknown>) => ({
      id: c.id as string,
      type: c.type as string,
      description: c.description as string,
      severity: c.severity as string,
      status: c.status as string,
    })),
    goalProgress,
  };
}

function analyzeGoalProgress(snapshot: CollaborationSnapshot): { gap: number; details: string } {
  const targetProgress = 100;
  const gap = targetProgress - snapshot.goalProgress;
  return {
    gap,
    details: gap > 20 ? `目标进度差距较大 (${snapshot.goalProgress}%/${targetProgress}%)` : `目标进度正常 (${snapshot.goalProgress}%)`,
  };
}

function analyzeParticipants(snapshot: CollaborationSnapshot): { blockedCount: number; inactiveCount: number } {
  let blockedCount = 0;
  let inactiveCount = 0;
  for (const p of snapshot.participants) {
    if (p.blockedItems.length > 0) blockedCount++;
    if (p.status !== 'active') inactiveCount++;
  }
  return { blockedCount, inactiveCount };
}

function analyzeDependencyRisks(snapshot: CollaborationSnapshot): { criticalPathRisks: string[] } {
  const risks: string[] = [];
  for (const ws of snapshot.workstreams) {
    if (ws.status === 'planning' && ws.dependencies.length > 0) {
      const depStatuses = ws.dependencies.map(depId => {
        const dep = snapshot.workstreams.find(w => w.id === depId);
        return dep?.status ?? 'unknown';
      });
      if (depStatuses.some(s => s !== 'completed')) {
        risks.push(`工作线 ${ws.name} 依赖未完成`);
      }
    }
    if (ws.progress < 30 && ws.status === 'active') {
      risks.push(`工作线 ${ws.name} 进度缓慢 (${ws.progress}%)`);
    }
  }
  return { criticalPathRisks: risks };
}

function identifyGaps(snapshot: CollaborationSnapshot, progressAnalysis: { gap: number; details: string }): Gap[] {
  const gaps: Gap[] = [];

  if (progressAnalysis.gap > 20) {
    gaps.push({
      area: 'PROGRESS',
      description: progressAnalysis.details,
      severity: 'HIGH',
    });
  }

  for (const ws of snapshot.workstreams) {
    if (ws.status === 'planning' && ws.dependencies.length > 0) {
      gaps.push({
        area: 'DEPENDENCY',
        description: `工作线 ${ws.name} 等待依赖完成`,
        severity: 'MEDIUM',
      });
    }
  }

  for (const c of snapshot.conflicts) {
    if (c.status === 'open') {
      gaps.push({
        area: 'CONFLICT',
        description: `未解决冲突: ${c.description}`,
        severity: c.severity === 'high' ? 'HIGH' : 'MEDIUM',
      });
    }
  }

  for (const d of snapshot.decisions) {
    if (d.status === 'pending') {
      gaps.push({
        area: 'DECISION',
        description: `待决策项: ${d.title}`,
        severity: 'MEDIUM',
      });
    }
  }

  return gaps;
}

type Gap = {
  area: 'PROGRESS' | 'DEPENDENCY' | 'CONFLICT' | 'DECISION' | 'RESOURCE';
  description: string;
  severity: RiskLevel;
};

function generateAdjustmentPlan(gap: Gap, mode: CoordinatorMode): {
  type: CoordinatorDecisionType;
  description: string;
  recommendation: string;
  riskLevel: RiskLevel;
} {
  switch (gap.area) {
    case 'PROGRESS':
      return {
        type: 'PLAN_ADJUSTMENT',
        description: `进度差距调整: ${gap.description}`,
        recommendation: '建议增加资源投入或调整工作线优先级，加速关键路径任务',
        riskLevel: gap.severity,
      };
    case 'DEPENDENCY':
      return {
        type: 'PRIORITY_CHANGE',
        description: `依赖阻塞处理: ${gap.description}`,
        recommendation: '建议优先推进被依赖的工作线，或调整依赖关系',
        riskLevel: 'MEDIUM',
      };
    case 'CONFLICT':
      return {
        type: 'CONFLICT_RESOLUTION',
        description: `冲突处理: ${gap.description}`,
        recommendation: '建议根据冲突类型进行协商或AI辅助决策',
        riskLevel: gap.severity,
      };
    case 'DECISION':
      return {
        type: 'PRIORITY_CHANGE',
        description: `推进决策: ${gap.description}`,
        recommendation: '建议催促相关决策者尽快处理，提供AI分析辅助',
        riskLevel: 'LOW',
      };
    default:
      return {
        type: 'RESOURCE_REALLOCATION',
        description: `资源调整: ${gap.description}`,
        recommendation: '建议重新分配资源以解决差距',
        riskLevel: gap.severity,
      };
  }
}

function checkPermission(adjustment: { riskLevel: RiskLevel; type: CoordinatorDecisionType }, mode: CoordinatorMode): boolean {
  if (mode === 'AUTO') return false;
  if (mode === 'AI_COORDINATED') return adjustment.riskLevel === 'HIGH' || adjustment.riskLevel === 'CRITICAL';
  if (mode === 'AI_ASSISTED') return true;
  return true;
}

async function executeAdjustment(
  decision: CoordinatorDecision,
  collaborationId: string,
  user: SessionUser,
): Promise<void> {
  const db = await getSupabaseClient();

  switch (decision.type) {
    case 'PRIORITY_CHANGE':
      await db.from('collaboration_workstreams')
        .update({ status: 'active' })
        .eq('collaboration_id', collaborationId)
        .eq('tenant_id', user.tenantId)
        .eq('status', 'planning');
      break;
    case 'CONFLICT_RESOLUTION':
      await db.from('collaboration_conflicts')
        .update({ status: 'resolving', resolution: decision.recommendation })
        .eq('collaboration_id', collaborationId)
        .eq('tenant_id', user.tenantId)
        .eq('status', 'open');
      break;
    default:
      break;
  }
}

async function detectConflicts(collaborationId: string, user: SessionUser): Promise<ConflictSnapshot[]> {
  const db = await getSupabaseClient();
  const { data } = await db.from('collaboration_conflicts')
    .select('id,type,description,severity,status')
    .eq('collaboration_id', collaborationId)
    .eq('tenant_id', user.tenantId)
    .eq('status', 'open');
  return (data ?? []) as unknown as ConflictSnapshot[];
}

function generateConflictResolution(conflict: ConflictSnapshot, mode: CoordinatorMode): string {
  const base = `针对 ${conflict.type} 类型冲突「${conflict.description}」`;
  if (mode === 'AI_COORDINATED' || mode === 'AUTO') {
    return `${base}，AI建议: 根据冲突严重程度(${conflict.severity})，优先保障协作目标，采用折中方案`;
  }
  return `${base}，建议人工评估后决策`;
}

async function pushPendingDecisions(collaborationId: string, user: SessionUser): Promise<void> {
  const db = await getSupabaseClient();
  const { data: pending } = await db.from('collaboration_decisions')
    .select('id,title')
    .eq('collaboration_id', collaborationId)
    .eq('tenant_id', user.tenantId)
    .eq('status', 'pending');

  if (pending && pending.length > 0) {
    for (const item of pending) {
      await db.from('notifications').insert({
        id: crypto.randomUUID(),
        tenant_id: user.tenantId,
        user_id: user.id,
        type: 'decision_pending',
        title: `待决策: ${item.title}`,
        content: 'Coordinator 识别到待决策项，请尽快处理',
        business_type: 'collaboration',
        business_id: collaborationId,
      });
    }
  }
}

async function monitorBudget(collaborationId: string, user: SessionUser): Promise<void> {
  const db = await getSupabaseClient();
  const { data: runs } = await db.from('ai_run')
    .select('id,cost,max_tokens')
    .eq('tenant_id', user.tenantId)
    .limit(50);

  if (runs && runs.length > 0) {
    const totalCost = runs.reduce((sum: number, r: Record<string, unknown>) => sum + (r.cost as number ?? 0), 0);
    if (totalCost > 50_000) {
      await db.from('collaboration_decisions').insert({
        id: crypto.randomUUID(),
        tenant_id: user.tenantId,
        collaboration_id: collaborationId,
        type: 'BUDGET_ALERT',
        title: '预算预警',
        description: `协作 Token 消耗已达 ${totalCost}，建议控制使用`,
        status: 'pending',
        ai_analysis: { totalCost },
      });
    }
  }
}

async function triggerAlerts(
  collaborationId: string,
  user: SessionUser,
  snapshot: CollaborationSnapshot,
  dependencyAnalysis: { criticalPathRisks: string[] },
): Promise<void> {
  const db = await getSupabaseClient();

  for (const risk of dependencyAnalysis.criticalPathRisks) {
    await db.from('collaboration_decisions').insert({
      id: crypto.randomUUID(),
      tenant_id: user.tenantId,
      collaboration_id: collaborationId,
      type: 'RISK_WARNING',
      title: `风险预警: ${risk}`,
      description: risk,
      status: 'pending',
      ai_analysis: { source: 'dependency_analysis' },
    });
  }
}

async function identifyPendingItems(collaborationId: string, user: SessionUser): Promise<PendingItem[]> {
  const db = await getSupabaseClient();
  const items: PendingItem[] = [];

  const { data: pendingDecisions } = await db.from('collaboration_decisions')
    .select('id,type,title')
    .eq('collaboration_id', collaborationId)
    .eq('tenant_id', user.tenantId)
    .eq('status', 'pending');

  for (const d of pendingDecisions ?? []) {
    items.push({
      id: d.id as string,
      type: 'DECISION',
      description: d.title as string,
      urgency: 'MEDIUM',
      createdAt: new Date().toISOString(),
    });
  }

  const { data: openConflicts } = await db.from('collaboration_conflicts')
    .select('id,type,description,severity')
    .eq('collaboration_id', collaborationId)
    .eq('tenant_id', user.tenantId)
    .eq('status', 'open');

  for (const c of openConflicts ?? []) {
    items.push({
      id: c.id as string,
      type: 'CONFLICT',
      description: c.description as string,
      urgency: (c.severity as string) === 'high' ? 'HIGH' : 'MEDIUM',
      createdAt: new Date().toISOString(),
    });
  }

  return items;
}

function deriveCoordinatorStatus(collabStatus: string, pendingItems: PendingItem[]): CoordinatorStatus {
  if (collabStatus === 'completed') return 'COMPLETED';
  if (collabStatus === 'cancelled') return 'CANCELLED';
  if (collabStatus === 'failed') return 'FAILED';

  const hasUrgent = pendingItems.some(i => i.urgency === 'HIGH' || i.urgency === 'CRITICAL');
  if (hasUrgent) return 'WAITING_HUMAN';

  if (collabStatus === 'active') return 'ACTIVE';

  return 'INITIALIZING';
}

async function getLastDecision(collaborationId: string, user: SessionUser): Promise<CoordinatorDecision | null> {
  const db = await getSupabaseClient();
  const { data } = await db.from('collaboration_decisions')
    .select('id,collaboration_id,type,title,description,status,ai_analysis,resolved_at')
    .eq('collaboration_id', collaborationId)
    .eq('tenant_id', user.tenantId)
    .order('resolved_at', { ascending: false })
    .limit(1);

  if (!data?.[0]) return null;

  const d = data[0] as Record<string, unknown>;
  return {
    id: d.id as string,
    collaborationId: d.collaboration_id as string,
    type: d.type as CoordinatorDecisionType,
    description: d.title as string,
    recommendation: d.description as string,
    riskLevel: ((d.ai_analysis as Record<string, unknown>)?.['riskLevel'] as RiskLevel) ?? 'MEDIUM',
    requiredApproval: d.status === 'pending',
    approvedBy: null,
    status: d.status === 'executed' ? 'EXECUTED' : (d.status as 'PENDING' | 'APPROVED' | 'REJECTED'),
    createdAt: new Date().toISOString(),
    resolvedAt: d.resolved_at as string | null,
  };
}

export function getDefaultModeForBankScenario(collaborationType: string): CoordinatorMode {
  const highRiskTypes = ['STRATEGIC_PLANNING', 'RISK_ASSESSMENT', 'COMPLIANCE_REVIEW', 'CROSS_DEPT_PROJECT'];
  if (highRiskTypes.includes(collaborationType)) {
    return 'AI_ASSISTED';
  }
  return 'AI_COORDINATED';
}