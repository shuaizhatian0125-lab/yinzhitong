import { getSupabaseClient } from '@/storage/database/supabase-client';

export type ModuleInfo = {
  code: string;
  name: string;
  route: string;
  icon: string | null;
  sort: number;
  tier: string;
  dependsOn: string[];
  status: string;
};

const moduleCache = new Map<string, ModuleInfo>();
const enabledCache = new Map<string, boolean>();

/**
 * 检查指定租户的模块是否启用
 *
 * 逻辑：
 * 1. 查 module_grant 表，看租户是否有该模块的授权记录且 enabled=true
 * 2. 如果没有授权记录，查 module_registry 表的 status 是否为 active
 * 3. 模块关闭后返回 false
 */
export async function isModuleEnabled(tenantId: string, moduleCode: string): Promise<boolean> {
  const cacheKey = `${tenantId}:${moduleCode}`;
  const cached = enabledCache.get(cacheKey);
  if (cached !== undefined) return cached;

  const db = await getSupabaseClient();

  // 1. 查租户模块授权
  const { data: grant } = await db
    .from('module_grant')
    .select('enabled')
    .eq('tenant_id', tenantId)
    .eq('module_code', moduleCode)
    .limit(1);

  if (grant && grant.length > 0) {
    const enabled = grant[0].enabled as boolean;
    enabledCache.set(cacheKey, enabled);
    return enabled;
  }

  // 2. 无授权记录时，查模块注册表 status
  const info = await getModuleInfo(moduleCode);
  if (!info) {
    enabledCache.set(cacheKey, false);
    return false;
  }

  const enabled = info.status === 'active';
  enabledCache.set(cacheKey, enabled);
  return enabled;
}

/**
 * 获取指定租户所有已启用的模块列表
 */
export async function getEnabledModules(tenantId: string): Promise<ModuleInfo[]> {
  const db = await getSupabaseClient();

  // 查租户模块授权记录
  const { data: grants } = await db
    .from('module_grant')
    .select('module_code,enabled')
    .eq('tenant_id', tenantId);

  const grantMap = new Map<string, boolean>();
  if (grants) {
    for (const g of grants) {
      grantMap.set(g.module_code as string, g.enabled as boolean);
    }
  }

  // 查全部模块注册表
  const { data: modules } = await db
    .from('module_registry')
    .select('*')
    .order('sort');

  if (!modules) return [];

  const result: ModuleInfo[] = [];
  for (const m of modules) {
    const code = m.code as string;
    const grantEnabled = grantMap.get(code);

    // 有授权记录时以授权记录为准，无授权记录时以 registry status 为准
    const enabled = grantEnabled !== undefined ? grantEnabled : (m.status as string) === 'active';

    if (enabled) {
      result.push({
        code,
        name: m.name as string,
        route: m.route as string,
        icon: (m.icon as string) ?? null,
        sort: m.sort as number,
        tier: m.tier as string,
        dependsOn: (m.depends_on as string[]) ?? [],
        status: m.status as string,
      });
    }
  }

  return result;
}

/**
 * 获取单个模块的注册信息（带缓存）
 */
export async function getModuleInfo(moduleCode: string): Promise<ModuleInfo | null> {
  const cached = moduleCache.get(moduleCode);
  if (cached) return cached;

  const db = await getSupabaseClient();

  const { data } = await db
    .from('module_registry')
    .select('*')
    .eq('code', moduleCode)
    .limit(1);

  const row = data?.[0];
  if (!row) return null;

  const info: ModuleInfo = {
    code: row.code as string,
    name: row.name as string,
    route: row.route as string,
    icon: (row.icon as string) ?? null,
    sort: row.sort as number,
    tier: row.tier as string,
    dependsOn: (row.depends_on as string[]) ?? [],
    status: row.status as string,
  };

  moduleCache.set(moduleCode, info);
  return info;
}

/**
 * 清除模块缓存（模块配置变更时调用）
 */
export function clearModuleCache(): void {
  moduleCache.clear();
  enabledCache.clear();
}