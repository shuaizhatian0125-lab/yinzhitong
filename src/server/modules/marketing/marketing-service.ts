import { getSupabaseClient } from '@/storage/database/supabase-client';
import { getGateway, type ChatMessage } from '@/server/ai/gateway';

export type SegmentRow = {
  id: string;
  tenant_id: string;
  name: string;
  definition: Record<string, unknown>;
  size_estimate: number | null;
  created_by: string | null;
  created_at: string;
};

export type CampaignRow = {
  id: string;
  tenant_id: string;
  name: string;
  segment_id: string | null;
  objective: string | null;
  channel: string | null;
  start_at: string | null;
  end_at: string | null;
  status: string;
  budget: number | null;
  owner_id: string | null;
  created_at: string;
};

export type CampaignMetricRow = {
  id: string;
  tenant_id: string;
  campaign_id: string;
  metric: string;
  value: number;
  captured_at: string;
};

export type SegmentAnalysis = {
  segmentId: string;
  segmentName: string;
  sizeEstimate: number | null;
  characteristics: string[];
  financialNeeds: string[];
  riskProfile: string;
  recommendedProducts: string[];
  recommendedChannels: string[];
  engagementStrategy: string;
};

export type CampaignDesignInput = {
  segmentId: string;
  name: string;
  objective: string;
  channel?: string;
  budget?: number;
  startAt?: string;
  endAt?: string;
};

export type CampaignDesign = {
  campaignName: string;
  segmentId: string;
  objective: string;
  channel: string;
  budget: number | null;
  startAt: string | null;
  endAt: string | null;
  targetAudience: string;
  keyMessage: string;
  offerDesign: string;
  executionPlan: string[];
  successMetrics: string[];
  riskConsiderations: string[];
};

export type CampaignEffectAnalysis = {
  campaignId: string;
  campaignName: string;
  status: string;
  metrics: CampaignMetricRow[];
  summary: string;
  reachAnalysis: string;
  conversionAnalysis: string;
  roiAnalysis: string;
  recommendations: string[];
};

export async function listSegments(
  tenantId: string,
): Promise<SegmentRow[]> {
  const db = getSupabaseClient();
  const { data } = await db
    .from('segment')
    .select('*')
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false });

  return (data ?? []) as SegmentRow[];
}

export async function listCampaigns(
  tenantId: string,
  filter?: { status?: string },
): Promise<CampaignRow[]> {
  const db = getSupabaseClient();
  let query = db
    .from('campaign')
    .select('*')
    .eq('tenant_id', tenantId);

  if (filter?.status) {
    query = query.eq('status', filter.status);
  }

  query = query.order('created_at', { ascending: false });

  const { data } = await query;

  return (data ?? []) as CampaignRow[];
}

export async function analyzeSegment(
  tenantId: string,
  segmentId: string,
): Promise<SegmentAnalysis | null> {
  const db = getSupabaseClient();

  const { data: segmentData } = await db
    .from('segment')
    .select('*')
    .eq('id', segmentId)
    .eq('tenant_id', tenantId)
    .limit(1);

  const segment = (segmentData?.[0] as SegmentRow | undefined) ?? null;
  if (!segment) return null;

  const definitionStr = JSON.stringify(segment.definition ?? {});

  const systemPrompt = `你是银行客群分析专家。请基于以下客群定义信息，进行深度客群分析。

重要原则：
- 只基于提供的数据进行分析，缺失的数据标注"待补充"
- 禁止编造任何数据
- 输出JSON格式

输出格式要求：
{
  "characteristics": ["客群特征1", "客群特征2", ...],
  "financialNeeds": ["金融需求1", "金融需求2", ...],
  "riskProfile": "风险画像描述",
  "recommendedProducts": ["推荐产品1", "推荐产品2", ...],
  "recommendedChannels": ["推荐渠道1", "推荐渠道2", ...],
  "engagementStrategy": "客户经营策略描述"
}`;

  const gateway = getGateway();
  const messages: ChatMessage[] = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: `客群名称: ${segment.name}\n客群规模估计: ${safeStr(segment.size_estimate)}\n客群定义: ${definitionStr}` },
  ];

  let parsed: {
    characteristics: string[];
    financialNeeds: string[];
    riskProfile: string;
    recommendedProducts: string[];
    recommendedChannels: string[];
    engagementStrategy: string;
  };

  try {
    const result = await gateway.chat({
      tenantId,
      taskType: 'marketing_segment_analysis',
      chatParams: { messages, temperature: 0.3, maxTokens: 2048 },
    });
    parsed = JSON.parse(result.text);
  } catch {
    parsed = {
      characteristics: ['待补充'],
      financialNeeds: ['待补充'],
      riskProfile: '待补充',
      recommendedProducts: ['待补充'],
      recommendedChannels: ['待补充'],
      engagementStrategy: '待补充',
    };
  }

  return {
    segmentId: segment.id,
    segmentName: segment.name,
    sizeEstimate: segment.size_estimate,
    characteristics: parsed.characteristics ?? [],
    financialNeeds: parsed.financialNeeds ?? [],
    riskProfile: parsed.riskProfile ?? PENDING_LABEL,
    recommendedProducts: parsed.recommendedProducts ?? [],
    recommendedChannels: parsed.recommendedChannels ?? [],
    engagementStrategy: parsed.engagementStrategy ?? PENDING_LABEL,
  };
}

export async function designCampaign(
  tenantId: string,
  input: CampaignDesignInput,
): Promise<CampaignDesign | null> {
  const db = getSupabaseClient();

  const { data: segmentData } = await db
    .from('segment')
    .select('*')
    .eq('id', input.segmentId)
    .eq('tenant_id', tenantId)
    .limit(1);

  const segment = (segmentData?.[0] as SegmentRow | undefined) ?? null;
  if (!segment) return null;

  const definitionStr = JSON.stringify(segment.definition ?? {});

  const systemPrompt = `你是银行营销活动设计专家。请基于以下客群信息和营销目标，设计一份完整的营销活动方案。

重要原则：
- 只基于提供的数据进行分析，缺失的数据标注"待补充"
- 禁止编造任何数据
- 输出JSON格式

输出格式要求：
{
  "targetAudience": "目标受众描述",
  "keyMessage": "核心营销信息",
  "offerDesign": "优惠/权益设计描述",
  "executionPlan": ["执行步骤1", "执行步骤2", ...],
  "successMetrics": ["成功指标1", "成功指标2", ...],
  "riskConsiderations": ["风险考量1", "风险考量2", ...]
}`;

  const gateway = getGateway();
  const messages: ChatMessage[] = [
    { role: 'system', content: systemPrompt },
    {
      role: 'user',
      content: `客群名称: ${segment.name}\n客群规模: ${safeStr(segment.size_estimate)}\n客群定义: ${definitionStr}\n营销目标: ${input.objective}\n预算: ${safeStr(input.budget)}`,
    },
  ];

  let parsed: {
    targetAudience: string;
    keyMessage: string;
    offerDesign: string;
    executionPlan: string[];
    successMetrics: string[];
    riskConsiderations: string[];
  };

  try {
    const result = await gateway.chat({
      tenantId,
      taskType: 'marketing_campaign_design',
      chatParams: { messages, temperature: 0.3, maxTokens: 2048 },
    });
    parsed = JSON.parse(result.text);
  } catch {
    parsed = {
      targetAudience: '待补充',
      keyMessage: '待补充',
      offerDesign: '待补充',
      executionPlan: ['待补充'],
      successMetrics: ['待补充'],
      riskConsiderations: ['待补充'],
    };
  }

  return {
    campaignName: input.name,
    segmentId: input.segmentId,
    objective: input.objective,
    channel: input.channel ?? '待补充',
    budget: input.budget ?? null,
    startAt: input.startAt ?? null,
    endAt: input.endAt ?? null,
    targetAudience: parsed.targetAudience ?? PENDING_LABEL,
    keyMessage: parsed.keyMessage ?? PENDING_LABEL,
    offerDesign: parsed.offerDesign ?? PENDING_LABEL,
    executionPlan: parsed.executionPlan ?? [],
    successMetrics: parsed.successMetrics ?? [],
    riskConsiderations: parsed.riskConsiderations ?? [],
  };
}

export async function analyzeCampaignEffect(
  tenantId: string,
  campaignId: string,
): Promise<CampaignEffectAnalysis | null> {
  const db = getSupabaseClient();

  const [campaignRes, metricsRes] = await Promise.all([
    db
      .from('campaign')
      .select('*')
      .eq('id', campaignId)
      .eq('tenant_id', tenantId)
      .limit(1),
    db
      .from('campaign_metric')
      .select('*')
      .eq('campaign_id', campaignId)
      .eq('tenant_id', tenantId)
      .order('captured_at', { ascending: false }),
  ]);

  const campaign = (campaignRes.data?.[0] as CampaignRow | undefined) ?? null;
  if (!campaign) return null;

  const metrics = (metricsRes.data ?? []) as CampaignMetricRow[];

  const metricsStr = metrics.map((m) => `${m.metric}: ${m.value}`).join(', ');

  const systemPrompt = `你是银行营销效果分析专家。请基于以下营销活动数据，进行效果分析。

重要原则：
- 只基于提供的数据进行分析，缺失的数据标注"待补充"
- 禁止编造任何数据
- 输出JSON格式

输出格式要求：
{
  "summary": "总体效果概述",
  "reachAnalysis": "触达分析",
  "conversionAnalysis": "转化分析",
  "roiAnalysis": "ROI分析",
  "recommendations": ["建议1", "建议2", ...]
}`;

  const gateway = getGateway();
  const messages: ChatMessage[] = [
    { role: 'system', content: systemPrompt },
    {
      role: 'user',
      content: `活动名称: ${campaign.name}\n活动目标: ${safeStr(campaign.objective)}\n渠道: ${safeStr(campaign.channel)}\n状态: ${campaign.status}\n预算: ${safeStr(campaign.budget)}\n指标数据: ${metricsStr || '暂无指标数据'}`,
    },
  ];

  let parsed: {
    summary: string;
    reachAnalysis: string;
    conversionAnalysis: string;
    roiAnalysis: string;
    recommendations: string[];
  };

  try {
    const result = await gateway.chat({
      tenantId,
      taskType: 'marketing_campaign_effect',
      chatParams: { messages, temperature: 0.3, maxTokens: 2048 },
    });
    parsed = JSON.parse(result.text);
  } catch {
    parsed = {
      summary: '暂无足够数据进行分析',
      reachAnalysis: '待补充',
      conversionAnalysis: '待补充',
      roiAnalysis: '待补充',
      recommendations: ['建议收集更多活动指标数据'],
    };
  }

  return {
    campaignId: campaign.id,
    campaignName: campaign.name,
    status: campaign.status,
    metrics,
    summary: parsed.summary ?? PENDING_LABEL,
    reachAnalysis: parsed.reachAnalysis ?? PENDING_LABEL,
    conversionAnalysis: parsed.conversionAnalysis ?? PENDING_LABEL,
    roiAnalysis: parsed.roiAnalysis ?? PENDING_LABEL,
    recommendations: parsed.recommendations ?? [],
  };
}

export type CampaignCreateInput = {
  name: string;
  segmentId?: string;
  objective?: string;
  channel?: string;
  startAt?: string;
  endAt?: string;
  budget?: number;
  ownerId?: string;
};

export async function createCampaign(
  tenantId: string,
  input: CampaignCreateInput,
): Promise<CampaignRow> {
  const db = getSupabaseClient();
  const id = crypto.randomUUID();

  const { data, error: insertError } = await db
    .from('campaign')
    .insert({
      id,
      tenant_id: tenantId,
      name: input.name,
      segment_id: input.segmentId ?? null,
      objective: input.objective ?? null,
      channel: input.channel ?? null,
      start_at: input.startAt ?? null,
      end_at: input.endAt ?? null,
      status: 'draft',
      budget: input.budget ?? null,
      owner_id: input.ownerId ?? null,
    })
    .select('*')
    .limit(1);

  if (insertError) {
    throw new Error(`创建营销活动失败: ${insertError.message}`);
  }

  return (data?.[0] as CampaignRow) ?? null;
}

const PENDING_LABEL = '待补充';

function safeStr(value: unknown): string {
  if (value === null || value === undefined || value === '') return PENDING_LABEL;
  if (typeof value === 'string') return value;
  if (typeof value === 'number') return String(value);
  if (typeof value === 'boolean') return value ? '是' : '否';
  if (Array.isArray(value)) return value.length > 0 ? value.join(', ') : PENDING_LABEL;
  return PENDING_LABEL;
}