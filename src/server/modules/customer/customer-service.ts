import { getSupabaseClient } from '@/storage/database/supabase-client';
import { getGateway, type ChatMessage } from '@/server/ai/gateway';

export type CustomerFilter = {
  keyword?: string;
  type?: string;
  level?: string;
  status?: string;
  managerId?: string;
  page?: number;
  pageSize?: number;
};

export type CustomerRow = {
  id: string;
  tenant_id: string;
  name: string;
  type: string;
  enterprise_id: string | null;
  manager_id: string | null;
  org_unit_id: string | null;
  level: string | null;
  status: string;
  profile: Record<string, unknown>;
  tags: string[];
  created_at: string;
  updated_at: string;
};

export type CustomerContactRow = {
  id: string;
  tenant_id: string;
  customer_id: string;
  name: string;
  title: string | null;
  mobile_enc: string | null;
  email: string | null;
  created_at: string;
};

export type OpportunityRow = {
  id: string;
  tenant_id: string;
  customer_id: string;
  title: string;
  stage: string;
  amount: number | null;
  probability: number | null;
  expected_close_at: string | null;
  owner_id: string | null;
  ai_run_id: string | null;
  created_at: string;
  updated_at: string;
};

export type VisitRecordRow = {
  id: string;
  tenant_id: string;
  customer_id: string;
  user_id: string;
  visited_at: string;
  purpose: string | null;
  summary: string | null;
  next_action: string | null;
  doc_id: string | null;
  created_at: string;
};

export type Customer360 = {
  basicInfo: {
    id: string;
    name: string;
    type: string;
    level: string;
    status: string;
    tags: string[];
    enterpriseId: string | null;
    managerId: string | null;
  };
  profile: Record<string, unknown>;
  contacts: CustomerContactRow[];
  opportunities: OpportunityRow[];
  visitRecords: VisitRecordRow[];
  lifecycleStage: string;
  segmentInfo: string;
  strategy: string;
};

export type VisitPlan = {
  customerId: string;
  customerName: string;
  visitDate: string;
  objectives: string[];
  talkingPoints: string[];
  recommendedProducts: string[];
  riskReminders: string[];
  preparationChecklist: string[];
};

export type OpportunitySuggestion = {
  customerId: string;
  customerName: string;
  title: string;
  description: string;
  estimatedAmount: number | null;
  probability: number;
  expectedCloseAt: string | null;
  rationale: string;
  confirmed: boolean;
};

const PENDING_LABEL = '待补充';

function safeStr(value: unknown): string {
  if (value === null || value === undefined || value === '') return PENDING_LABEL;
  if (typeof value === 'string') return value;
  if (typeof value === 'number') return String(value);
  if (typeof value === 'boolean') return value ? '是' : '否';
  if (Array.isArray(value)) return value.length > 0 ? value.join(', ') : PENDING_LABEL;
  return PENDING_LABEL;
}

function inferLifecycleStage(row: CustomerRow, opportunities: OpportunityRow[], visitRecords: VisitRecordRow[]): string {
  const activeOpps = opportunities.filter((o) => o.stage !== 'closed_won' && o.stage !== 'closed_lost');
  const recentVisits = visitRecords.filter(
    (v) => Date.now() - new Date(v.visited_at).getTime() < 90 * 24 * 60 * 60 * 1000,
  );

  if (row.status === 'inactive') return '流失期';
  if (activeOpps.length > 0) return '活跃期';
  if (recentVisits.length > 0) return '维护期';
  if (row.level === 'A' || row.level === 'B') return '重点期';
  return '观察期';
}

function inferStrategy(lifecycleStage: string, level: string | null, opportunities: OpportunityRow[]): string {
  if (lifecycleStage === '流失期') return '客户流失风险较高，建议立即安排拜访了解原因，制定挽留方案';
  if (lifecycleStage === '活跃期') {
    const totalAmount = opportunities.reduce((sum, o) => sum + (o.amount ?? 0), 0);
    return `当前有 ${opportunities.length} 个活跃商机，潜在金额约 ${totalAmount} 万元，建议加快推进关键商机`;
  }
  if (lifecycleStage === '维护期') return '客户关系稳定，建议定期拜访保持联系，挖掘新需求';
  if (level === 'A') return 'A级重点客户，建议配置专属客户经理，提供定制化服务方案';
  if (level === 'B') return 'B级潜力客户，建议加强互动频次，提升客户黏性';
  return '观察期客户，建议收集更多信息，评估升级潜力';
}

function inferSegmentInfo(row: CustomerRow): string {
  const tags = row.tags ?? [];
  if (tags.includes('VIP')) return 'VIP客户群';
  if (tags.includes('高净值')) return '高净值客户群';
  if (row.type === 'corp' && (row.level === 'A' || row.level === 'B')) return '重点对公客户群';
  if (row.type === 'corp') return '一般对公客户群';
  if (row.type === 'retail') return '零售客户群';
  return '通用客户群';
}

export async function listCustomers(
  tenantId: string,
  filter: CustomerFilter,
): Promise<{ items: CustomerRow[]; total: number }> {
  const db = getSupabaseClient();
  const page = filter.page ?? 1;
  const pageSize = filter.pageSize ?? 20;
  const offset = (page - 1) * pageSize;

  let query = db
    .from('customer')
    .select('*', { count: 'exact' })
    .eq('tenant_id', tenantId)
    .is('deleted_at', null);

  if (filter.keyword) {
    query = query.or(`name.ilike.%${filter.keyword}%`);
  }
  if (filter.type) {
    query = query.eq('type', filter.type);
  }
  if (filter.level) {
    query = query.eq('level', filter.level);
  }
  if (filter.status) {
    query = query.eq('status', filter.status);
  }
  if (filter.managerId) {
    query = query.eq('manager_id', filter.managerId);
  }

  query = query.order('updated_at', { ascending: false }).range(offset, offset + pageSize - 1);

  const { data, count } = await query;

  return {
    items: (data ?? []) as CustomerRow[],
    total: count ?? 0,
  };
}

export async function getCustomer(
  tenantId: string,
  customerId: string,
): Promise<CustomerRow | null> {
  const db = getSupabaseClient();
  const { data } = await db
    .from('customer')
    .select('*')
    .eq('id', customerId)
    .eq('tenant_id', tenantId)
    .is('deleted_at', null)
    .limit(1);

  return (data?.[0] as CustomerRow | undefined) ?? null;
}

export async function getCustomer360(
  tenantId: string,
  customerId: string,
): Promise<Customer360 | null> {
  const db = getSupabaseClient();

  const [customerRes, contactsRes, opportunitiesRes, visitsRes] = await Promise.all([
    db
      .from('customer')
      .select('*')
      .eq('id', customerId)
      .eq('tenant_id', tenantId)
      .is('deleted_at', null)
      .limit(1),
    db
      .from('customer_contact')
      .select('*')
      .eq('customer_id', customerId)
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false }),
    db
      .from('opportunity')
      .select('*')
      .eq('customer_id', customerId)
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false }),
    db
      .from('visit_record')
      .select('*')
      .eq('customer_id', customerId)
      .eq('tenant_id', tenantId)
      .order('visited_at', { ascending: false })
      .limit(10),
  ]);

  const customer = (customerRes.data?.[0] as CustomerRow | undefined) ?? null;
  if (!customer) return null;

  const contacts = (contactsRes.data ?? []) as CustomerContactRow[];
  const opportunities = (opportunitiesRes.data ?? []) as OpportunityRow[];
  const visitRecords = (visitsRes.data ?? []) as VisitRecordRow[];

  const lifecycleStage = inferLifecycleStage(customer, opportunities, visitRecords);
  const segmentInfo = inferSegmentInfo(customer);
  const strategy = inferStrategy(lifecycleStage, customer.level, opportunities);

  return {
    basicInfo: {
      id: customer.id,
      name: customer.name,
      type: customer.type,
      level: customer.level ?? PENDING_LABEL,
      status: customer.status,
      tags: customer.tags ?? [],
      enterpriseId: customer.enterprise_id,
      managerId: customer.manager_id,
    },
    profile: customer.profile ?? {},
    contacts,
    opportunities,
    visitRecords,
    lifecycleStage,
    segmentInfo,
    strategy,
  };
}

export async function generateVisitPlan(
  tenantId: string,
  customerId: string,
  visitDate: string,
): Promise<VisitPlan | null> {
  const db = getSupabaseClient();

  const [customerRes, contactsRes, opportunitiesRes, visitsRes] = await Promise.all([
    db
      .from('customer')
      .select('*')
      .eq('id', customerId)
      .eq('tenant_id', tenantId)
      .is('deleted_at', null)
      .limit(1),
    db
      .from('customer_contact')
      .select('*')
      .eq('customer_id', customerId)
      .eq('tenant_id', tenantId),
    db
      .from('opportunity')
      .select('*')
      .eq('customer_id', customerId)
      .eq('tenant_id', tenantId),
    db
      .from('visit_record')
      .select('*')
      .eq('customer_id', customerId)
      .eq('tenant_id', tenantId)
      .order('visited_at', { ascending: false })
      .limit(5),
  ]);

  const customer = (customerRes.data?.[0] as CustomerRow | undefined) ?? null;
  if (!customer) return null;

  const contacts = (contactsRes.data ?? []) as CustomerContactRow[];
  const opportunities = (opportunitiesRes.data ?? []) as OpportunityRow[];
  const recentVisits = (visitsRes.data ?? []) as VisitRecordRow[];

  const contextParts: string[] = [];
  contextParts.push(`客户名称: ${customer.name}`);
  contextParts.push(`客户类型: ${customer.type === 'corp' ? '对公' : '零售'}`);
  contextParts.push(`客户等级: ${safeStr(customer.level)}`);
  contextParts.push(`客户标签: ${customer.tags?.join(', ') || '无'}`);
  contextParts.push(`联系人: ${contacts.map((c) => `${c.name}(${safeStr(c.title)})`).join(', ') || '无'}`);
  contextParts.push(`活跃商机: ${opportunities.filter((o) => o.stage !== 'closed_won' && o.stage !== 'closed_lost').length} 个`);
  contextParts.push(`最近拜访: ${recentVisits.length > 0 ? recentVisits[0].visited_at : '无'}`);
  if (recentVisits.length > 0 && recentVisits[0].next_action) {
    contextParts.push(`上次拜访后续行动: ${recentVisits[0].next_action}`);
  }

  const systemPrompt = `你是银行客户经理拜访准备专家。请基于以下客户信息，生成一份结构化的拜访准备方案。

重要原则：
- 只基于提供的数据进行分析，缺失的数据标注"待补充"
- 禁止编造任何数据
- 输出JSON格式

输出格式要求：
{
  "objectives": ["拜访目标1", "拜访目标2", ...],
  "talkingPoints": ["谈话要点1", "谈话要点2", ...],
  "recommendedProducts": ["推荐产品1", "推荐产品2", ...],
  "riskReminders": ["风险提醒1", "风险提醒2", ...],
  "preparationChecklist": ["准备事项1", "准备事项2", ...]
}`;

  const gateway = getGateway();
  const messages: ChatMessage[] = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: contextParts.join('\n') },
  ];

  let parsed: {
    objectives: string[];
    talkingPoints: string[];
    recommendedProducts: string[];
    riskReminders: string[];
    preparationChecklist: string[];
  };

  try {
    const result = await gateway.chat({
      tenantId,
      taskType: 'customer_visit_plan',
      chatParams: { messages, temperature: 0.3, maxTokens: 2048 },
    });
    parsed = JSON.parse(result.text);
  } catch {
    parsed = {
      objectives: ['了解客户近期经营状况', '跟进上次拜访后续事项', '挖掘新的业务需求'],
      talkingPoints: ['客户近期业务发展情况', '现有产品使用体验', '行业动态与政策影响'],
      recommendedProducts: ['待补充'],
      riskReminders: ['关注客户经营风险变化', '注意合规要求'],
      preparationChecklist: ['准备客户资料', '回顾历史拜访记录', '准备产品介绍材料'],
    };
  }

  return {
    customerId: customer.id,
    customerName: customer.name,
    visitDate,
    objectives: parsed.objectives ?? [],
    talkingPoints: parsed.talkingPoints ?? [],
    recommendedProducts: parsed.recommendedProducts ?? [],
    riskReminders: parsed.riskReminders ?? [],
    preparationChecklist: parsed.preparationChecklist ?? [],
  };
}

export async function identifyOpportunity(
  tenantId: string,
  customerId: string,
): Promise<OpportunitySuggestion[] | null> {
  const db = getSupabaseClient();

  const [customerRes, contactsRes, opportunitiesRes, visitsRes] = await Promise.all([
    db
      .from('customer')
      .select('*')
      .eq('id', customerId)
      .eq('tenant_id', tenantId)
      .is('deleted_at', null)
      .limit(1),
    db
      .from('customer_contact')
      .select('*')
      .eq('customer_id', customerId)
      .eq('tenant_id', tenantId),
    db
      .from('opportunity')
      .select('*')
      .eq('customer_id', customerId)
      .eq('tenant_id', tenantId),
    db
      .from('visit_record')
      .select('*')
      .eq('customer_id', customerId)
      .eq('tenant_id', tenantId)
      .order('visited_at', { ascending: false })
      .limit(5),
  ]);

  const customer = (customerRes.data?.[0] as CustomerRow | undefined) ?? null;
  if (!customer) return null;

  const contacts = (contactsRes.data ?? []) as CustomerContactRow[];
  const opportunities = (opportunitiesRes.data ?? []) as OpportunityRow[];
  const recentVisits = (visitsRes.data ?? []) as VisitRecordRow[];

  const contextParts: string[] = [];
  contextParts.push(`客户名称: ${customer.name}`);
  contextParts.push(`客户类型: ${customer.type === 'corp' ? '对公' : '零售'}`);
  contextParts.push(`客户等级: ${safeStr(customer.level)}`);
  contextParts.push(`客户标签: ${customer.tags?.join(', ') || '无'}`);
  contextParts.push(`已有商机: ${opportunities.length} 个`);
  contextParts.push(`活跃商机: ${opportunities.filter((o) => o.stage !== 'closed_won' && o.stage !== 'closed_lost').length} 个`);
  contextParts.push(`最近拜访: ${recentVisits.length > 0 ? recentVisits[0].visited_at : '无'}`);
  if (recentVisits.length > 0 && recentVisits[0].summary) {
    contextParts.push(`上次拜访摘要: ${recentVisits[0].summary}`);
  }

  const systemPrompt = `你是银行商机识别专家。请基于以下客户信息，识别潜在的金融业务商机。

重要原则：
- 只基于提供的数据进行分析，缺失的数据标注"待补充"
- 禁止编造任何数据
- 每个商机需提供清晰的 rationale（识别依据）
- 商机需用户确认后才会正式录入系统

输出JSON格式：
{
  "suggestions": [
    {
      "title": "商机标题",
      "description": "商机描述",
      "estimatedAmount": 金额数字或null,
      "probability": 0-100的整数,
      "expectedCloseAt": "预期关闭日期或null",
      "rationale": "识别依据"
    }
  ]
}`;

  const gateway = getGateway();
  const messages: ChatMessage[] = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: contextParts.join('\n') },
  ];

  let parsed: {
    suggestions: Array<{
      title: string;
      description: string;
      estimatedAmount: number | null;
      probability: number;
      expectedCloseAt: string | null;
      rationale: string;
    }>;
  };

  try {
    const result = await gateway.chat({
      tenantId,
      taskType: 'customer_opportunity_identify',
      chatParams: { messages, temperature: 0.3, maxTokens: 2048 },
    });
    parsed = JSON.parse(result.text);
  } catch {
    parsed = {
      suggestions: [
        {
          title: '综合金融服务需求',
          description: '基于客户当前经营状况，可能存在综合金融服务需求',
          estimatedAmount: null,
          probability: 30,
          expectedCloseAt: null,
          rationale: '基于客户基本信息推断，需进一步沟通确认',
        },
      ],
    };
  }

  return (parsed.suggestions ?? []).map((s) => ({
    customerId: customer.id,
    customerName: customer.name,
    title: s.title,
    description: s.description,
    estimatedAmount: s.estimatedAmount,
    probability: s.probability,
    expectedCloseAt: s.expectedCloseAt,
    rationale: s.rationale,
    confirmed: false,
  }));
}

export type CustomerCreateInput = {
  name: string;
  type?: string;
  level?: string;
  enterpriseId?: string;
  managerId?: string;
  profile?: Record<string, unknown>;
  tags?: string[];
};

export type CustomerUpdateInput = {
  name?: string;
  type?: string;
  level?: string;
  status?: string;
  profile?: Record<string, unknown>;
  tags?: string[];
};

export async function createCustomer(
  tenantId: string,
  input: CustomerCreateInput,
): Promise<CustomerRow> {
  const db = getSupabaseClient();
  const id = crypto.randomUUID();
  const now = new Date().toISOString();

  if (input.enterpriseId) {
    const { data: enterprise } = await db
      .from('enterprise')
      .select('id')
      .eq('id', input.enterpriseId)
      .eq('tenant_id', tenantId)
      .limit(1);
    if (!enterprise?.[0]) {
      throw new Error('关联企业不存在');
    }
  }

  const { data, error: insertError } = await db
    .from('customer')
    .insert({
      id,
      tenant_id: tenantId,
      name: input.name,
      type: input.type ?? 'corp',
      enterprise_id: input.enterpriseId ?? null,
      manager_id: input.managerId ?? null,
      level: input.level ?? null,
      status: 'active',
      profile: input.profile ?? {},
      tags: input.tags ?? [],
      created_at: now,
      updated_at: now,
    })
    .select('*')
    .limit(1);

  if (insertError) {
    throw new Error(`创建客户失败: ${insertError.message}`);
  }

  return (data?.[0] as CustomerRow) ?? null;
}

export async function updateCustomer(
  tenantId: string,
  customerId: string,
  input: CustomerUpdateInput,
): Promise<CustomerRow | null> {
  const db = getSupabaseClient();
  const now = new Date().toISOString();

  const updateFields: Record<string, unknown> = { updated_at: now };
  if (input.name !== undefined) updateFields.name = input.name;
  if (input.type !== undefined) updateFields.type = input.type;
  if (input.level !== undefined) updateFields.level = input.level;
  if (input.status !== undefined) updateFields.status = input.status;
  if (input.profile !== undefined) updateFields.profile = input.profile;
  if (input.tags !== undefined) updateFields.tags = input.tags;

  const { data, error: updateError } = await db
    .from('customer')
    .update(updateFields)
    .eq('id', customerId)
    .eq('tenant_id', tenantId)
    .is('deleted_at', null)
    .select('*')
    .limit(1);

  if (updateError) {
    throw new Error(`更新客户失败: ${updateError.message}`);
  }

  return (data?.[0] as CustomerRow | undefined) ?? null;
}

export type OpportunityCreateInput = {
  customerId: string;
  title: string;
  stage?: string;
  amount?: number;
  probability?: number;
  expectedCloseAt?: string;
  ownerId?: string;
};

export async function createOpportunity(
  tenantId: string,
  input: OpportunityCreateInput,
): Promise<OpportunityRow> {
  const db = getSupabaseClient();
  const id = crypto.randomUUID();
  const now = new Date().toISOString();

  const { data, error: insertError } = await db
    .from('opportunity')
    .insert({
      id,
      tenant_id: tenantId,
      customer_id: input.customerId,
      title: input.title,
      stage: input.stage ?? 'initial',
      amount: input.amount ?? null,
      probability: input.probability ?? null,
      expected_close_at: input.expectedCloseAt ?? null,
      owner_id: input.ownerId ?? null,
      created_at: now,
      updated_at: now,
    })
    .select('*')
    .limit(1);

  if (insertError) {
    throw new Error(`创建商机失败: ${insertError.message}`);
  }

  return (data?.[0] as OpportunityRow) ?? null;
}