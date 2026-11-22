import { getSupabaseClient } from '@/storage/database/supabase-client';
import type { SessionUser } from '@/lib/auth';

/* ============================================================
 * V2 类型定义
 * ============================================================ */

export type MemoryType =
  | 'SESSION'
  | 'CONVERSATION'
  | 'USER'
  | 'TASK'
  | 'ORGANIZATION'
  | 'KNOWLEDGE';

export type ScopeLevel =
  | 'SESSION'
  | 'CONVERSATION'
  | 'USER'
  | 'TASK'
  | 'TEAM'
  | 'DEPARTMENT'
  | 'ORGANIZATION'
  | 'TENANT';

export type SensitivityLevel = 'public' | 'internal' | 'confidential' | 'restricted';

export type MemoryStatus = 'active' | 'archived' | 'expired' | 'pending_review';

export type MemoryEntryV2 = {
  id: string;
  tenantId: string;
  userId?: string;
  memoryType: MemoryType;
  scopeLevel: ScopeLevel;
  key: string;
  content: string;
  importance: number;
  confidence: number;
  sensitivity: SensitivityLevel;
  status: MemoryStatus;
  expiresAt?: string;
  createdAt: string;
};

export type MemoryCandidate = {
  content: string;
  source: string;
  proposedType?: MemoryType;
  proposedScope?: ScopeLevel;
  proposedSensitivity?: SensitivityLevel;
};

export type MemoryQuery = {
  tenantId: string;
  userId?: string;
  scopeLevel?: ScopeLevel;
  memoryType?: MemoryType;
  keyword?: string;
  limit?: number;
};

export type MemoryWriteResult = {
  success: boolean;
  memoryId?: string;
  error?: string;
  requiresConfirmation?: boolean;
};

/* ============================================================
 * V1 兼容类型（保留向后兼容）
 * ============================================================ */

export type MemoryScope = 'conversation' | 'user' | 'working';

export type MemoryEntry = {
  id: string;
  scope: MemoryScope;
  key: string;
  content: string;
  importance: number;
  createdAt: string;
  expiresAt?: string;
};

export type ConversationMemory = {
  messages: ConversationMessage[];
  summary: string | null;
  tokenEstimate: number;
};

export type ConversationMessage = {
  role: 'user' | 'assistant' | 'system';
  content: string;
  createdAt: string;
};

/* ============================================================
 * 常量定义
 * ============================================================ */

const MAX_WINDOW_MESSAGES = 10;
const MAX_SUMMARY_LENGTH = 500;
const DEFAULT_TOKEN_BUDGET = 2000;

const SCOPE_LEVEL_ORDER: Record<ScopeLevel, number> = {
  SESSION: 0,
  CONVERSATION: 1,
  USER: 2,
  TASK: 3,
  TEAM: 4,
  DEPARTMENT: 5,
  ORGANIZATION: 6,
  TENANT: 7,
};

const USER_SCOPE_LEVEL: Record<string, ScopeLevel> = {
  admin: 'TENANT',
  dept_head: 'DEPARTMENT',
  team_lead: 'TEAM',
  staff: 'USER',
};

const SENSITIVITY_ORDER: Record<SensitivityLevel, number> = {
  public: 0,
  internal: 1,
  confidential: 2,
  restricted: 3,
};

const WRITE_POLICY: Record<SensitivityLevel, boolean> = {
  public: true,
  internal: true,
  confidential: false,
  restricted: false,
};

/* ============================================================
 * V2 写入流程（8步）
 * ============================================================ */

export async function writeMemory(
  candidate: MemoryCandidate,
  context: { tenantId: string; userId: string; userRole: string },
): Promise<MemoryWriteResult> {
  const classified = classifyMemory(candidate);
  const scoped = determineScope(classified, context.userRole);
  const sensitivity = determineSensitivity(classified, candidate.proposedSensitivity);

  if (!checkWritePolicy(sensitivity)) {
    return {
      success: false,
      requiresConfirmation: true,
      error: `敏感度 ${sensitivity} 需要用户确认后才能写入`,
    };
  }

  const db = await getSupabaseClient();
  const memoryId = crypto.randomUUID();

  await db.from('ai_memory').insert({
    id: memoryId,
    tenant_id: context.tenantId,
    user_id: context.userId,
    scope: scoped.scopeLevel.toLowerCase(),
    memory_type: scoped.memoryType,
    scope_level: scoped.scopeLevel,
    key: scoped.key,
    content: scoped.content,
    importance: scoped.importance,
    confidence: scoped.confidence,
    sensitivity,
    status: 'active',
    expires_at: scoped.expiresAt?.toISOString() ?? null,
  });

  return { success: true, memoryId };
}

function classifyMemory(candidate: MemoryCandidate): MemoryCandidate & {
  memoryType: MemoryType;
  key: string;
  importance: number;
  confidence: number;
} {
  const memoryType = candidate.proposedType ?? inferMemoryType(candidate.content);
  const key = `${memoryType.toLowerCase()}:${candidate.source}`;
  const importance = inferImportance(candidate.content);
  const confidence = inferConfidence(candidate.content);

  return {
    ...candidate,
    memoryType,
    key,
    importance,
    confidence,
  };
}

function inferMemoryType(content: string): MemoryType {
  if (content.includes('偏好') || content.includes('习惯') || content.includes('常用')) {
    return 'USER';
  }
  if (content.includes('任务') || content.includes('进度') || content.includes('中间结果')) {
    return 'TASK';
  }
  if (content.includes('团队') || content.includes('规范') || content.includes('业务规则')) {
    return 'ORGANIZATION';
  }
  if (content.includes('验证') || content.includes('事实') || content.includes('结论')) {
    return 'KNOWLEDGE';
  }
  if (content.includes('对话') || content.includes('摘要') || content.includes('历史')) {
    return 'CONVERSATION';
  }
  return 'SESSION';
}

function inferImportance(content: string): number {
  if (content.length > 500) return 5;
  if (content.length > 200) return 4;
  if (content.length > 50) return 3;
  return 2;
}

function inferConfidence(content: string): number {
  if (content.includes('确认') || content.includes('验证') || content.includes('事实')) return 90;
  if (content.includes('可能') || content.includes('推测')) return 50;
  return 70;
}

function determineScope(
  classified: MemoryCandidate & { memoryType: MemoryType; key: string; importance: number; confidence: number },
  userRole: string,
): MemoryCandidate & {
  memoryType: MemoryType;
  key: string;
  importance: number;
  confidence: number;
  scopeLevel: ScopeLevel;
  expiresAt?: Date;
} {
  const scopeLevel = classified.proposedScope ?? inferScopeLevel(classified.memoryType, userRole);
  const expiresAt = scopeLevel === 'SESSION' ? new Date(Date.now() + 3600_000) : undefined;

  return {
    ...classified,
    scopeLevel,
    expiresAt,
  };
}

function inferScopeLevel(memoryType: MemoryType, userRole: string): ScopeLevel {
  if (memoryType === 'SESSION') return 'SESSION';
  if (memoryType === 'CONVERSATION') return 'CONVERSATION';
  if (memoryType === 'USER') return 'USER';
  if (memoryType === 'TASK') return 'TASK';
  if (memoryType === 'ORGANIZATION') return 'ORGANIZATION';
  if (memoryType === 'KNOWLEDGE') return 'TENANT';
  return USER_SCOPE_LEVEL[userRole] ?? 'USER';
}

function determineSensitivity(
  classified: MemoryCandidate & { memoryType: MemoryType },
  proposed?: SensitivityLevel,
): SensitivityLevel {
  if (proposed) return proposed;

  if (classified.memoryType === 'KNOWLEDGE') return 'internal';
  if (classified.memoryType === 'ORGANIZATION') return 'internal';
  if (classified.memoryType === 'TASK') return 'internal';
  if (classified.memoryType === 'USER') return 'confidential';
  return 'public';
}

function checkWritePolicy(sensitivity: SensitivityLevel): boolean {
  return WRITE_POLICY[sensitivity];
}

/* ============================================================
 * V2 读取流程（8步）
 * ============================================================ */

export async function readMemory(
  query: MemoryQuery,
  user: SessionUser,
): Promise<MemoryEntryV2[]> {
  const userScopeLevel = USER_SCOPE_LEVEL[user.roleCode] ?? 'USER';
  const maxScopeOrder = SCOPE_LEVEL_ORDER[userScopeLevel];

  const db = await getSupabaseClient();

  let dbQuery = db.from('ai_memory')
    .select('id,tenant_id,user_id,scope,memory_type,scope_level,key,content,importance,confidence,sensitivity,status,expires_at,created_at')
    .eq('tenant_id', query.tenantId)
    .eq('status', 'active');

  if (query.userId) {
    dbQuery = dbQuery.eq('user_id', query.userId);
  }

  if (query.memoryType) {
    dbQuery = dbQuery.eq('memory_type', query.memoryType);
  }

  if (query.scopeLevel) {
    dbQuery = dbQuery.eq('scope_level', query.scopeLevel);
  }

  if (query.keyword) {
    dbQuery = dbQuery.or(`content.ilike.%${query.keyword}%,key.ilike.%${query.keyword}%`);
  }

  dbQuery = dbQuery.order('importance', { ascending: false })
    .limit(query.limit ?? 20);

  const { data } = await dbQuery;

  const allEntries: MemoryEntryV2[] = (data ?? []).map((row: Record<string, unknown>) => ({
    id: row.id as string,
    tenantId: row.tenant_id as string,
    userId: row.user_id as string | undefined,
    memoryType: (row.memory_type as MemoryType) ?? 'SESSION',
    scopeLevel: (row.scope_level as ScopeLevel) ?? 'CONVERSATION',
    key: row.key as string,
    content: row.content as string,
    importance: row.importance as number,
    confidence: (row.confidence as number) ?? 70,
    sensitivity: (row.sensitivity as SensitivityLevel) ?? 'public',
    status: (row.status as MemoryStatus) ?? 'active',
    expiresAt: row.expires_at as string | undefined,
    createdAt: row.created_at as string,
  }));

  const filtered = allEntries.filter((entry) => {
    const entryScopeOrder = SCOPE_LEVEL_ORDER[entry.scopeLevel] ?? 0;
    if (entryScopeOrder > maxScopeOrder) return false;

    const now = new Date();
    if (entry.expiresAt && new Date(entry.expiresAt) < now) return false;

    return true;
  });

  const sorted = filtered.sort((a, b) => {
    const scopeDiff = SCOPE_LEVEL_ORDER[b.scopeLevel] - SCOPE_LEVEL_ORDER[a.scopeLevel];
    if (scopeDiff !== 0) return scopeDiff;
    return b.importance - a.importance;
  });

  return applyTokenBudget(sorted, DEFAULT_TOKEN_BUDGET);
}

function applyTokenBudget(entries: MemoryEntryV2[], budget: number): MemoryEntryV2[] {
  let tokenCount = 0;
  const result: MemoryEntryV2[] = [];

  for (const entry of entries) {
    const entryTokens = Math.ceil(entry.content.length / 4);
    if (tokenCount + entryTokens > budget) break;
    tokenCount += entryTokens;
    result.push(entry);
  }

  return result;
}

export async function searchMemory(
  tenantId: string,
  keyword: string,
  user: SessionUser,
  limit?: number,
): Promise<MemoryEntryV2[]> {
  return readMemory({ tenantId, keyword, limit }, user);
}

export async function getMemoryByType(
  tenantId: string,
  memoryType: MemoryType,
  user: SessionUser,
  limit?: number,
): Promise<MemoryEntryV2[]> {
  return readMemory({ tenantId, memoryType, limit }, user);
}

export async function archiveMemory(memoryId: string): Promise<void> {
  const db = await getSupabaseClient();
  await db.from('ai_memory').update({ status: 'archived' }).eq('id', memoryId);
}

export async function deleteMemory(memoryId: string): Promise<void> {
  const db = await getSupabaseClient();
  await db.from('ai_memory').delete().eq('id', memoryId);
}

/* ============================================================
 * V1 兼容函数（保留向后兼容）
 * ============================================================ */

export async function getConversationMemory(
  conversationId: string,
  tenantId: string,
): Promise<ConversationMemory> {
  const db = await getSupabaseClient();

  const { data: messages } = await db.from('message')
    .select('id,role,content,created_at')
    .eq('conversation_id', conversationId)
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: true });

  const allMessages: ConversationMessage[] = (messages ?? []).map((m) => ({
    role: m.role as 'user' | 'assistant' | 'system',
    content: m.content as string,
    createdAt: m.created_at as string,
  }));

  const windowedMessages = allMessages.slice(-MAX_WINDOW_MESSAGES);

  const { data: summaryEntry } = await db.from('ai_memory')
    .select('content')
    .eq('tenant_id', tenantId)
    .eq('scope', 'conversation')
    .eq('key', `summary:${conversationId}`)
    .order('created_at', { ascending: false })
    .limit(1);

  const summary = summaryEntry?.[0]?.content as string | null;

  const tokenEstimate = windowedMessages.reduce((sum, m) => sum + Math.ceil(m.content.length / 4), 0);

  return {
    messages: windowedMessages,
    summary,
    tokenEstimate,
  };
}

export async function updateMemory(
  conversationId: string,
  tenantId: string,
  messages: ConversationMessage[],
): Promise<void> {
  const db = await getSupabaseClient();

  if (messages.length > MAX_WINDOW_MESSAGES) {
    const olderMessages = messages.slice(0, messages.length - MAX_WINDOW_MESSAGES);
    await generateAndUpdateSummary(conversationId, tenantId, olderMessages);
  }

  const existingSummary = await db.from('ai_memory')
    .select('content')
    .eq('tenant_id', tenantId)
    .eq('scope', 'conversation')
    .eq('key', `summary:${conversationId}`)
    .order('created_at', { ascending: false })
    .limit(1);

  const prevSummary = existingSummary.data?.[0]?.content as string | null;
  if (prevSummary) {
    await db.from('ai_memory').insert({
      id: crypto.randomUUID(),
      tenant_id: tenantId,
      scope: 'conversation',
      memory_type: 'CONVERSATION',
      scope_level: 'CONVERSATION',
      key: `summary:${conversationId}`,
      content: prevSummary,
      importance: 2,
      confidence: 70,
      sensitivity: 'internal',
      status: 'active',
    });
  }
}

async function generateAndUpdateSummary(
  conversationId: string,
  tenantId: string,
  olderMessages: ConversationMessage[],
): Promise<void> {
  const db = await getSupabaseClient();

  const { data: existingSummary } = await db.from('ai_memory')
    .select('content')
    .eq('tenant_id', tenantId)
    .eq('scope', 'conversation')
    .eq('key', `summary:${conversationId}`)
    .order('created_at', { ascending: false })
    .limit(1);

  const prevSummary = existingSummary?.[0]?.content as string | null;

  const messageText = olderMessages
    .map((m) => `[${m.role}]: ${m.content}`)
    .join('\n');

  const summaryContent = prevSummary
    ? `${prevSummary}\n---\n${messageText}`.slice(0, MAX_SUMMARY_LENGTH)
    : messageText.slice(0, MAX_SUMMARY_LENGTH);

  await db.from('ai_memory').insert({
    id: crypto.randomUUID(),
    tenant_id: tenantId,
    scope: 'conversation',
    memory_type: 'CONVERSATION',
    scope_level: 'CONVERSATION',
    key: `summary:${conversationId}`,
    content: summaryContent,
    importance: 3,
    confidence: 70,
    sensitivity: 'internal',
    status: 'active',
  });
}

export async function getUserMemory(
  userId: string,
  tenantId: string,
): Promise<MemoryEntry[]> {
  const db = await getSupabaseClient();
  const { data } = await db.from('ai_memory')
    .select('id,scope,key,content,importance,created_at,expires_at')
    .eq('tenant_id', tenantId)
    .eq('user_id', userId)
    .eq('scope', 'user')
    .eq('status', 'active')
    .order('importance', { ascending: false })
    .limit(20);

  return (data ?? []).map((row) => ({
    id: row.id as string,
    scope: 'user' as MemoryScope,
    key: row.key as string,
    content: row.content as string,
    importance: row.importance as number,
    createdAt: row.created_at as string,
    expiresAt: row.expires_at as string | undefined,
  }));
}

export async function setUserMemory(
  userId: string,
  tenantId: string,
  key: string,
  content: string,
  importance: number = 3,
): Promise<void> {
  const db = await getSupabaseClient();

  const { data: existing } = await db.from('ai_memory')
    .select('id')
    .eq('tenant_id', tenantId)
    .eq('user_id', userId)
    .eq('scope', 'user')
    .eq('key', key)
    .limit(1);

  if (existing && existing.length > 0) {
    await db.from('ai_memory')
      .update({ content, importance })
      .eq('id', existing[0].id as string);
  } else {
    await db.from('ai_memory').insert({
      id: crypto.randomUUID(),
      tenant_id: tenantId,
      user_id: userId,
      scope: 'user',
      memory_type: 'USER',
      scope_level: 'USER',
      key,
      content,
      importance,
      confidence: 70,
      sensitivity: 'confidential',
      status: 'active',
    });
  }
}

export async function getWorkingMemory(
  runId: string,
  tenantId: string,
): Promise<MemoryEntry[]> {
  const db = await getSupabaseClient();
  const { data } = await db.from('ai_memory')
    .select('id,scope,key,content,importance,created_at,expires_at')
    .eq('tenant_id', tenantId)
    .eq('scope', 'working')
    .eq('key', `run:${runId}`)
    .eq('status', 'active')
    .order('created_at', { ascending: true });

  return (data ?? []).map((row) => ({
    id: row.id as string,
    scope: 'working' as MemoryScope,
    key: row.key as string,
    content: row.content as string,
    importance: row.importance as number,
    createdAt: row.created_at as string,
    expiresAt: row.expires_at as string | undefined,
  }));
}

export async function setWorkingMemory(
  runId: string,
  tenantId: string,
  content: string,
  expiresAt?: Date,
): Promise<void> {
  const db = await getSupabaseClient();
  await db.from('ai_memory').insert({
    id: crypto.randomUUID(),
    tenant_id: tenantId,
    scope: 'working',
    memory_type: 'SESSION',
    scope_level: 'SESSION',
    key: `run:${runId}`,
    content,
    importance: 5,
    confidence: 70,
    sensitivity: 'internal',
    status: 'active',
    expires_at: expiresAt?.toISOString() ?? null,
  });
}

export async function clearWorkingMemory(runId: string, tenantId: string): Promise<void> {
  const db = await getSupabaseClient();
  await db.from('ai_memory')
    .delete()
    .eq('tenant_id', tenantId)
    .eq('scope', 'working')
    .eq('key', `run:${runId}`);
}

export async function buildContextForAgent(
  conversationId: string,
  user: SessionUser,
  runId?: string,
): Promise<{ systemContext: string; conversationMessages: ConversationMessage[] }> {
  const [conversationMemory, userMemory, workingMemory] = await Promise.all([
    getConversationMemory(conversationId, user.tenantId),
    getUserMemory(user.id, user.tenantId),
    runId ? getWorkingMemory(runId, user.tenantId) : Promise.resolve([]),
  ]);

  const systemParts: string[] = [];

  if (conversationMemory.summary) {
    systemParts.push(`会话摘要: ${conversationMemory.summary}`);
  }

  if (userMemory.length > 0) {
    const userPrefs = userMemory
      .filter((m) => m.key.startsWith('preference:'))
      .map((m) => `${m.key.replace('preference:', '')}: ${m.content}`)
      .join('; ');
    if (userPrefs) {
      systemParts.push(`用户偏好: ${userPrefs}`);
    }
  }

  if (workingMemory.length > 0) {
    const workingContext = workingMemory.map((m) => m.content).join('\n');
    systemParts.push(`当前任务上下文: ${workingContext}`);
  }

  return {
    systemContext: systemParts.join('\n\n'),
    conversationMessages: conversationMemory.messages,
  };
}