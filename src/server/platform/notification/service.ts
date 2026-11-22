import { randomUUID } from 'node:crypto';
import { getSupabaseClient } from '@/storage/database/supabase-client';

export type NotificationType =
  | 'task_assigned'
  | 'task_overdue'
  | 'approval_pending'
  | 'risk_alert'
  | 'ai_completed'
  | 'system_notice';

export type Notification = {
  id: string;
  tenantId: string;
  userId: string;
  type: NotificationType;
  title: string;
  body: string | null;
  link: string | null;
  readAt: string | null;
  createdAt: string;
};

export type NotificationFilter = {
  unread?: boolean;
  type?: NotificationType;
  limit?: number;
};

export async function createNotification(
  tenantId: string,
  userId: string,
  type: NotificationType,
  title: string,
  content: string,
  resourceId?: string,
): Promise<Notification | null> {
  const db = await getSupabaseClient();
  const id = randomUUID();
  const link = resourceId ? `/${type.split('_')[0]}/${resourceId}` : null;

  const { data, error } = await db
    .from('notification')
    .insert({
      id,
      tenant_id: tenantId,
      user_id: userId,
      type,
      title,
      body: content,
      link,
    })
    .select('*')
    .limit(1);

  if (error || !data?.[0]) return null;

  const row = data[0] as Record<string, unknown>;
  return {
    id: row.id as string,
    tenantId: row.tenant_id as string,
    userId: row.user_id as string,
    type: row.type as NotificationType,
    title: row.title as string,
    body: (row.body as string) ?? null,
    link: (row.link as string) ?? null,
    readAt: (row.read_at as string) ?? null,
    createdAt: row.created_at as string,
  };
}

export async function listNotifications(
  userId: string,
  filter?: NotificationFilter,
): Promise<Notification[]> {
  const db = await getSupabaseClient();
  let query = db
    .from('notification')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (filter?.unread) {
    query = query.is('read_at', null);
  }
  if (filter?.type) {
    query = query.eq('type', filter.type);
  }
  if (filter?.limit) {
    query = query.limit(filter.limit);
  }

  const { data } = await query;

  return (data ?? []).map((row) => ({
    id: row.id as string,
    tenantId: row.tenant_id as string,
    userId: row.user_id as string,
    type: row.type as NotificationType,
    title: row.title as string,
    body: (row.body as string) ?? null,
    link: (row.link as string) ?? null,
    readAt: (row.read_at as string) ?? null,
    createdAt: row.created_at as string,
  }));
}

export async function markAsRead(notificationId: string): Promise<boolean> {
  const db = await getSupabaseClient();
  const { error } = await db
    .from('notification')
    .update({ read_at: new Date().toISOString() })
    .eq('id', notificationId)
    .is('read_at', null);

  return !error;
}

export async function getUnreadCount(userId: string): Promise<number> {
  const db = await getSupabaseClient();
  const { count } = await db
    .from('notification')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .is('read_at', null);

  return count ?? 0;
}