import { NextRequest } from 'next/server';
import { z } from 'zod';
import { success, error, ErrorCode, jsonResponse } from '@/lib/api-response';
import { getApiUser, unauthorizedResponse, forbiddenResponse } from '@/lib/api-auth';
import { getSupabaseClient } from '@/storage/database/supabase-client';
import { invalidateBrandCache, defaultBrandConfig } from '@/server/platform/config/brand';

const brandSchema = z.object({
  productName: z.string().min(1).max(64),
  logo: z.string().max(255),
  systemTitle: z.string().min(1).max(128),
  brandColor: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  loginPageText: z.string().max(255),
  welcomeText: z.string().max(255),
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
    .from('config_item')
    .select('value')
    .eq('tenant_id', user.tenantId)
    .eq('key', 'brand')
    .limit(1);

  const raw = data?.[0]?.value as Record<string, unknown> | undefined;
  const config = {
    productName: (raw?.productName as string) ?? defaultBrandConfig.productName,
    logo: (raw?.logo as string) ?? defaultBrandConfig.logo,
    systemTitle: (raw?.systemTitle as string) ?? defaultBrandConfig.systemTitle,
    brandColor: (raw?.brandColor as string) ?? defaultBrandConfig.brandColor,
    loginPageText: (raw?.loginPageText as string) ?? defaultBrandConfig.loginPageText,
    welcomeText: (raw?.welcomeText as string) ?? defaultBrandConfig.welcomeText,
  };

  return jsonResponse(success(config));
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

  const parsed = brandSchema.safeParse(body);
  if (!parsed.success) {
    return jsonResponse(
      error(ErrorCode.BAD_REQUEST, '参数校验失败', {
        issues: parsed.error.issues.map((i) => ({ path: i.path, message: i.message })),
      }),
      400,
    );
  }

  const db = await getSupabaseClient();

  const { data: existing } = await db
    .from('config_item')
    .select('id')
    .eq('tenant_id', user.tenantId)
    .eq('key', 'brand')
    .limit(1);

  if (existing && existing.length > 0) {
    await db
      .from('config_item')
      .update({
        value: parsed.data,
        updated_by: user.id,
        updated_at: new Date().toISOString(),
      })
      .eq('id', existing[0].id as string);
  } else {
    await db.from('config_item').insert({
      id: crypto.randomUUID(),
      tenant_id: user.tenantId,
      key: 'brand',
      value: parsed.data,
      updated_by: user.id,
    });
  }

  invalidateBrandCache(user.tenantId);

  return jsonResponse(success(parsed.data));
}