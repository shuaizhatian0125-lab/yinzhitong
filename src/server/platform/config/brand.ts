import { getSupabaseClient } from '@/storage/database/supabase-client';

export type BrandConfig = {
  productName: string;
  logo: string;
  systemTitle: string;
  brandColor: string;
  loginPageText: string;
  welcomeText: string;
};

export const defaultBrandConfig: BrandConfig = {
  productName: '银智通',
  logo: '/logo.svg',
  systemTitle: '银智通 · Bank AI OS',
  brandColor: '#1a56db',
  loginPageText: '欢迎使用银智通智能银行工作台',
  welcomeText: '让银行业务更智能、更高效',
};

type CacheEntry = {
  config: BrandConfig;
  expiresAt: number;
};

const cache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 5 * 60 * 1000;

export async function getBrandConfig(tenantId: string): Promise<BrandConfig> {
  const cached = cache.get(tenantId);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.config;
  }

  try {
    const db = await getSupabaseClient();
    const { data } = await db
      .from('config_item')
      .select('value')
      .eq('tenant_id', tenantId)
      .eq('key', 'brand')
      .limit(1);

    const raw = data?.[0]?.value as Record<string, unknown> | undefined;
    const config: BrandConfig = {
      productName: (raw?.productName as string) ?? defaultBrandConfig.productName,
      logo: (raw?.logo as string) ?? defaultBrandConfig.logo,
      systemTitle: (raw?.systemTitle as string) ?? defaultBrandConfig.systemTitle,
      brandColor: (raw?.brandColor as string) ?? defaultBrandConfig.brandColor,
      loginPageText: (raw?.loginPageText as string) ?? defaultBrandConfig.loginPageText,
      welcomeText: (raw?.welcomeText as string) ?? defaultBrandConfig.welcomeText,
    };

    cache.set(tenantId, { config, expiresAt: Date.now() + CACHE_TTL_MS });
    return config;
  } catch {
    return defaultBrandConfig;
  }
}

export function invalidateBrandCache(tenantId: string): void {
  cache.delete(tenantId);
}