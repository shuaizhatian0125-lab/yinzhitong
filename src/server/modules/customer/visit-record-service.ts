import { getSupabaseClient } from '@/storage/database/supabase-client';
import type { VisitRecordRow } from './customer-service';

export type VisitRecordCreateInput = {
  customerId: string;
  userId: string;
  visitedAt: string;
  purpose: string;
  summary?: string;
  nextAction?: string;
  docId?: string;
};

export type VisitRecordUpdateInput = {
  visitedAt?: string;
  purpose?: string;
  summary?: string;
  nextAction?: string;
};

export async function createVisit(
  tenantId: string,
  input: VisitRecordCreateInput,
): Promise<VisitRecordRow> {
  const db = getSupabaseClient();
  const id = crypto.randomUUID();
  const now = new Date().toISOString();

  const { data, error: insertError } = await db
    .from('visit_record')
    .insert({
      id,
      tenant_id: tenantId,
      customer_id: input.customerId,
      user_id: input.userId,
      visited_at: input.visitedAt,
      purpose: input.purpose,
      summary: input.summary ?? null,
      next_action: input.nextAction ?? null,
      doc_id: input.docId ?? null,
      created_at: now,
    })
    .select('*')
    .limit(1);

  if (insertError) {
    throw new Error(`创建拜访记录失败: ${insertError.message}`);
  }

  return (data?.[0] as VisitRecordRow) ?? null;
}

export async function listVisits(
  tenantId: string,
  customerId: string,
): Promise<VisitRecordRow[]> {
  const db = getSupabaseClient();

  const { data } = await db
    .from('visit_record')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('customer_id', customerId)
    .order('visited_at', { ascending: false });

  return (data ?? []) as VisitRecordRow[];
}

export async function updateVisit(
  tenantId: string,
  visitId: string,
  input: VisitRecordUpdateInput,
): Promise<VisitRecordRow | null> {
  const db = getSupabaseClient();

  const updateFields: Record<string, unknown> = {};
  if (input.visitedAt !== undefined) updateFields.visited_at = input.visitedAt;
  if (input.purpose !== undefined) updateFields.purpose = input.purpose;
  if (input.summary !== undefined) updateFields.summary = input.summary;
  if (input.nextAction !== undefined) updateFields.next_action = input.nextAction;

  const { data, error: updateError } = await db
    .from('visit_record')
    .update(updateFields)
    .eq('id', visitId)
    .eq('tenant_id', tenantId)
    .select('*')
    .limit(1);

  if (updateError) {
    throw new Error(`更新拜访记录失败: ${updateError.message}`);
  }

  return (data?.[0] as VisitRecordRow | undefined) ?? null;
}