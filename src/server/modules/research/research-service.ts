import { getSupabaseClient } from '@/storage/database/supabase-client';
import { getGateway, type ChatMessage } from '@/server/ai/gateway';

export type IndustryRow = {
  id: string;
  tenant_id: string;
  name: string;
  code: string | null;
  parent_id: string | null;
  level: number;
  description: string | null;
  created_at: string;
};

export type IndustryProfile = {
  trends: string;
  policy: string;
  scale: string;
  supplyChain: string;
  competition: string;
  technology: string;
  risk: string;
  opportunity: string;
};

export type IndustryResearchRow = {
  id: string;
  tenant_id: string;
  industry_id: string | null;
  title: string;
  period: string | null;
  key_findings: unknown[];
  content_doc_id: string | null;
  created_by: string | null;
  created_at: string;
};

export type ResearchReport = {
  id: string;
  industryId: string;
  title: string;
  content: string;
  keyFindings: Array<{
    finding: string;
    level: 'verified_fact' | 'source_data' | 'ai_analysis' | 'speculation' | 'suggestion';
    source: string;
  }>;
  createdAt: string;
};

const PENDING_LABEL = '待补充';

function safeValue(value: unknown): string {
  if (value === null || value === undefined || value === '') return PENDING_LABEL;
  if (typeof value === 'string') return value;
  if (typeof value === 'number') return String(value);
  if (Array.isArray(value)) return value.length > 0 ? value.join(', ') : PENDING_LABEL;
  if (typeof value === 'object') return JSON.stringify(value);
  return PENDING_LABEL;
}

export async function listIndustries(tenantId: string): Promise<IndustryRow[]> {
  const db = getSupabaseClient();
  const { data } = await db
    .from('industry')
    .select('*')
    .eq('tenant_id', tenantId)
    .order('level', { ascending: true })
    .order('name', { ascending: true });

  return (data ?? []) as IndustryRow[];
}

export async function getIndustryProfile(
  tenantId: string,
  industryId: string,
): Promise<{ row: IndustryRow; profile: IndustryProfile } | null> {
  const db = getSupabaseClient();
  const { data } = await db
    .from('industry')
    .select('*')
    .eq('id', industryId)
    .eq('tenant_id', tenantId)
    .limit(1);

  const row = (data?.[0] as IndustryRow | undefined) ?? null;
  if (!row) return null;

  const profile: IndustryProfile = {
    trends: safeValue(row.description),
    policy: PENDING_LABEL,
    scale: PENDING_LABEL,
    supplyChain: PENDING_LABEL,
    competition: PENDING_LABEL,
    technology: PENDING_LABEL,
    risk: PENDING_LABEL,
    opportunity: PENDING_LABEL,
  };

  return { row, profile };
}

export async function generateIndustryReport(
  tenantId: string,
  industryId: string,
): Promise<ResearchReport> {
  const db = getSupabaseClient();
  const { data } = await db
    .from('industry')
    .select('*')
    .eq('id', industryId)
    .eq('tenant_id', tenantId)
    .limit(1);

  const row = (data?.[0] as IndustryRow | undefined) ?? null;
  if (!row) throw new Error('行业不存在');

  const industryContext = `行业名称: ${row.name}\n行业代码: ${row.code ?? '待补充'}\n行业层级: ${row.level}\n行业描述: ${row.description ?? '待补充'}`;

  const systemPrompt = `你是行业研究分析专家。请基于以下行业信息，生成一份完整的行业研究报告。

报告需覆盖以下维度：
1. 行业趋势：当前发展趋势与未来方向
2. 政策环境：相关政策法规与监管动向
3. 行业规模：市场规模、增长率、容量
4. 产业链：上下游结构与关键环节
5. 竞争格局：主要参与者与竞争态势
6. 技术发展：核心技术路线与创新方向
7. 风险因素：行业面临的主要风险
8. 机会识别：潜在投资与合作机会

重要原则：
- 只基于提供的数据进行分析，缺失的数据标注"待补充"
- 禁止编造任何数据
- 研究结果需分级标注：已验证事实/来源数据/AI分析/推测/建议
- 每条结论需附来源

输出JSON格式：
{"title": "报告标题", "content": "报告正文", "keyFindings": [{"finding": "结论", "level": "verified_fact/source_data/ai_analysis/speculation/suggestion", "source": "来源"}]}`;

  const gateway = getGateway();
  const messages: ChatMessage[] = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: industryContext },
  ];

  let reportData: {
    title: string;
    content: string;
    keyFindings: ResearchReport['keyFindings'];
  };

  try {
    const result = await gateway.chat({
      tenantId,
      taskType: 'industry_research',
      chatParams: {
        messages,
        temperature: 0.3,
        maxTokens: 8192,
      },
    });

    try {
      reportData = JSON.parse(result.text);
    } catch {
      reportData = {
        title: `${row.name}行业研究报告`,
        content: result.text,
        keyFindings: [
          { finding: result.text.slice(0, 200), level: 'ai_analysis', source: '基于用户提供材料' },
        ],
      };
    }
  } catch {
    reportData = {
      title: `${row.name}行业研究报告`,
      content: '研究服务暂时不可用，请稍后重试',
      keyFindings: [],
    };
  }

  const reportId = crypto.randomUUID();
  const now = new Date().toISOString();

  await db.from('industry_research').insert({
    id: reportId,
    tenant_id: tenantId,
    industry_id: industryId,
    title: reportData.title,
    period: now.slice(0, 7),
    key_findings: reportData.keyFindings,
  });

  return {
    id: reportId,
    industryId,
    title: reportData.title,
    content: reportData.content,
    keyFindings: reportData.keyFindings,
    createdAt: now,
  };
}

export async function linkEnterprises(
  tenantId: string,
  industryId: string,
): Promise<Array<{ id: string; name: string; industry: string | null; region: string | null; level: string | null }>> {
  const db = getSupabaseClient();

  const { data: industryData } = await db
    .from('industry')
    .select('name')
    .eq('id', industryId)
    .eq('tenant_id', tenantId)
    .limit(1);

  const industryName = (industryData?.[0] as { name: string } | undefined)?.name;
  if (!industryName) return [];

  const { data: entData } = await db
    .from('enterprise')
    .select('id,name,industry,region,level')
    .eq('tenant_id', tenantId)
    .eq('industry', industryName)
    .is('deleted_at', null)
    .order('updated_at', { ascending: false })
    .limit(20);

  return (entData ?? []) as Array<{
    id: string;
    name: string;
    industry: string | null;
    region: string | null;
    level: string | null;
  }>;
}

export async function listResearchReports(
  tenantId: string,
  industryId?: string,
): Promise<IndustryResearchRow[]> {
  const db = getSupabaseClient();
  let query = db
    .from('industry_research')
    .select('*')
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false });

  if (industryId) {
    query = query.eq('industry_id', industryId);
  }

  const { data } = await query;
  return (data ?? []) as IndustryResearchRow[];
}