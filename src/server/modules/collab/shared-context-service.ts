import { getSupabaseClient } from '@/storage/database/supabase-client';
import type { SessionUser } from '@/lib/auth';

export type ContextType =
  | 'GOAL'
  | 'SCOPE'
  | 'FACT'
  | 'ASSUMPTION'
  | 'DECISION'
  | 'CONSTRAINT'
  | 'DATA'
  | 'FINDING'
  | 'ARTIFACT_REF';

export type ContextStatus = 'ACTIVE' | 'SUPERSEDED' | 'CONFLICT';

export type ConfidenceLevel = 'HIGH' | 'MEDIUM' | 'LOW';

export type SensitivityLevel = 'public' | 'internal' | 'confidential' | 'restricted';

export type SharedContext = {
  id: string;
  tenantId: string;
  collaborationId: string;
  contextType: ContextType;
  content: string;
  confidence: ConfidenceLevel;
  confidenceScore: number;
  source: string | null;
  sensitivity: SensitivityLevel;
  status: ContextStatus;
  createdBy: string | null;
  createdAt: string;
};

const CONFIDENCE_REQUIREMENTS: Record<ContextType, { min: number; level: ConfidenceLevel }> = {
  FACT: { min: 0.9, level: 'HIGH' },
  CONSTRAINT: { min: 0.9, level: 'HIGH' },
  GOAL: { min: 0.8, level: 'HIGH' },
  SCOPE: { min: 0.8, level: 'HIGH' },
  DECISION: { min: 0.8, level: 'HIGH' },
  ARTIFACT_REF: { min: 0.8, level: 'HIGH' },
  ASSUMPTION: { min: 0.5, level: 'MEDIUM' },
  DATA: { min: 0.5, level: 'MEDIUM' },
  FINDING: { min: 0.5, level: 'MEDIUM' },
};

export function getConfidenceRequirement(contextType: ContextType): { min: number; level: ConfidenceLevel } {
  return CONFIDENCE_REQUIREMENTS[contextType];
}

export function validateConfidence(contextType: ContextType, confidenceScore: number): boolean {
  const req = CONFIDENCE_REQUIREMENTS[contextType];
  return confidenceScore >= req.min;
}

export async function addContext(
  tenantId: string,
  collaborationId: string,
  contextType: ContextType,
  content: string,
  options?: {
    confidenceScore?: number;
    source?: string;
    sensitivity?: SensitivityLevel;
    createdBy?: string;
  },
): Promise<SharedContext> {
  const db = await getSupabaseClient();

  const req = CONFIDENCE_REQUIREMENTS[contextType];
  const confidenceScore = options?.confidenceScore ?? req.min;
  const confidence = confidenceScore >= 0.8 ? 'HIGH' : confidenceScore >= 0.5 ? 'MEDIUM' : 'LOW';

  if (!validateConfidence(contextType, confidenceScore)) {
    throw new Error(`${contextType} 类型要求可信度 ≥ ${req.min}，当前 ${confidenceScore}`);
  }

  const id = crypto.randomUUID();
  const now = new Date().toISOString();

  const { data, error } = await db.from('collaboration_context').insert({
    id,
    tenant_id: tenantId,
    collaboration_id: collaborationId,
    context_type: contextType,
    content,
    confidence,
    source: options?.source ?? null,
    sensitivity: options?.sensitivity ?? 'internal',
    created_by: options?.createdBy ?? null,
    created_at: now,
  }).select('*').limit(1);

  if (error || !data?.[0]) {
    throw new Error(`添加 Context 失败: ${error?.message ?? '未知错误'}`);
  }

  const context = mapRowToContext(data[0] as Record<string, unknown>);

  await detectConflict(tenantId, collaborationId, context);

  return context;
}

export async function listContext(
  tenantId: string,
  collaborationId: string,
  filter?: {
    contextType?: ContextType;
    minConfidence?: number;
    status?: ContextStatus;
  },
): Promise<SharedContext[]> {
  const db = await getSupabaseClient();

  let query = db.from('collaboration_context')
    .select('*')
    .eq('collaboration_id', collaborationId)
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false });

  if (filter?.contextType) {
    query = query.eq('context_type', filter.contextType);
  }
  if (filter?.status) {
    query = query.eq('status', filter.status);
  }

  const { data } = await query;

  let contexts = (data ?? []).map(row => mapRowToContext(row as Record<string, unknown>));

  if (filter?.minConfidence !== undefined) {
    contexts = contexts.filter(c => c.confidenceScore >= filter.minConfidence!);
  }

  return contexts;
}

export async function getContext(
  tenantId: string,
  contextId: string,
): Promise<SharedContext | null> {
  const db = await getSupabaseClient();
  const { data } = await db.from('collaboration_context')
    .select('*')
    .eq('id', contextId)
    .eq('tenant_id', tenantId)
    .limit(1);

  if (!data?.[0]) return null;
  return mapRowToContext(data[0] as Record<string, unknown>);
}

export async function updateContextStatus(
  tenantId: string,
  contextId: string,
  status: ContextStatus,
): Promise<void> {
  const db = await getSupabaseClient();
  await db.from('collaboration_context')
    .update({ status })
    .eq('id', contextId)
    .eq('tenant_id', tenantId);
}

export async function supersedeContext(
  tenantId: string,
  oldContextId: string,
  newContextId: string,
): Promise<void> {
  const db = await getSupabaseClient();
  await db.from('collaboration_context')
    .update({ status: 'SUPERSEDED' })
    .eq('id', oldContextId)
    .eq('tenant_id', tenantId);
}

export async function detectConflict(
  tenantId: string,
  collaborationId: string,
  newContext: SharedContext,
): Promise<string | null> {
  const db = await getSupabaseClient();

  const { data: existing } = await db.from('collaboration_context')
    .select('id,content,confidence')
    .eq('collaboration_id', collaborationId)
    .eq('tenant_id', tenantId)
    .eq('context_type', newContext.contextType)
    .eq('status', 'ACTIVE')
    .neq('id', newContext.id);

  if (!existing || existing.length === 0) return null;

  for (const ctx of existing) {
    const existingContent = ctx.content as string;
    if (isContentContradictory(existingContent, newContext.content)) {
      const conflictId = crypto.randomUUID();
      await db.from('collaboration_conflicts').insert({
        id: conflictId,
        tenant_id: tenantId,
        collaboration_id: collaborationId,
        type: 'DATA_CONFLICT',
        description: `${newContext.contextType} 类型 Context 内容矛盾: "${newContext.content}" vs "${existingContent}"`,
        context_ids: [newContext.id, ctx.id as string],
        severity: newContext.contextType === 'FACT' || newContext.contextType === 'CONSTRAINT' ? 'high' : 'medium',
        status: 'open',
      });

      await db.from('collaboration_context')
        .update({ status: 'CONFLICT' })
        .eq('id', newContext.id)
        .eq('tenant_id', tenantId);

      await db.from('collaboration_context')
        .update({ status: 'CONFLICT' })
        .eq('id', ctx.id as string)
        .eq('tenant_id', tenantId);

      return conflictId;
    }
  }

  return null;
}

function isContentContradictory(contentA: string, contentB: string): boolean {
  if (contentA === contentB) return false;
  if (contentA.trim() === contentB.trim()) return false;

  const negatePatterns = [/不|非|否|无|没有|排除|拒绝/i, /not|no|never|exclude|reject/i];
  const aHasNegate = negatePatterns.some(p => p.test(contentA));
  const bHasNegate = negatePatterns.some(p => p.test(contentB));

  if (aHasNegate !== bHasNegate) {
    const baseA = contentA.replace(/不|非|否|无|没有|排除|拒绝|not|no|never|exclude|reject/gi, '').trim();
    const baseB = contentB.replace(/不|非|否|无|没有|排除|拒绝|not|no|never|exclude|reject/gi, '').trim();
    if (baseA === baseB) return true;
  }

  return false;
}

export async function checkContextPermission(
  user: SessionUser,
  collaborationId: string,
  sensitivity: SensitivityLevel,
): Promise<boolean> {
  if (sensitivity === 'public') return true;
  if (sensitivity === 'internal') return true;

  if (sensitivity === 'confidential') {
    return user.roleCode === 'admin' || user.roleCode === 'dept_head' || user.roleCode === 'team_lead';
  }

  if (sensitivity === 'restricted') {
    return user.roleCode === 'admin';
  }

  return false;
}

function mapRowToContext(row: Record<string, unknown>): SharedContext {
  const confidence = row.confidence as string;
  const confidenceScore = confidence === 'HIGH' ? 0.9 : confidence === 'MEDIUM' ? 0.6 : 0.3;

  return {
    id: row.id as string,
    tenantId: row.tenant_id as string,
    collaborationId: row.collaboration_id as string,
    contextType: row.context_type as ContextType,
    content: row.content as string,
    confidence: confidence as ConfidenceLevel,
    confidenceScore,
    source: row.source as string | null,
    sensitivity: row.sensitivity as SensitivityLevel,
    status: (row.status as ContextStatus) ?? 'ACTIVE',
    createdBy: row.created_by as string | null,
    createdAt: row.created_at as string,
  };
}