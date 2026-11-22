import { getSupabaseClient } from '@/storage/database/supabase-client';
import { isDemoMode } from '@/lib/config';
import type { SessionUser } from '@/lib/auth';

export type Conversation = {
  id: string;
  tenantId: string;
  userId: string;
  title: string;
  agentCode: string;
  createdAt: string;
  updatedAt: string;
};

export type Message = {
  id: string;
  conversationId: string;
  role: string;
  content: string;
  model: string | null;
  tokens: number | null;
  createdAt: string;
};

type Row = Record<string, unknown>;

const demoConversations: Conversation[] = [];
const demoMessages: Message[] = [];

function toConversation(row: Row): Conversation {
  return {
    id: row.id as string,
    tenantId: row.tenant_id as string,
    userId: row.user_id as string,
    title: row.title as string,
    agentCode: row.agent_code as string,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

function toMessage(row: Row): Message {
  return {
    id: row.conversation_id as string,
    conversationId: row.conversation_id as string,
    role: row.role as string,
    content: row.content as string,
    model: (row.model as string) ?? null,
    tokens: (row.tokens as number) ?? null,
    createdAt: row.created_at as string,
  };
}

export async function createConversation(
  user: SessionUser,
  input: { title?: string; agentCode?: string },
): Promise<Conversation> {
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  const conversation: Conversation = {
    id,
    tenantId: user.tenantId,
    userId: user.id,
    title: input.title ?? '新会话',
    agentCode: input.agentCode ?? 'assistant',
    createdAt: now,
    updatedAt: now,
  };

  if (isDemoMode) {
    demoConversations.unshift(conversation);
    return conversation;
  }

  const db = await getSupabaseClient();
  const { data, error } = await db.from('conversation').insert({
    id,
    tenant_id: user.tenantId,
    user_id: user.id,
    title: input.title ?? '新会话',
    agent_code: input.agentCode ?? 'assistant',
    created_at: now,
    updated_at: now,
  }).select('*').single();

  if (error) throw new Error(`创建会话失败：${error.message}`);
  return toConversation(data as Row);
}

export async function listConversations(
  user: SessionUser,
  filter: { limit?: number } = {},
): Promise<Conversation[]> {
  if (isDemoMode) {
    return demoConversations
      .filter((c) => c.tenantId === user.tenantId && c.userId === user.id)
      .slice(0, filter.limit ?? 50);
  }

  const db = await getSupabaseClient();
  const { data, error } = await db.from('conversation')
    .select('*')
    .eq('tenant_id', user.tenantId)
    .eq('user_id', user.id)
    .order('updated_at', { ascending: false })
    .limit(filter.limit ?? 50);

  if (error) throw new Error(`查询会话列表失败：${error.message}`);
  return (data ?? []).map((row) => toConversation(row as Row));
}

export async function getConversation(
  user: SessionUser,
  conversationId: string,
): Promise<Conversation | null> {
  if (isDemoMode) {
    return demoConversations.find(
      (c) => c.id === conversationId && c.tenantId === user.tenantId && c.userId === user.id,
    ) ?? null;
  }

  const db = await getSupabaseClient();
  const { data } = await db.from('conversation')
    .select('*')
    .eq('id', conversationId)
    .eq('tenant_id', user.tenantId)
    .eq('user_id', user.id)
    .limit(1);

  const row = data?.[0];
  if (!row) return null;
  return toConversation(row as Row);
}

export async function deleteConversation(
  user: SessionUser,
  conversationId: string,
): Promise<void> {
  if (isDemoMode) {
    const idx = demoConversations.findIndex(
      (c) => c.id === conversationId && c.tenantId === user.tenantId && c.userId === user.id,
    );
    if (idx >= 0) demoConversations.splice(idx, 1);
    for (let i = demoMessages.length - 1; i >= 0; i--) {
      if (demoMessages[i].conversationId === conversationId) {
        demoMessages.splice(i, 1);
      }
    }
    return;
  }

  const db = await getSupabaseClient();

  await db.from('message')
    .delete()
    .eq('conversation_id', conversationId)
    .eq('tenant_id', user.tenantId);

  const { error } = await db.from('conversation')
    .delete()
    .eq('id', conversationId)
    .eq('tenant_id', user.tenantId)
    .eq('user_id', user.id);

  if (error) throw new Error(`删除会话失败：${error.message}`);
}

export async function addMessage(
  user: SessionUser,
  conversationId: string,
  input: { role: string; content: string; model?: string; tokens?: number },
): Promise<Message> {
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  const message: Message = {
    id,
    conversationId,
    role: input.role,
    content: input.content,
    model: input.model ?? null,
    tokens: input.tokens ?? null,
    createdAt: now,
  };

  if (isDemoMode) {
    demoMessages.push(message);
    const conv = demoConversations.find((c) => c.id === conversationId);
    if (conv) conv.updatedAt = now;
    return message;
  }

  const db = await getSupabaseClient();
  const { data, error } = await db.from('message').insert({
    id,
    tenant_id: user.tenantId,
    conversation_id: conversationId,
    role: input.role,
    content: input.content,
    model: input.model ?? null,
    tokens: input.tokens ?? null,
    created_at: now,
  }).select('*').single();

  if (error) throw new Error(`添加消息失败：${error.message}`);

  await db.from('conversation')
    .update({ updated_at: now })
    .eq('id', conversationId)
    .eq('tenant_id', user.tenantId);

  return toMessage(data as Row);
}

export async function listMessages(
  user: SessionUser,
  conversationId: string,
): Promise<Message[]> {
  if (isDemoMode) {
    return demoMessages
      .filter((m) => m.conversationId === conversationId)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  }

  const db = await getSupabaseClient();
  const { data, error } = await db.from('message')
    .select('*')
    .eq('conversation_id', conversationId)
    .eq('tenant_id', user.tenantId)
    .order('created_at', { ascending: true });

  if (error) throw new Error(`查询消息列表失败：${error.message}`);
  return (data ?? []).map((row) => toMessage(row as Row));
}