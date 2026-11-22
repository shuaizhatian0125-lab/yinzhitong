import { getSupabaseClient } from '@/storage/database/supabase-client';
import { createNotification } from '@/server/platform/notification/service';

export type ApprovalRow = {
  id: string;
  tenant_id: string;
  instance_id: string | null;
  node_key: string | null;
  business_type: string;
  business_id: string;
  approver_id: string;
  decision: string;
  comment: string | null;
  decided_at: string | null;
  created_at: string;
};

export type ApprovalFilter = {
  status?: string;
  businessType?: string;
  page?: number;
  pageSize?: number;
};

export type DecideApprovalInput = {
  decision: 'approved' | 'rejected';
  comment?: string;
};

export async function listApprovals(
  tenantId: string,
  userId: string,
  filter: ApprovalFilter,
): Promise<{ items: ApprovalRow[]; total: number }> {
  const db = getSupabaseClient();
  const page = filter.page ?? 1;
  const pageSize = filter.pageSize ?? 20;
  const offset = (page - 1) * pageSize;

  let query = db
    .from('approval')
    .select('*', { count: 'exact' })
    .eq('tenant_id', tenantId)
    .eq('approver_id', userId);

  if (filter.status) {
    query = query.eq('decision', filter.status);
  } else {
    query = query.eq('decision', 'pending');
  }

  if (filter.businessType) {
    query = query.eq('business_type', filter.businessType);
  }

  query = query.order('created_at', { ascending: false }).range(offset, offset + pageSize - 1);

  const { data, count } = await query;

  return {
    items: (data ?? []) as ApprovalRow[],
    total: count ?? 0,
  };
}

export async function decideApproval(
  tenantId: string,
  approverId: string,
  approvalId: string,
  input: DecideApprovalInput,
): Promise<ApprovalRow | null> {
  const db = getSupabaseClient();

  const { data: existing } = await db
    .from('approval')
    .select('*')
    .eq('id', approvalId)
    .eq('tenant_id', tenantId)
    .eq('approver_id', approverId)
    .eq('decision', 'pending')
    .limit(1);

  const approval = existing?.[0] as ApprovalRow | undefined;
  if (!approval) {
    throw new Error('审批记录不存在或已处理');
  }

  const now = new Date().toISOString();

  const { data, error } = await db
    .from('approval')
    .update({
      decision: input.decision,
      comment: input.comment ?? null,
      decided_at: now,
    })
    .eq('id', approvalId)
    .eq('tenant_id', tenantId)
    .eq('approver_id', approverId)
    .select('*')
    .limit(1);

  if (error || !data?.[0]) {
    throw new Error(`审批操作失败: ${error?.message ?? '未知错误'}`);
  }

  const updatedApproval = data[0] as ApprovalRow;

  if (approval.instance_id && approval.node_key) {
    await checkApprovalCompletion(tenantId, approval.instance_id, approval.node_key);
  }

  return updatedApproval;
}

async function checkApprovalCompletion(
  tenantId: string,
  instanceId: string,
  nodeKey: string,
): Promise<void> {
  const db = getSupabaseClient();

  const { data: approvals } = await db
    .from('approval')
    .select('decision')
    .eq('tenant_id', tenantId)
    .eq('instance_id', instanceId)
    .eq('node_key', nodeKey);

  if (!approvals || approvals.length === 0) return;

  const decisions = approvals.map((a) => a.decision as string);
  const allDecided = decisions.every((d) => d !== 'pending');
  if (!allDecided) return;

  const hasRejected = decisions.includes('rejected');
  const allApproved = decisions.every((d) => d === 'approved');

  const { data: nodeInstance } = await db
    .from('workflow_node_instance')
    .select('*')
    .eq('instance_id', instanceId)
    .eq('node_key', nodeKey)
    .eq('tenant_id', tenantId)
    .eq('status', 'pending')
    .order('started_at', { ascending: false })
    .limit(1);

  if (!nodeInstance?.[0]) return;

  const now = new Date().toISOString();

  if (hasRejected) {
    await db
      .from('workflow_node_instance')
      .update({
        status: 'rejected',
        output: { approvalResult: 'rejected' },
        finished_at: now,
      })
      .eq('id', nodeInstance[0].id);

    await db
      .from('workflow_instance')
      .update({ status: 'cancelled', finished_at: now })
      .eq('id', instanceId)
      .eq('tenant_id', tenantId);
  } else if (allApproved) {
    await db
      .from('workflow_node_instance')
      .update({
        status: 'completed',
        output: { approvalResult: 'approved' },
        finished_at: now,
      })
      .eq('id', nodeInstance[0].id);

    const { data: instanceData } = await db
      .from('workflow_instance')
      .select('def_id, context')
      .eq('id', instanceId)
      .eq('tenant_id', tenantId)
      .limit(1);

    const instance = instanceData?.[0];
    if (instance) {
      const { data: defData } = await db
        .from('workflow_def')
        .select('definition')
        .eq('id', instance.def_id)
        .limit(1);

      const definition = defData?.[0]?.definition as unknown as
        | { nodes: Array<{ key: string; nextNodeKey?: string }> }
        | undefined;

      if (definition) {
        const node = definition.nodes.find((n) => n.key === nodeKey);
        if (node?.nextNodeKey) {
          const context = (instance.context ?? {}) as Record<string, unknown>;
          await activateNextNode(tenantId, instanceId, node.nextNodeKey, definition, context);
        } else {
          await db
            .from('workflow_instance')
            .update({ status: 'completed', finished_at: now })
            .eq('id', instanceId)
            .eq('tenant_id', tenantId);
        }
      }
    }
  }
}

async function activateNextNode(
  tenantId: string,
  instanceId: string,
  nodeKey: string,
  definition: { nodes: Array<{ key: string; nextNodeKey?: string }> },
  context: Record<string, unknown>,
): Promise<void> {
  const db = getSupabaseClient();
  const node = definition.nodes.find((n) => n.key === nodeKey);
  if (!node) return;

  const now = new Date().toISOString();
  await db.from('workflow_node_instance').insert({
    id: crypto.randomUUID(),
    tenant_id: tenantId,
    instance_id: instanceId,
    node_key: node.key,
    node_type: 'human_task',
    status: 'pending',
    input: context,
    started_at: now,
  });
}

export async function addApprover(
  tenantId: string,
  instanceId: string,
  nodeKey: string,
  approverId: string,
  addedBy: string,
): Promise<ApprovalRow | null> {
  const db = getSupabaseClient();
  const id = crypto.randomUUID();
  const now = new Date().toISOString();

  const { data, error } = await db
    .from('approval')
    .insert({
      id,
      tenant_id: tenantId,
      instance_id: instanceId,
      node_key: nodeKey,
      business_type: 'workflow',
      business_id: instanceId,
      approver_id: approverId,
      decision: 'pending',
      created_at: now,
    })
    .select('*')
    .limit(1);

  if (error || !data?.[0]) return null;

  await createNotification(
    tenantId,
    approverId,
    'approval_pending',
    '加签审批待办',
    `您被加签了一个审批事项`,
    instanceId,
  );

  return data[0] as ApprovalRow;
}