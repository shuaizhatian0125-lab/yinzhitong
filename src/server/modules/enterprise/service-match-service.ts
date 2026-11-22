import { getSupabaseClient } from '@/storage/database/supabase-client';

export type FinancialDemand = {
  type: string;
  amountRange: string;
  urgency: 'high' | 'medium' | 'low';
};

export type BankProductRow = {
  id: string;
  tenant_id: string;
  name: string;
  category: string;
  description: string | null;
  target_industry: string[];
  min_amount: number | null;
  max_amount: number | null;
  rate_range: string | null;
  term_range: string | null;
  status: string;
};

export type ServiceMatchResultItem = {
  productId: string;
  productName: string;
  productCategory: string;
  description: string | null;
  matchScore: number;
  matchReason: string;
  priority: 'high' | 'medium' | 'low';
  rateRange: string | null;
  termRange: string | null;
};

const URGENCY_SCORE: Record<string, number> = {
  high: 100,
  medium: 70,
  low: 40,
};

const DEMAND_CATEGORY_MAP: Record<string, string[]> = {
  研发融资: ['研发贷款', '科技贷款', '创新融资'],
  扩产融资: ['固定资产贷款', '项目贷款', '设备融资'],
  结算需求: ['结算服务', '现金管理', '对公存款'],
  供应链金融: ['供应链融资', '保理', '应收账款融资'],
  国际化金融: ['跨境融资', '贸易融资', '外汇服务'],
};

function calculatePriority(score: number): 'high' | 'medium' | 'low' {
  if (score >= 80) return 'high';
  if (score >= 60) return 'medium';
  return 'low';
}

export async function matchServices(
  tenantId: string,
  enterpriseId: string,
  analysisId?: string,
): Promise<ServiceMatchResultItem[]> {
  const db = getSupabaseClient();

  const { data: entData } = await db
    .from('enterprise')
    .select('*')
    .eq('id', enterpriseId)
    .eq('tenant_id', tenantId)
    .is('deleted_at', null)
    .limit(1);

  const enterprise = entData?.[0];
  if (!enterprise) throw new Error('企业不存在');

  let demandsQuery = db
    .from('enterprise_analysis')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('enterprise_id', enterpriseId)
    .eq('type', 'financial_demand')
    .order('created_at', { ascending: false });

  if (analysisId) {
    demandsQuery = demandsQuery.eq('id', analysisId);
  }

  const { data: analysisData } = await demandsQuery.limit(1);

  const analysis = analysisData?.[0];
  if (!analysis) {
    return [];
  }

  const demands = (analysis.demands ?? []) as FinancialDemand[];
  if (demands.length === 0) {
    return [];
  }

  const { data: productData } = await db
    .from('bank_product')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('status', 'active');

  const products = (productData ?? []) as BankProductRow[];
  if (products.length === 0) {
    return [];
  }

  const results: ServiceMatchResultItem[] = [];
  const enterpriseIndustry = enterprise.industry as string | null;

  for (const demand of demands) {
    const urgencyScore = URGENCY_SCORE[demand.urgency] ?? 40;
    const targetCategories = DEMAND_CATEGORY_MAP[demand.type] ?? [];

    for (const product of products) {
      let matchScore = urgencyScore;
      const reasons: string[] = [];

      if (targetCategories.includes(product.category)) {
        matchScore += 20;
        reasons.push(`产品类别匹配需求类型（${demand.type}）`);
      } else {
        continue;
      }

      if (
        enterpriseIndustry &&
        product.target_industry &&
        product.target_industry.length > 0 &&
        product.target_industry.includes(enterpriseIndustry)
      ) {
        matchScore += 15;
        reasons.push(`产品目标行业匹配（${enterpriseIndustry}）`);
      }

      reasons.push(`需求紧迫度：${demand.urgency === 'high' ? '高' : demand.urgency === 'medium' ? '中' : '低'}`);

      matchScore = Math.min(matchScore, 100);

      results.push({
        productId: product.id,
        productName: product.name,
        productCategory: product.category,
        description: product.description,
        matchScore,
        matchReason: reasons.join('；'),
        priority: calculatePriority(matchScore),
        rateRange: product.rate_range,
        termRange: product.term_range,
      });
    }
  }

  results.sort((a, b) => b.matchScore - a.matchScore);

  const matchRecords = results.map((r) => ({
    id: crypto.randomUUID(),
    tenant_id: tenantId,
    enterprise_id: enterpriseId,
    analysis_id: analysis.id,
    product_id: r.productId,
    match_reason: r.matchReason,
    match_score: r.matchScore,
    priority: r.priority,
  }));

  if (matchRecords.length > 0) {
    await db.from('service_match_result').insert(matchRecords);
  }

  return results;
}