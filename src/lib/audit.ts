import { createHash } from 'node:crypto';
import { headers } from 'next/headers';
import { getSupabaseClient } from '@/storage/database/supabase-client';
import type { SessionUser } from '@/lib/auth';

type AuditEntry = {
  tenantId: string;
  user?: SessionUser | null;
  action: string;
  resourceType: string;
  resourceId?: string | null;
  detail?: Record<string, unknown>;
  result?: 'success' | 'failure';
  ip?: string | null;
};

type AuditDetailedEntry = {
  tenantId: string;
  user?: SessionUser | null;
  action: string;
  resourceType: string;
  resourceId?: string | null;
  before?: Record<string, unknown> | null;
  after?: Record<string, unknown> | null;
  result?: 'success' | 'failure';
  ip?: string | null;
};

/** 统一审计落库：任何写操作都必须调用 */
export async function writeAudit(entry: AuditEntry): Promise<void> {
  try {
    const db = await getSupabaseClient();
    let ip = entry.ip ?? null;
    if (!ip) {
      const hdrs = await headers();
      ip = (hdrs.get('x-forwarded-for') ?? '').split(',')[0].trim() || null;
    }
    await db.from('audit_log').insert({
      tenant_id: entry.tenantId,
      user_id: entry.user?.id ?? null,
      username: entry.user?.username ?? null,
      action: entry.action,
      resource_type: entry.resourceType,
      resource_id: entry.resourceId ?? null,
      detail: entry.detail ?? {},
      ip,
      result: entry.result ?? 'success',
    });
  } catch (error) {
    console.error('[audit] write failed', error);
  }
}

/** 获取上一条审计记录的 hash_current，用于构建哈希链 */
async function getPrevHash(db: Awaited<ReturnType<typeof getSupabaseClient>>, tenantId: string): Promise<string | null> {
  const { data } = await db
    .from('audit_log')
    .select('hash_current')
    .eq('tenant_id', tenantId)
    .order('id', { ascending: false })
    .limit(1);
  return (data?.[0]?.hash_current as string) ?? null;
}

/** 计算哈希链：hash_current = sha256(hash_prev + action + resource + timestamp) */
function computeHash(hashPrev: string | null, action: string, resource: string, timestamp: string): string {
  return createHash('sha256')
    .update(`${hashPrev ?? ''}${action}${resource}${timestamp}`)
    .digest('hex');
}

/** 增强审计落库：带 before/after 数据摘要和哈希链 */
export async function writeAuditDetailed(entry: AuditDetailedEntry): Promise<void> {
  try {
    const db = await getSupabaseClient();
    let ip = entry.ip ?? null;
    if (!ip) {
      const hdrs = await headers();
      ip = (hdrs.get('x-forwarded-for') ?? '').split(',')[0].trim() || null;
    }

    const hashPrev = await getPrevHash(db, entry.tenantId);
    const timestamp = new Date().toISOString();
    const resource = `${entry.resourceType}:${entry.resourceId ?? ''}`;
    const hashCurrent = computeHash(hashPrev, entry.action, resource, timestamp);

    await db.from('audit_log').insert({
      tenant_id: entry.tenantId,
      user_id: entry.user?.id ?? null,
      username: entry.user?.username ?? null,
      action: entry.action,
      resource_type: entry.resourceType,
      resource_id: entry.resourceId ?? null,
      before_data: entry.before ?? null,
      after_data: entry.after ?? null,
      hash_prev: hashPrev,
      hash_current: hashCurrent,
      ip,
      result: entry.result ?? 'success',
    });
  } catch (error) {
    console.error('[audit] write detailed failed', error);
  }
}
