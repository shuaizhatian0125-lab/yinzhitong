import { getSupabaseClient } from '@/storage/database/supabase-client';
import { getGateway, type ChatMessage } from '@/server/ai/gateway';
import type { EnterpriseRow, EnterpriseProfile } from './enterprise-service';

export type AnalysisType = 'tech_innovation' | 'growth_potential' | 'financial_demand';

export type FinancialDemandItem = {
  type: string;
  amountRange: string;
  urgency: 'high' | 'medium' | 'low';
};

export type AnalysisResult = {
  id: string;
  enterpriseId: string;
  type: AnalysisType;
  summary: string;
  scores: Record<string, unknown>;
  evidence: Array<{
    finding: string;
    source: string;
    confidence: 'high' | 'medium' | 'low';
  }>;
  demands: FinancialDemandItem[];
  aiRunId: string | null;
  createdAt: string;
};

type AnalysisRow = {
  id: string;
  tenant_id: string;
  enterprise_id: string;
  type: string;
  ai_run_id: string | null;
  summary: string;
  scores: Record<string, unknown>;
  evidence: unknown[];
  demands: unknown[];
  report_content: Record<string, unknown>;
  doc_id: string | null;
  created_by: string | null;
  created_at: string;
};

function rowToResult(row: AnalysisRow): AnalysisResult {
  return {
    id: row.id,
    enterpriseId: row.enterprise_id,
    type: row.type as AnalysisType,
    summary: row.summary ?? '',
    scores: row.scores ?? {},
    evidence: (row.evidence ?? []) as AnalysisResult['evidence'],
    demands: (row.demands ?? []) as FinancialDemandItem[],
    aiRunId: row.ai_run_id,
    createdAt: row.created_at,
  };
}

function buildEnterpriseContext(row: EnterpriseRow, profile: EnterpriseProfile): string {
  const sections: string[] = [];
  sections.push(`企业名称: ${profile.basicInfo.name}`);
  sections.push(`统一社会信用代码: ${profile.basicInfo.unifiedCode}`);
  sections.push(`所属行业: ${profile.basicInfo.industry}`);
  sections.push(`企业规模: ${profile.basicInfo.scale}`);
  sections.push(`所在区域: ${profile.basicInfo.region}`);
  sections.push(`企业等级: ${profile.basicInfo.level}`);
  sections.push(`标签: ${profile.basicInfo.tags.join(', ') || '无'}`);
  sections.push(`行业发展阶段: ${profile.industryStage}`);
  sections.push(`经营状况: ${profile.businessStatus}`);
  sections.push(`技术属性: ${profile.techAttributes}`);
  sections.push(`产品竞争力: ${profile.productCompetitiveness}`);
  sections.push(`成长潜力: ${profile.growthPotential}`);
  sections.push(`市场空间: ${profile.marketSpace}`);
  sections.push(`融资情况: ${profile.financingStatus}`);
  sections.push(`企业动态: ${profile.enterpriseDynamics}`);
  sections.push(`风险提示: ${profile.riskAlerts}`);
  sections.push(`产业链位置: ${profile.supplyChainPosition}`);
  sections.push(`竞争对手: ${profile.competitors}`);
  return sections.join('\n');
}

async function callAIForAnalysis(
  tenantId: string,
  systemPrompt: string,
  enterpriseContext: string,
): Promise<{ text: string; aiRunId: string | null }> {
  const gateway = getGateway();
  const messages: ChatMessage[] = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: enterpriseContext },
  ];

  try {
    const result = await gateway.chat({
      tenantId,
      taskType: 'enterprise_analysis',
      chatParams: {
        messages,
        temperature: 0.3,
        maxTokens: 4096,
      },
    });
    return { text: result.text, aiRunId: null };
  } catch {
    return { text: '分析服务暂时不可用，请稍后重试', aiRunId: null };
  }
}

async function saveAnalysis(
  tenantId: string,
  enterpriseId: string,
  type: AnalysisType,
  summary: string,
  scores: Record<string, unknown>,
  evidence: AnalysisResult['evidence'],
  aiRunId: string | null,
  demands: FinancialDemandItem[] = [],
): Promise<AnalysisResult> {
  const db = getSupabaseClient();
  const id = crypto.randomUUID();

  const { data, error: insertError } = await db
    .from('enterprise_analysis')
    .insert({
      id,
      tenant_id: tenantId,
      enterprise_id: enterpriseId,
      type,
      ai_run_id: aiRunId,
      summary,
      scores,
      evidence,
      demands,
    })
    .select('*')
    .limit(1);

  if (insertError) {
    throw new Error(`保存分析结果失败: ${insertError.message}`);
  }

  return rowToResult((data?.[0] as AnalysisRow) ?? null);
}

export async function analyzeTechInnovation(
  tenantId: string,
  enterpriseId: string,
): Promise<AnalysisResult> {
  const db = getSupabaseClient();
  const { data: entData } = await db
    .from('enterprise')
    .select('*')
    .eq('id', enterpriseId)
    .eq('tenant_id', tenantId)
    .is('deleted_at', null)
    .limit(1);

  const row = entData?.[0] as EnterpriseRow | undefined;
  if (!row) throw new Error('企业不存在');

  const profile: EnterpriseProfile = {
    basicInfo: {
      name: row.name,
      unifiedCode: row.unified_code ?? '待补充',
      industry: row.industry ?? '待补充',
      scale: row.scale ?? '待补充',
      region: row.region ?? '待补充',
      level: row.level ?? '待补充',
      tags: row.tags ?? [],
    },
    industryStage: (row.profile?.['industry_stage'] as string) ?? '待补充',
    businessStatus: (row.profile?.['business_status'] as string) ?? '待补充',
    techAttributes: (row.profile?.['tech_attributes'] as string) ?? '待补充',
    productCompetitiveness: (row.profile?.['product_competitiveness'] as string) ?? '待补充',
    growthPotential: (row.profile?.['growth_potential'] as string) ?? '待补充',
    marketSpace: (row.profile?.['market_space'] as string) ?? '待补充',
    financingStatus: (row.profile?.['financing_status'] as string) ?? '待补充',
    enterpriseDynamics: (row.profile?.['enterprise_dynamics'] as string) ?? '待补充',
    riskAlerts: (row.profile?.['risk_alerts'] as string) ?? '待补充',
    supplyChainPosition: (row.profile?.['supply_chain_position'] as string) ?? '待补充',
    competitors: (row.profile?.['competitors'] as string) ?? '待补充',
  };

  const context = buildEnterpriseContext(row, profile);

  const systemPrompt = `你是企业技术创新分析专家。请基于以下企业信息，从以下维度进行分析：
1. 核心技术：企业掌握的关键技术及其先进性
2. 专利布局：专利数量、质量、覆盖领域
3. 研发投入：研发投入规模与占比
4. 技术壁垒：技术护城河与门槛
5. 创新评级：综合评级（A/B/C/D）

重要原则：
- 只基于提供的数据进行分析，缺失的数据标注"待补充"
- 禁止编造任何数据
- 每条结论需标注来源（"基于用户提供材料"或具体数据字段）
- 输出JSON格式：{"summary": "总体概述", "scores": {"core_tech": "描述", "patent_layout": "描述", "rd_investment": "描述", "tech_barrier": "描述", "innovation_rating": "A/B/C/D"}, "evidence": [{"finding": "结论", "source": "来源", "confidence": "high/medium/low"}]}`;

  const { text, aiRunId } = await callAIForAnalysis(tenantId, systemPrompt, context);

  let parsed: { summary: string; scores: Record<string, unknown>; evidence: AnalysisResult['evidence'] };
  try {
    parsed = JSON.parse(text);
  } catch {
    parsed = {
      summary: text.slice(0, 500),
      scores: { innovation_rating: '待评估' },
      evidence: [{ finding: text.slice(0, 200), source: '基于用户提供材料', confidence: 'low' }],
    };
  }

  return saveAnalysis(
    tenantId,
    enterpriseId,
    'tech_innovation',
    parsed.summary,
    parsed.scores,
    parsed.evidence,
    aiRunId,
  );
}

export async function analyzeGrowthPotential(
  tenantId: string,
  enterpriseId: string,
): Promise<AnalysisResult> {
  const db = getSupabaseClient();
  const { data: entData } = await db
    .from('enterprise')
    .select('*')
    .eq('id', enterpriseId)
    .eq('tenant_id', tenantId)
    .is('deleted_at', null)
    .limit(1);

  const row = entData?.[0] as EnterpriseRow | undefined;
  if (!row) throw new Error('企业不存在');

  const profile: EnterpriseProfile = {
    basicInfo: {
      name: row.name,
      unifiedCode: row.unified_code ?? '待补充',
      industry: row.industry ?? '待补充',
      scale: row.scale ?? '待补充',
      region: row.region ?? '待补充',
      level: row.level ?? '待补充',
      tags: row.tags ?? [],
    },
    industryStage: (row.profile?.['industry_stage'] as string) ?? '待补充',
    businessStatus: (row.profile?.['business_status'] as string) ?? '待补充',
    techAttributes: (row.profile?.['tech_attributes'] as string) ?? '待补充',
    productCompetitiveness: (row.profile?.['product_competitiveness'] as string) ?? '待补充',
    growthPotential: (row.profile?.['growth_potential'] as string) ?? '待补充',
    marketSpace: (row.profile?.['market_space'] as string) ?? '待补充',
    financingStatus: (row.profile?.['financing_status'] as string) ?? '待补充',
    enterpriseDynamics: (row.profile?.['enterprise_dynamics'] as string) ?? '待补充',
    riskAlerts: (row.profile?.['risk_alerts'] as string) ?? '待补充',
    supplyChainPosition: (row.profile?.['supply_chain_position'] as string) ?? '待补充',
    competitors: (row.profile?.['competitors'] as string) ?? '待补充',
  };

  const context = buildEnterpriseContext(row, profile);

  const systemPrompt = `你是企业成长潜力分析专家。请基于以下企业信息，从以下维度进行分析：
1. 发展阶段：企业当前所处发展阶段（初创/成长/成熟/转型）
2. 成长指标：营收增长、用户增长、市场份额变化等
3. 市场空间：所在行业的市场容量与增长前景
4. 扩张能力：跨区域、跨行业扩张的可行性
5. 融资节奏：融资历史与下一轮融资预期

重要原则：
- 只基于提供的数据进行分析，缺失的数据标注"待补充"
- 禁止编造任何数据
- 每条结论需标注来源
- 输出JSON格式：{"summary": "总体概述", "scores": {"dev_stage": "描述", "growth_metrics": "描述", "market_space": "描述", "expansion_ability": "描述", "financing_rhythm": "描述"}, "evidence": [{"finding": "结论", "source": "来源", "confidence": "high/medium/low"}]}`;

  const { text, aiRunId } = await callAIForAnalysis(tenantId, systemPrompt, context);

  let parsed: { summary: string; scores: Record<string, unknown>; evidence: AnalysisResult['evidence'] };
  try {
    parsed = JSON.parse(text);
  } catch {
    parsed = {
      summary: text.slice(0, 500),
      scores: { dev_stage: '待评估' },
      evidence: [{ finding: text.slice(0, 200), source: '基于用户提供材料', confidence: 'low' }],
    };
  }

  return saveAnalysis(
    tenantId,
    enterpriseId,
    'growth_potential',
    parsed.summary,
    parsed.scores,
    parsed.evidence,
    aiRunId,
  );
}

export async function identifyFinancialDemand(
  tenantId: string,
  enterpriseId: string,
): Promise<AnalysisResult> {
  const db = getSupabaseClient();
  const { data: entData } = await db
    .from('enterprise')
    .select('*')
    .eq('id', enterpriseId)
    .eq('tenant_id', tenantId)
    .is('deleted_at', null)
    .limit(1);

  const row = entData?.[0] as EnterpriseRow | undefined;
  if (!row) throw new Error('企业不存在');

  const profile: EnterpriseProfile = {
    basicInfo: {
      name: row.name,
      unifiedCode: row.unified_code ?? '待补充',
      industry: row.industry ?? '待补充',
      scale: row.scale ?? '待补充',
      region: row.region ?? '待补充',
      level: row.level ?? '待补充',
      tags: row.tags ?? [],
    },
    industryStage: (row.profile?.['industry_stage'] as string) ?? '待补充',
    businessStatus: (row.profile?.['business_status'] as string) ?? '待补充',
    techAttributes: (row.profile?.['tech_attributes'] as string) ?? '待补充',
    productCompetitiveness: (row.profile?.['product_competitiveness'] as string) ?? '待补充',
    growthPotential: (row.profile?.['growth_potential'] as string) ?? '待补充',
    marketSpace: (row.profile?.['market_space'] as string) ?? '待补充',
    financingStatus: (row.profile?.['financing_status'] as string) ?? '待补充',
    enterpriseDynamics: (row.profile?.['enterprise_dynamics'] as string) ?? '待补充',
    riskAlerts: (row.profile?.['risk_alerts'] as string) ?? '待补充',
    supplyChainPosition: (row.profile?.['supply_chain_position'] as string) ?? '待补充',
    competitors: (row.profile?.['competitors'] as string) ?? '待补充',
  };

  const context = buildEnterpriseContext(row, profile);

  const systemPrompt = `你是企业金融需求识别专家。请基于以下企业信息，从以下维度识别金融需求：
1. 研发融资：技术研发、专利申请等资金需求
2. 扩产融资：产能扩张、设备采购等资金需求
3. 结算需求：日常经营中的结算与资金管理需求
4. 供应链金融：上下游供应链中的融资需求
5. 国际化金融：跨境贸易、海外扩张的金融需求

重要原则：
- 只基于提供的数据进行分析，缺失的数据标注"待补充"
- 禁止编造任何数据
- 每条结论需标注来源
- 输出JSON格式：{"summary": "总体概述", "scores": {"rd_financing": "描述", "expansion_financing": "描述", "settlement_demand": "描述", "supply_chain_finance": "描述", "intl_finance": "描述"}, "evidence": [{"finding": "结论", "source": "来源", "confidence": "high/medium/low"}], "demands": [{"type": "研发融资/扩产融资/结算需求/供应链金融/国际化金融", "amountRange": "如100-500万", "urgency": "high/medium/low"}]}

demands字段说明：
- type：需求类型，必须为以下五种之一：研发融资、扩产融资、结算需求、供应链金融、国际化金融
- amountRange：预估金额范围，如"100-500万"、"500-1000万"等
- urgency：紧迫程度，high=紧迫（近期需要）、medium=中等（半年内）、low=较低（长期规划）
- 只输出确实存在的需求，不要为每个类型都强行生成一条
- 如果某类需求不存在，不要在demands中包含该类型`;

  const { text, aiRunId } = await callAIForAnalysis(tenantId, systemPrompt, context);

  let parsed: {
    summary: string;
    scores: Record<string, unknown>;
    evidence: AnalysisResult['evidence'];
    demands?: FinancialDemandItem[];
  };
  try {
    parsed = JSON.parse(text);
  } catch {
    parsed = {
      summary: text.slice(0, 500),
      scores: { rd_financing: '待评估' },
      evidence: [{ finding: text.slice(0, 200), source: '基于用户提供材料', confidence: 'low' }],
      demands: [],
    };
  }

  const validDemandTypes = ['研发融资', '扩产融资', '结算需求', '供应链金融', '国际化金融'];
  const demands: FinancialDemandItem[] = (parsed.demands ?? []).filter(
    (d) => validDemandTypes.includes(d.type) && ['high', 'medium', 'low'].includes(d.urgency),
  );

  return saveAnalysis(
    tenantId,
    enterpriseId,
    'financial_demand',
    parsed.summary,
    parsed.scores,
    parsed.evidence,
    aiRunId,
    demands,
  );
}

export async function listAnalyses(
  tenantId: string,
  enterpriseId: string,
): Promise<AnalysisResult[]> {
  const db = getSupabaseClient();
  const { data } = await db
    .from('enterprise_analysis')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('enterprise_id', enterpriseId)
    .order('created_at', { ascending: false });

  return (data ?? []).map((row) => rowToResult(row as AnalysisRow));
}