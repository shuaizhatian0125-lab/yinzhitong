import { getSupabaseClient } from '@/storage/database/supabase-client';
import type { EnterpriseRow } from './enterprise-service';

export type DiscoveryFilter = {
  industry?: string;
  region?: string;
  techField?: string;
  scale?: string;
  page?: number;
  pageSize?: number;
};

export type DiscoveryResult = {
  id: string;
  name: string;
  industry: string | null;
  region: string | null;
  scale: string | null;
  matchScore: number;
  matchReason: string;
};

const SCORE_INDUSTRY = 40;
const SCORE_REGION = 20;
const SCORE_TECH_FIELD = 25;
const SCORE_SCALE = 15;

function calculateMatchScore(
  row: EnterpriseRow,
  filter: DiscoveryFilter,
): { score: number; reasons: string[] } {
  let score = 0;
  const reasons: string[] = [];

  if (filter.industry && row.industry === filter.industry) {
    score += SCORE_INDUSTRY;
    reasons.push(`行业匹配（${filter.industry}）`);
  }

  if (filter.region && row.region === filter.region) {
    score += SCORE_REGION;
    reasons.push(`区域匹配（${filter.region}）`);
  }

  if (filter.techField && row.tags && row.tags.includes(filter.techField)) {
    score += SCORE_TECH_FIELD;
    reasons.push(`技术领域匹配（${filter.techField}）`);
  }

  if (filter.scale && row.scale === filter.scale) {
    score += SCORE_SCALE;
    reasons.push(`企业规模匹配（${filter.scale}）`);
  }

  return { score, reasons };
}

export async function discoverEnterprises(
  tenantId: string,
  filter: DiscoveryFilter,
): Promise<{ items: DiscoveryResult[]; total: number }> {
  const db = getSupabaseClient();
  const page = filter.page ?? 1;
  const pageSize = filter.pageSize ?? 20;
  const offset = (page - 1) * pageSize;

  let query = db
    .from('enterprise')
    .select('*', { count: 'exact' })
    .eq('tenant_id', tenantId)
    .is('deleted_at', null);

  if (filter.industry) {
    query = query.eq('industry', filter.industry);
  }
  if (filter.region) {
    query = query.eq('region', filter.region);
  }
  if (filter.techField) {
    query = query.contains('tags', [filter.techField]);
  }
  if (filter.scale) {
    query = query.eq('scale', filter.scale);
  }

  query = query.order('updated_at', { ascending: false }).range(offset, offset + pageSize - 1);

  const { data, count } = await query;

  const rows = (data ?? []) as EnterpriseRow[];

  const items: DiscoveryResult[] = rows.map((row) => {
    const { score, reasons } = calculateMatchScore(row, filter);
    return {
      id: row.id,
      name: row.name,
      industry: row.industry,
      region: row.region,
      scale: row.scale,
      matchScore: score,
      matchReason: reasons.length > 0 ? reasons.join('；') : '基础匹配',
    };
  });

  items.sort((a, b) => b.matchScore - a.matchScore);

  return {
    items,
    total: count ?? 0,
  };
}