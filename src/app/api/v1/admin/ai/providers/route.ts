import { NextRequest } from 'next/server';
import { z } from 'zod';
import { success, error, ErrorCode, jsonResponse } from '@/lib/api-response';
import { getApiUser, unauthorizedResponse, forbiddenResponse } from '@/lib/api-auth';
import { getSupabaseClient } from '@/storage/database/supabase-client';

const updateProviderSchema = z.object({
  providers: z.array(
    z.object({
      id: z.string().optional(),
      name: z.string().min(1).max(64),
      kind: z.string().min(1).max(32),
      baseUrl: z.string().url(),
      apiKeyEnc: z.string().optional(),
      models: z.array(z.unknown()).default([]),
      capabilities: z.array(z.string()).default(['chat']),
      priority: z.number().int().min(0).max(999).default(100),
      status: z.enum(['active', 'inactive']).default('active'),
    }),
  ),
});

function requireAdmin(user: { permissions: string[] } | null): boolean {
  if (!user) return false;
  return user.permissions.includes('*') || user.permissions.includes('admin');
}

export async function GET(request: NextRequest): Promise<Response> {
  const user = await getApiUser(request);
  if (!user) return unauthorizedResponse();
  if (!requireAdmin(user)) return forbiddenResponse();

  const db = await getSupabaseClient();
  const { data } = await db
    .from('ai_provider')
    .select('*')
    .eq('tenant_id', user.tenantId)
    .order('priority', { ascending: true });

  return jsonResponse(success({ items: data ?? [] }));
}

export async function PUT(request: NextRequest): Promise<Response> {
  const user = await getApiUser(request);
  if (!user) return unauthorizedResponse();
  if (!requireAdmin(user)) return forbiddenResponse();

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonResponse(error(ErrorCode.BAD_REQUEST, '请求体格式错误'), 400);
  }

  const parsed = updateProviderSchema.safeParse(body);
  if (!parsed.success) {
    return jsonResponse(
      error(ErrorCode.BAD_REQUEST, '参数校验失败', {
        issues: parsed.error.issues.map((i) => ({ path: i.path, message: i.message })),
      }),
      400,
    );
  }

  const db = await getSupabaseClient();

  for (const provider of parsed.data.providers) {
    if (provider.id) {
      await db
        .from('ai_provider')
        .update({
          name: provider.name,
          kind: provider.kind,
          base_url: provider.baseUrl,
          api_key_enc: provider.apiKeyEnc,
          models: provider.models,
          capabilities: provider.capabilities,
          priority: provider.priority,
          status: provider.status,
        })
        .eq('id', provider.id)
        .eq('tenant_id', user.tenantId);
    } else {
      await db.from('ai_provider').insert({
        id: crypto.randomUUID(),
        tenant_id: user.tenantId,
        name: provider.name,
        kind: provider.kind,
        base_url: provider.baseUrl,
        api_key_enc: provider.apiKeyEnc,
        models: provider.models,
        capabilities: provider.capabilities,
        priority: provider.priority,
        status: provider.status,
      });
    }
  }

  const { data } = await db
    .from('ai_provider')
    .select('*')
    .eq('tenant_id', user.tenantId)
    .order('priority', { ascending: true });

  return jsonResponse(success({ items: data ?? [] }));
}