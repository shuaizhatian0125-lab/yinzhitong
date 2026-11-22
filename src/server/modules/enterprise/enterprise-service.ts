import { getSupabaseClient } from '@/storage/database/supabase-client';

export type EnterpriseFilter = {
  region?: string;
  industry?: string;
  techField?: string;
  isTech?: boolean;
  keyword?: string;
  page?: number;
  pageSize?: number;
};

export type EnterpriseRow = {
  id: string;
  tenant_id: string;
  name: string;
  unified_code: string | null;
  industry: string | null;
  scale: string | null;
  region: string | null;
  level: string | null;
  owner_id: string | null;
  risk_level: string;
  profile: Record<string, unknown>;
  tags: string[];
  created_at: string;
  updated_at: string;
};

export type EnterpriseProfile = {
  basicInfo: {
    name: string;
    unifiedCode: string;
    industry: string;
    scale: string;
    region: string;
    level: string;
    tags: string[];
  };
  industryStage: string;
  businessStatus: string;
  techAttributes: string;
  productCompetitiveness: string;
  growthPotential: string;
  marketSpace: string;
  financingStatus: string;
  enterpriseDynamics: string;
  riskAlerts: string;
  supplyChainPosition: string;
  competitors: string;
};

const PENDING_LABEL = '待补充';

function safeValue(value: unknown): string {
  if (value === null || value === undefined || value === '') return PENDING_LABEL;
  if (typeof value === 'string') return value;
  if (typeof value === 'number') return String(value);
  if (typeof value === 'boolean') return value ? '是' : '否';
  if (Array.isArray(value)) return value.length > 0 ? value.join(', ') : PENDING_LABEL;
  if (typeof value === 'object') return JSON.stringify(value);
  return PENDING_LABEL;
}

function buildProfile(row: EnterpriseRow): EnterpriseProfile {
  const profile = row.profile ?? {};
  return {
    basicInfo: {
      name: row.name,
      unifiedCode: safeValue(row.unified_code),
      industry: safeValue(row.industry),
      scale: safeValue(row.scale),
      region: safeValue(row.region),
      level: safeValue(row.level),
      tags: row.tags ?? [],
    },
    industryStage: safeValue(profile['industry_stage']),
    businessStatus: safeValue(profile['business_status']),
    techAttributes: safeValue(profile['tech_attributes']),
    productCompetitiveness: safeValue(profile['product_competitiveness']),
    growthPotential: safeValue(profile['growth_potential']),
    marketSpace: safeValue(profile['market_space']),
    financingStatus: safeValue(profile['financing_status']),
    enterpriseDynamics: safeValue(profile['enterprise_dynamics']),
    riskAlerts: safeValue(profile['risk_alerts']),
    supplyChainPosition: safeValue(profile['supply_chain_position']),
    competitors: safeValue(profile['competitors']),
  };
}

export async function searchEnterprises(
  tenantId: string,
  filter: EnterpriseFilter,
): Promise<{ items: EnterpriseRow[]; total: number }> {
  const db = getSupabaseClient();
  const page = filter.page ?? 1;
  const pageSize = filter.pageSize ?? 20;
  const offset = (page - 1) * pageSize;

  let query = db
    .from('enterprise')
    .select('*', { count: 'exact' })
    .eq('tenant_id', tenantId)
    .is('deleted_at', null);

  if (filter.region) {
    query = query.eq('region', filter.region);
  }
  if (filter.industry) {
    query = query.eq('industry', filter.industry);
  }
  if (filter.techField) {
    query = query.contains('tags', [filter.techField]);
  }
  if (filter.isTech !== undefined) {
    if (filter.isTech) {
      query = query.contains('tags', ['高新技术企业']);
    }
  }
  if (filter.keyword) {
    query = query.or(`name.ilike.%${filter.keyword}%,unified_code.ilike.%${filter.keyword}%`);
  }

  query = query.order('updated_at', { ascending: false }).range(offset, offset + pageSize - 1);

  const { data, count } = await query;

  return {
    items: (data ?? []) as EnterpriseRow[],
    total: count ?? 0,
  };
}

export async function getEnterprise(
  tenantId: string,
  enterpriseId: string,
): Promise<{ row: EnterpriseRow; profile: EnterpriseProfile } | null> {
  const db = getSupabaseClient();
  const { data } = await db
    .from('enterprise')
    .select('*')
    .eq('id', enterpriseId)
    .eq('tenant_id', tenantId)
    .is('deleted_at', null)
    .limit(1);

  const row = (data?.[0] as EnterpriseRow | undefined) ?? null;
  if (!row) return null;

  return {
    row,
    profile: buildProfile(row),
  };
}

export type EnterpriseCreateInput = {
  name: string;
  unifiedCode?: string;
  industry?: string;
  scale?: string;
  region?: string;
  level?: string;
  riskLevel?: string;
  profile?: Record<string, unknown>;
  tags?: string[];
};

export async function createEnterprise(
  tenantId: string,
  input: EnterpriseCreateInput,
): Promise<EnterpriseRow> {
  const db = getSupabaseClient();
  const id = crypto.randomUUID();
  const now = new Date().toISOString();

  const { data, error: insertError } = await db
    .from('enterprise')
    .insert({
      id,
      tenant_id: tenantId,
      name: input.name,
      unified_code: input.unifiedCode ?? null,
      industry: input.industry ?? null,
      scale: input.scale ?? null,
      region: input.region ?? null,
      level: input.level ?? null,
      risk_level: input.riskLevel ?? 'unknown',
      profile: input.profile ?? {},
      tags: input.tags ?? [],
      is_tech: input.tags?.includes('高新技术企业') ?? false,
      created_at: now,
      updated_at: now,
    })
    .select('*')
    .limit(1);

  if (insertError) {
    throw new Error(`创建企业档案失败: ${insertError.message}`);
  }

  return (data?.[0] as EnterpriseRow) ?? null;
}

export type EnterpriseUpdateInput = {
  name?: string;
  unifiedCode?: string;
  industry?: string;
  scale?: string;
  region?: string;
  level?: string;
  riskLevel?: string;
  profile?: Record<string, unknown>;
  tags?: string[];
  isTech?: boolean;
};

export async function updateEnterprise(
  tenantId: string,
  enterpriseId: string,
  input: EnterpriseUpdateInput,
): Promise<EnterpriseRow | null> {
  const db = getSupabaseClient();
  const now = new Date().toISOString();

  const updateData: Record<string, unknown> = {
    updated_at: now,
  };

  if (input.name !== undefined) updateData.name = input.name;
  if (input.unifiedCode !== undefined) updateData.unified_code = input.unifiedCode;
  if (input.industry !== undefined) updateData.industry = input.industry;
  if (input.scale !== undefined) updateData.scale = input.scale;
  if (input.region !== undefined) updateData.region = input.region;
  if (input.level !== undefined) updateData.level = input.level;
  if (input.riskLevel !== undefined) updateData.risk_level = input.riskLevel;
  if (input.profile !== undefined) updateData.profile = input.profile;
  if (input.tags !== undefined) updateData.tags = input.tags;
  if (input.isTech !== undefined) updateData.is_tech = input.isTech;

  const { data, error: updateError } = await db
    .from('enterprise')
    .update(updateData)
    .eq('id', enterpriseId)
    .eq('tenant_id', tenantId)
    .is('deleted_at', null)
    .select('*')
    .limit(1);

  if (updateError) {
    throw new Error(`更新企业档案失败: ${updateError.message}`);
  }

  return (data?.[0] as EnterpriseRow) ?? null;
}