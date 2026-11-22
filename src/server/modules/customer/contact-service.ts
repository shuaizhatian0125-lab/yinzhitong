import { getSupabaseClient } from '@/storage/database/supabase-client';
import type { CustomerContactRow } from './customer-service';

export type ContactCreateInput = {
  customerId: string;
  name: string;
  title?: string;
  mobileEnc?: string;
  email?: string;
  decisionRole?: string;
};

export type ContactUpdateInput = {
  name?: string;
  title?: string;
  mobileEnc?: string;
  email?: string;
  decisionRole?: string;
};

export async function createContact(
  tenantId: string,
  input: ContactCreateInput,
): Promise<CustomerContactRow> {
  const db = getSupabaseClient();
  const id = crypto.randomUUID();
  const now = new Date().toISOString();

  const { data, error: insertError } = await db
    .from('customer_contact')
    .insert({
      id,
      tenant_id: tenantId,
      customer_id: input.customerId,
      name: input.name,
      title: input.title ?? null,
      mobile_enc: input.mobileEnc ?? null,
      email: input.email ?? null,
      decision_role: input.decisionRole ?? null,
      created_at: now,
    })
    .select('*')
    .limit(1);

  if (insertError) {
    throw new Error(`创建联系人失败: ${insertError.message}`);
  }

  return (data?.[0] as CustomerContactRow) ?? null;
}

export async function listContacts(
  tenantId: string,
  customerId: string,
): Promise<CustomerContactRow[]> {
  const db = getSupabaseClient();

  const { data } = await db
    .from('customer_contact')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('customer_id', customerId)
    .order('created_at', { ascending: false });

  return (data ?? []) as CustomerContactRow[];
}

export async function updateContact(
  tenantId: string,
  contactId: string,
  input: ContactUpdateInput,
): Promise<CustomerContactRow | null> {
  const db = getSupabaseClient();

  const updateFields: Record<string, unknown> = {};
  if (input.name !== undefined) updateFields.name = input.name;
  if (input.title !== undefined) updateFields.title = input.title;
  if (input.mobileEnc !== undefined) updateFields.mobile_enc = input.mobileEnc;
  if (input.email !== undefined) updateFields.email = input.email;
  if (input.decisionRole !== undefined) updateFields.decision_role = input.decisionRole;

  const { data, error: updateError } = await db
    .from('customer_contact')
    .update(updateFields)
    .eq('id', contactId)
    .eq('tenant_id', tenantId)
    .select('*')
    .limit(1);

  if (updateError) {
    throw new Error(`更新联系人失败: ${updateError.message}`);
  }

  return (data?.[0] as CustomerContactRow | undefined) ?? null;
}

export async function deleteContact(
  tenantId: string,
  contactId: string,
): Promise<boolean> {
  const db = getSupabaseClient();

  const { error: deleteError } = await db
    .from('customer_contact')
    .delete()
    .eq('id', contactId)
    .eq('tenant_id', tenantId);

  if (deleteError) {
    throw new Error(`删除联系人失败: ${deleteError.message}`);
  }

  return true;
}