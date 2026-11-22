import { randomUUID } from 'node:crypto';
import { getSupabaseClient } from '@/storage/database/supabase-client';

export type JobStatus = 'queued' | 'running' | 'succeeded' | 'failed' | 'cancelled';

export type JobRecord = {
  id: string;
  tenantId: string;
  kind: string;
  status: JobStatus;
  payload: Record<string, unknown>;
  result: Record<string, unknown> | null;
  progress: number;
  error: string | null;
  createdBy: string | null;
  startedAt: string | null;
  finishedAt: string | null;
  createdAt: string;
};

export type JobFilter = {
  status?: JobStatus;
  kind?: string;
  limit?: number;
  offset?: number;
};

function mapRow(row: Record<string, unknown>): JobRecord {
  return {
    id: row.id as string,
    tenantId: row.tenant_id as string,
    kind: row.kind as string,
    status: row.status as JobStatus,
    payload: (row.payload as Record<string, unknown>) ?? {},
    result: (row.result as Record<string, unknown>) ?? null,
    progress: (row.progress as number) ?? 0,
    error: (row.error as string) ?? null,
    createdBy: (row.created_by as string) ?? null,
    startedAt: (row.started_at as string) ?? null,
    finishedAt: (row.finished_at as string) ?? null,
    createdAt: row.created_at as string,
  };
}

export async function createJob(
  tenantId: string,
  kind: string,
  payload: Record<string, unknown>,
  createdBy?: string,
): Promise<JobRecord> {
  const db = await getSupabaseClient();
  const id = randomUUID();

  const { data, error: dbError } = await db
    .from('job')
    .insert({
      id,
      tenant_id: tenantId,
      kind,
      status: 'queued',
      payload,
      progress: 0,
      created_by: createdBy ?? null,
    })
    .select('*')
    .limit(1);

  if (dbError || !data || data.length === 0) {
    throw new Error(`Failed to create job: ${dbError?.message ?? 'unknown error'}`);
  }

  return mapRow(data[0]);
}

export async function getJobStatus(jobId: string, tenantId: string): Promise<JobRecord | null> {
  const db = await getSupabaseClient();
  const { data } = await db
    .from('job')
    .select('*')
    .eq('id', jobId)
    .eq('tenant_id', tenantId)
    .limit(1);

  if (!data || data.length === 0) return null;
  return mapRow(data[0]);
}

export async function updateJobStatus(
  jobId: string,
  status: JobStatus,
  result?: Record<string, unknown>,
  error?: string,
  progress?: number,
): Promise<void> {
  const db = await getSupabaseClient();
  const updates: Record<string, unknown> = { status };

  if (status === 'running' && !updates.started_at) {
    updates.started_at = new Date().toISOString();
  }
  if (status === 'succeeded' || status === 'failed' || status === 'cancelled') {
    updates.finished_at = new Date().toISOString();
  }
  if (result !== undefined) {
    updates.result = result;
  }
  if (error !== undefined) {
    updates.error = error;
  }
  if (progress !== undefined) {
    updates.progress = progress;
  }

  await db.from('job').update(updates).eq('id', jobId);
}

export async function listJobs(
  tenantId: string,
  filter?: JobFilter,
): Promise<{ items: JobRecord[]; total: number }> {
  const db = await getSupabaseClient();
  let query = db.from('job').select('*').eq('tenant_id', tenantId);

  if (filter?.status) {
    query = query.eq('status', filter.status);
  }
  if (filter?.kind) {
    query = query.eq('kind', filter.kind);
  }

  query = query.order('created_at', { ascending: false });

  const limit = filter?.limit ?? 50;
  const offset = filter?.offset ?? 0;
  query = query.range(offset, offset + limit - 1);

  const { data, error: dbError } = await query;

  if (dbError) {
    throw new Error(`Failed to list jobs: ${dbError.message}`);
  }

  const items = (data ?? []).map(mapRow);

  let totalQuery = db
    .from('job')
    .select('id', { count: 'exact', head: true })
    .eq('tenant_id', tenantId);

  if (filter?.status) {
    totalQuery = totalQuery.eq('status', filter.status);
  }
  if (filter?.kind) {
    totalQuery = totalQuery.eq('kind', filter.kind);
  }

  const { count } = await totalQuery;

  return { items, total: count ?? items.length };
}