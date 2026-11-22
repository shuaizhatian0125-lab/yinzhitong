import { NextRequest } from 'next/server';
import { z } from 'zod';
import { success, error, ErrorCode, jsonResponse } from '@/lib/api-response';
import { getApiUser, unauthorizedResponse, forbiddenResponse } from '@/lib/api-auth';
import { getSupabaseClient } from '@/storage/database/supabase-client';
import { clearModuleCache } from '@/server/platform/module/registry';

const updateModuleSchema = z.object({
  modules: z.array(
    z.object({
      code: z.string().min(1).max(48),
      enabled: z.boolean(),
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

  const [{ data: modules }, { data: grants }] = await Promise.all([
    db.from('module_registry').select('*').order('sort', { ascending: true }),
    db.from('module_grant').select('module_code,enabled').eq('tenant_id', user.tenantId),
  ]);

  const grantMap = new Map<string, boolean>();
  if (grants) {
    for (const g of grants) {
      grantMap.set(g.module_code as string, g.enabled as boolean);
    }
  }

  const items = (modules ?? []).map((m) => {
    const code = m.code as string;
    const grantEnabled = grantMap.get(code);
    const enabled = grantEnabled !== undefined ? grantEnabled : (m.status as string) === 'active';
    return {
      code,
      name: m.name as string,
      route: m.route as string,
      icon: (m.icon as string) ?? null,
      sort: m.sort as number,
      tier: m.tier as string,
      dependsOn: (m.depends_on as string[]) ?? [],
      status: m.status as string,
      enabled,
    };
  });

  return jsonResponse(success({ items }));
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

  const parsed = updateModuleSchema.safeParse(body);
  if (!parsed.success) {
    return jsonResponse(
      error(ErrorCode.BAD_REQUEST, '参数校验失败', {
        issues: parsed.error.issues.map((i) => ({ path: i.path, message: i.message })),
      }),
      400,
    );
  }

  const db = await getSupabaseClient();

  for (const mod of parsed.data.modules) {
    const { data: existing } = await db
      .from('module_grant')
      .select('id')
      .eq('tenant_id', user.tenantId)
      .eq('module_code', mod.code)
      .limit(1);

    if (existing && existing.length > 0) {
      await db
        .from('module_grant')
        .update({ enabled: mod.enabled })
        .eq('id', existing[0].id as string);
    } else {
      await db.from('module_grant').insert({
        id: crypto.randomUUID(),
        tenant_id: user.tenantId,
        module_code: mod.code,
        enabled: mod.enabled,
      });
    }
  }

  clearModuleCache();

  const [{ data: modules }, { data: grants }] = await Promise.all([
    db.from('module_registry').select('*').order('sort', { ascending: true }),
    db.from('module_grant').select('module_code,enabled').eq('tenant_id', user.tenantId),
  ]);

  const grantMap = new Map<string, boolean>();
  if (grants) {
    for (const g of grants) {
      grantMap.set(g.module_code as string, g.enabled as boolean);
    }
  }

  const items = (modules ?? []).map((m) => {
    const code = m.code as string;
    const grantEnabled = grantMap.get(code);
    const enabled = grantEnabled !== undefined ? grantEnabled : (m.status as string) === 'active';
    return {
      code,
      name: m.name as string,
      route: m.route as string,
      icon: (m.icon as string) ?? null,
      sort: m.sort as number,
      tier: m.tier as string,
      dependsOn: (m.depends_on as string[]) ?? [],
      status: m.status as string,
      enabled,
    };
  });

  return jsonResponse(success({ items }));
}