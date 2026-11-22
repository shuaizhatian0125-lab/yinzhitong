import { getSupabaseClient } from '@/storage/database/supabase-client';
import type { SessionUser } from '@/lib/auth';

export type DeliverableType =
  | 'REPORT'
  | 'DOCUMENT'
  | 'DATA'
  | 'ANALYSIS'
  | 'DECISION'
  | 'PLAN'
  | 'OTHER';

export type DeliverableStatus =
  | 'DRAFT'
  | 'REVIEWING'
  | 'APPROVED'
  | 'DELIVERED'
  | 'REJECTED'
  | 'REVISED';

export type Deliverable = {
  id: string;
  tenantId: string;
  collaborationId: string;
  title: string;
  type: DeliverableType;
  content: string;
  sourceWorkstreamId: string | null;
  sourceTaskIds: string[];
  traceability: Traceability;
  status: DeliverableStatus;
  submittedAt: string | null;
  approvedAt: string | null;
  deliveredAt: string | null;
  createdAt: string;
};

export type Traceability = {
  taskIds: string[];
  agentRunIds: string[];
  knowledgeSources: string[];
  dataSources: string[];
};

export type DeliverableAction =
  | 'SUBMIT'
  | 'REVIEW'
  | 'APPROVE'
  | 'REJECT'
  | 'DELIVER'
  | 'REVISE';

const VALID_TRANSITIONS: Record<DeliverableStatus, DeliverableAction[]> = {
  DRAFT: ['SUBMIT', 'REVISE'],
  REVIEWING: ['APPROVE', 'REJECT', 'REVISE'],
  APPROVED: ['DELIVER'],
  DELIVERED: [],
  REJECTED: ['REVISE'],
  REVISED: ['SUBMIT'],
};

export async function createDeliverable(
  tenantId: string,
  collaborationId: string,
  title: string,
  type: DeliverableType,
  content: string,
  sourceWorkstreamId?: string,
  sourceTaskIds?: string[],
  traceability?: Traceability,
): Promise<Deliverable> {
  const db = await getSupabaseClient();

  const id = crypto.randomUUID();
  const now = new Date().toISOString();

  const { data, error } = await db.from('collaboration_deliverables').insert({
    id,
    tenant_id: tenantId,
    collaboration_id: collaborationId,
    title,
    type,
    content,
    source_workstream_id: sourceWorkstreamId ?? null,
    source_task_ids: sourceTaskIds ?? [],
    traceability: traceability ?? { taskIds: [], agentRunIds: [], knowledgeSources: [], dataSources: [] },
    status: 'draft',
    submitted_at: null,
    approved_at: null,
    delivered_at: null,
  }).select('*').limit(1);

  if (error || !data?.[0]) {
    throw new Error(`创建成果失败: ${error?.message ?? '未知错误'}`);
  }

  return mapRowToDeliverable(data[0] as Record<string, unknown>);
}

export async function getDeliverable(
  tenantId: string,
  deliverableId: string,
): Promise<Deliverable | null> {
  const db = await getSupabaseClient();
  const { data } = await db.from('collaboration_deliverables')
    .select('*')
    .eq('id', deliverableId)
    .eq('tenant_id', tenantId)
    .limit(1);

  if (!data?.[0]) return null;
  return mapRowToDeliverable(data[0] as Record<string, unknown>);
}

export async function listDeliverables(
  tenantId: string,
  collaborationId: string,
  filter?: { status?: DeliverableStatus; type?: DeliverableType },
): Promise<Deliverable[]> {
  const db = await getSupabaseClient();

  let query = db.from('collaboration_deliverables')
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
  return (data ?? []).map(row => mapRowToDeliverable(row as Record<string, unknown>));
}

export async function updateDeliverableStatus(
  tenantId: string,
  deliverableId: string,
  action: DeliverableAction,
  user: SessionUser,
): Promise<Deliverable> {
  const db = await getSupabaseClient();

  const { data: existing } = await db.from('collaboration_deliverables')
    .select('status')
    .eq('id', deliverableId)
    .eq('tenant_id', tenantId)
    .single();

  if (!existing) {
    throw new Error('成果不存在');
  }

  const currentStatus = (existing.status as string).toUpperCase() as DeliverableStatus;
  const validActions = VALID_TRANSITIONS[currentStatus];

  if (!validActions.includes(action)) {
    throw new Error(`状态 ${currentStatus} 不允许操作 ${action}`);
  }

  const now = new Date().toISOString();
  const updates: Record<string, unknown> = {};

  switch (action) {
    case 'SUBMIT':
      updates.status = 'reviewing';
      updates.submitted_at = now;
      break;
    case 'REVIEW':
      updates.status = 'reviewing';
      break;
    case 'APPROVE':
      updates.status = 'approved';
      updates.approved_at = now;
      break;
    case 'REJECT':
      updates.status = 'rejected';
      break;
    case 'DELIVER':
      updates.status = 'delivered';
      updates.delivered_at = now;
      break;
    case 'REVISE':
      updates.status = 'revised';
      break;
  }

  await db.from('collaboration_deliverables')
    .update(updates)
    .eq('id', deliverableId)
    .eq('tenant_id', tenantId);

  const { data } = await db.from('collaboration_deliverables')
    .select('*')
    .eq('id', deliverableId)
    .eq('tenant_id', tenantId)
    .limit(1);

  return mapRowToDeliverable(data![0] as Record<string, unknown>);
}

export async function integrateDeliverables(
  tenantId: string,
  collaborationId: string,
  user: SessionUser,
): Promise<Deliverable> {
  const db = await getSupabaseClient();

  const { data: workstreamDeliverables } = await db.from('collaboration_deliverables')
    .select('*')
    .eq('collaboration_id', collaborationId)
    .eq('tenant_id', tenantId)
    .in('status', ['draft', 'approved']);

  if (!workstreamDeliverables || workstreamDeliverables.length === 0) {
    throw new Error('没有可整合的成果');
  }

  const deliverables = workstreamDeliverables.map(row => mapRowToDeliverable(row as Record<string, unknown>));

  const seenContent = new Set<string>();
  const deduplicated: Deliverable[] = [];
  for (const d of deliverables) {
    const contentKey = d.content.substring(0, 100);
    if (!seenContent.has(contentKey)) {
      seenContent.add(contentKey);
      deduplicated.push(d);
    }
  }

  const integratedContent = deduplicated.map(d =>
    `## ${d.title}\n\n${d.content}`
  ).join('\n\n---\n\n');

  const allTaskIds = Array.from(new Set(deduplicated.flatMap(d => d.traceability.taskIds)));
  const allAgentRunIds = Array.from(new Set(deduplicated.flatMap(d => d.traceability.agentRunIds)));
  const allKnowledgeSources = Array.from(new Set(deduplicated.flatMap(d => d.traceability.knowledgeSources)));
  const allDataSources = Array.from(new Set(deduplicated.flatMap(d => d.traceability.dataSources)));

  const integrated = await createDeliverable(
    tenantId,
    collaborationId,
    '协作整合成果报告',
    'REPORT',
    integratedContent,
    undefined,
    allTaskIds,
    {
      taskIds: allTaskIds,
      agentRunIds: allAgentRunIds,
      knowledgeSources: allKnowledgeSources,
      dataSources: allDataSources,
    },
  );

  return integrated;
}

export async function getTraceability(
  tenantId: string,
  deliverableId: string,
): Promise<Traceability | null> {
  const deliverable = await getDeliverable(tenantId, deliverableId);
  if (!deliverable) return null;
  return deliverable.traceability;
}

function mapRowToDeliverable(row: Record<string, unknown>): Deliverable {
  const traceabilityData = row.traceability as Record<string, unknown> | null;
  const traceability: Traceability = {
    taskIds: (traceabilityData?.taskIds as string[]) ?? [],
    agentRunIds: (traceabilityData?.agentRunIds as string[]) ?? [],
    knowledgeSources: (traceabilityData?.knowledgeSources as string[]) ?? [],
    dataSources: (traceabilityData?.dataSources as string[]) ?? [],
  };

  return {
    id: row.id as string,
    tenantId: row.tenant_id as string,
    collaborationId: row.collaboration_id as string,
    title: row.title as string,
    type: row.type as DeliverableType,
    content: row.content as string,
    sourceWorkstreamId: row.source_workstream_id as string | null,
    sourceTaskIds: (row.source_task_ids as string[]) ?? [],
    traceability,
    status: (row.status as string).toUpperCase() as DeliverableStatus,
    submittedAt: row.submitted_at as string | null,
    approvedAt: row.approved_at as string | null,
    deliveredAt: row.delivered_at as string | null,
    createdAt: row.created_at as string,
  };
}