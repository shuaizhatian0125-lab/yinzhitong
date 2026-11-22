import { getSupabaseClient } from '@/storage/database/supabase-client';
import { getGateway, type ChatMessage } from '@/server/ai/gateway';
import type { EnterpriseRow, EnterpriseProfile } from './enterprise-service';

export type ValueDiscoveryReport = {
  id: string;
  enterpriseId: string;
  chapters: Array<{
    key: string;
    title: string;
    content: string;
    sources: Array<{ label: string; type: string }>;
  }>;
  createdAt: string;
};

const REPORT_CHAPTERS = [
  { key: 'basic_profile', title: '企业基础画像' },
  { key: 'tech_innovation', title: '核心技术与创新能力' },
  { key: 'product_market', title: '产品与市场竞争力' },
  { key: 'dev_stage', title: '发展阶段' },
  { key: 'business_growth', title: '经营与成长情况' },
  { key: 'supply_chain', title: '产业链价值' },
  { key: 'market_potential', title: '市场发展潜力' },
  { key: 'risk_alert', title: '风险提示' },
  { key: 'financial_demand', title: '潜在金融需求' },
  { key: 'business_opportunity', title: '业务机会建议' },
  { key: 'next_action', title: '下一步行动' },
];

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

export async function generateValueDiscoveryReport(
  tenantId: string,
  enterpriseId: string,
): Promise<ValueDiscoveryReport> {
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

  const chapterList = REPORT_CHAPTERS.map((c, i) => `${i + 1}. ${c.title}`).join('\n');

  const systemPrompt = `你是企业价值发现报告生成专家。请基于以下企业信息，生成一份完整的11章节价值发现报告。

报告章节：
${chapterList}

重要原则：
- 只基于提供的数据进行分析，缺失的数据标注"待补充"
- 禁止编造任何数据，不造假
- 每项结论需附来源引用或标注"基于用户提供材料"
- 报告应具有银行客户经理视角，关注金融业务机会

输出JSON格式：
{"chapters": [{"key": "basic_profile", "title": "企业基础画像", "content": "详细内容", "sources": [{"label": "来源描述", "type": "user_provided/data_field/ai_analysis"}]}]}`;

  const gateway = getGateway();
  const messages: ChatMessage[] = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: context },
  ];

  let chapters: ValueDiscoveryReport['chapters'];

  try {
    const result = await gateway.chat({
      tenantId,
      taskType: 'enterprise_report',
      chatParams: {
        messages,
        temperature: 0.3,
        maxTokens: 8192,
      },
    });

    try {
      const parsed = JSON.parse(result.text);
      chapters = parsed.chapters ?? REPORT_CHAPTERS.map((c) => ({
        key: c.key,
        title: c.title,
        content: '待补充',
        sources: [{ label: '基于用户提供材料', type: 'user_provided' }],
      }));
    } catch {
      chapters = REPORT_CHAPTERS.map((c) => ({
        key: c.key,
        title: c.title,
        content: result.text,
        sources: [{ label: '基于用户提供材料', type: 'user_provided' }],
      }));
    }
  } catch {
    chapters = REPORT_CHAPTERS.map((c) => ({
      key: c.key,
      title: c.title,
      content: '报告生成服务暂时不可用，请稍后重试',
      sources: [{ label: '系统提示', type: 'system' }],
    }));
  }

  const reportId = crypto.randomUUID();
  const now = new Date().toISOString();

  await db.from('enterprise_analysis').insert({
    id: reportId,
    tenant_id: tenantId,
    enterprise_id: enterpriseId,
    type: 'value_report',
    ai_run_id: null,
    summary: chapters.map((c) => c.title).join(' | '),
    scores: {},
    evidence: chapters.map((c) => ({
      finding: c.content.slice(0, 200),
      source: c.sources[0]?.label ?? '基于用户提供材料',
      confidence: 'medium' as const,
    })),
  });

  return {
    id: reportId,
    enterpriseId,
    chapters,
    createdAt: now,
  };
}