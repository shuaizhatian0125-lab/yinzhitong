import { getSupabaseClient } from '@/storage/database/supabase-client';
import type { DocumentBlock } from './document-service';

export type TemplateRow = {
  id: string;
  tenantId: string;
  code: string;
  name: string;
  docType: string;
  scope: string;
  definition: { blocks: DocumentBlock[]; outline: string[] };
  status: string;
  createdBy: string | null;
  createdAt: string;
};

export type TemplateInput = {
  code: string;
  name: string;
  docType: string;
  definition: { blocks: DocumentBlock[]; outline: string[] };
};

const PRESET_TEMPLATES: Array<{
  code: string;
  name: string;
  docType: string;
  blocks: DocumentBlock[];
  outline: string[];
}> = [
  {
    code: 'weekly_report',
    name: '周报',
    docType: 'report',
    outline: ['本周工作概述', '主要工作进展', '问题与风险', '下周计划'],
    blocks: [
      { type: 'heading', attrs: { level: 1 }, text: '周报' },
      { type: 'heading', attrs: { level: 2 }, text: '一、本周工作概述' },
      { type: 'paragraph', attrs: {}, text: '' },
      { type: 'heading', attrs: { level: 2 }, text: '二、主要工作进展' },
      { type: 'paragraph', attrs: {}, text: '' },
      { type: 'heading', attrs: { level: 2 }, text: '三、问题与风险' },
      { type: 'paragraph', attrs: {}, text: '' },
      { type: 'heading', attrs: { level: 2 }, text: '四、下周计划' },
      { type: 'paragraph', attrs: {}, text: '' },
    ],
  },
  {
    code: 'monthly_report',
    name: '月报',
    docType: 'report',
    outline: ['月度工作总结', '关键指标完成情况', '重点事项回顾', '问题分析与改进', '下月工作计划'],
    blocks: [
      { type: 'heading', attrs: { level: 1 }, text: '月报' },
      { type: 'heading', attrs: { level: 2 }, text: '一、月度工作总结' },
      { type: 'paragraph', attrs: {}, text: '' },
      { type: 'heading', attrs: { level: 2 }, text: '二、关键指标完成情况' },
      { type: 'paragraph', attrs: {}, text: '' },
      { type: 'heading', attrs: { level: 2 }, text: '三、重点事项回顾' },
      { type: 'paragraph', attrs: {}, text: '' },
      { type: 'heading', attrs: { level: 2 }, text: '四、问题分析与改进' },
      { type: 'paragraph', attrs: {}, text: '' },
      { type: 'heading', attrs: { level: 2 }, text: '五、下月工作计划' },
      { type: 'paragraph', attrs: {}, text: '' },
    ],
  },
  {
    code: 'enterprise_value_report',
    name: '企业价值发现报告',
    docType: 'analysis',
    outline: ['企业概况', '行业地位', '财务分析', '核心竞争力', '风险因素', '价值评估结论'],
    blocks: [
      { type: 'heading', attrs: { level: 1 }, text: '企业价值发现报告' },
      { type: 'heading', attrs: { level: 2 }, text: '一、企业概况' },
      { type: 'paragraph', attrs: {}, text: '' },
      { type: 'heading', attrs: { level: 2 }, text: '二、行业地位' },
      { type: 'paragraph', attrs: {}, text: '' },
      { type: 'heading', attrs: { level: 2 }, text: '三、财务分析' },
      { type: 'paragraph', attrs: {}, text: '' },
      { type: 'heading', attrs: { level: 2 }, text: '四、核心竞争力' },
      { type: 'paragraph', attrs: {}, text: '' },
      { type: 'heading', attrs: { level: 2 }, text: '五、风险因素' },
      { type: 'paragraph', attrs: {}, text: '' },
      { type: 'heading', attrs: { level: 2 }, text: '六、价值评估结论' },
      { type: 'paragraph', attrs: {}, text: '' },
    ],
  },
  {
    code: 'industry_research_report',
    name: '行业研究报告',
    docType: 'research',
    outline: ['行业概述', '市场规模与增长', '竞争格局', '政策环境', '发展趋势', '投资建议'],
    blocks: [
      { type: 'heading', attrs: { level: 1 }, text: '行业研究报告' },
      { type: 'heading', attrs: { level: 2 }, text: '一、行业概述' },
      { type: 'paragraph', attrs: {}, text: '' },
      { type: 'heading', attrs: { level: 2 }, text: '二、市场规模与增长' },
      { type: 'paragraph', attrs: {}, text: '' },
      { type: 'heading', attrs: { level: 2 }, text: '三、竞争格局' },
      { type: 'paragraph', attrs: {}, text: '' },
      { type: 'heading', attrs: { level: 2 }, text: '四、政策环境' },
      { type: 'paragraph', attrs: {}, text: '' },
      { type: 'heading', attrs: { level: 2 }, text: '五、发展趋势' },
      { type: 'paragraph', attrs: {}, text: '' },
      { type: 'heading', attrs: { level: 2 }, text: '六、投资建议' },
      { type: 'paragraph', attrs: {}, text: '' },
    ],
  },
  {
    code: 'meeting_minutes',
    name: '会议纪要',
    docType: 'minutes',
    outline: ['会议信息', '参会人员', '议题与讨论', '决议事项', '后续行动项'],
    blocks: [
      { type: 'heading', attrs: { level: 1 }, text: '会议纪要' },
      { type: 'heading', attrs: { level: 2 }, text: '一、会议信息' },
      { type: 'paragraph', attrs: {}, text: '会议时间：\n会议地点：\n主持人：' },
      { type: 'heading', attrs: { level: 2 }, text: '二、参会人员' },
      { type: 'paragraph', attrs: {}, text: '' },
      { type: 'heading', attrs: { level: 2 }, text: '三、议题与讨论' },
      { type: 'paragraph', attrs: {}, text: '' },
      { type: 'heading', attrs: { level: 2 }, text: '四、决议事项' },
      { type: 'paragraph', attrs: {}, text: '' },
      { type: 'heading', attrs: { level: 2 }, text: '五、后续行动项' },
      { type: 'paragraph', attrs: {}, text: '' },
    ],
  },
  {
    code: 'visit_plan',
    name: '拜访方案',
    docType: 'plan',
    outline: ['拜访目标', '客户背景', '拜访策略', '议程安排', '预期成果', '后续跟进'],
    blocks: [
      { type: 'heading', attrs: { level: 1 }, text: '拜访方案' },
      { type: 'heading', attrs: { level: 2 }, text: '一、拜访目标' },
      { type: 'paragraph', attrs: {}, text: '' },
      { type: 'heading', attrs: { level: 2 }, text: '二、客户背景' },
      { type: 'paragraph', attrs: {}, text: '' },
      { type: 'heading', attrs: { level: 2 }, text: '三、拜访策略' },
      { type: 'paragraph', attrs: {}, text: '' },
      { type: 'heading', attrs: { level: 2 }, text: '四、议程安排' },
      { type: 'paragraph', attrs: {}, text: '' },
      { type: 'heading', attrs: { level: 2 }, text: '五、预期成果' },
      { type: 'paragraph', attrs: {}, text: '' },
      { type: 'heading', attrs: { level: 2 }, text: '六、后续跟进' },
      { type: 'paragraph', attrs: {}, text: '' },
    ],
  },
];

export async function ensurePresetTemplates(tenantId: string): Promise<void> {
  const db = getSupabaseClient();

  for (const preset of PRESET_TEMPLATES) {
    const { data: existing } = await db
      .from('document_template')
      .select('id')
      .eq('tenant_id', tenantId)
      .eq('code', preset.code)
      .limit(1);

    if (existing && existing.length > 0) continue;

    await db.from('document_template').insert({
      id: crypto.randomUUID(),
      tenant_id: tenantId,
      code: preset.code,
      name: preset.name,
      doc_type: preset.docType,
      scope: 'tenant',
      definition: {
        blocks: preset.blocks,
        outline: preset.outline,
      },
      status: 'active',
    });
  }
}

export async function listTemplates(tenantId: string): Promise<TemplateRow[]> {
  const db = getSupabaseClient();
  await ensurePresetTemplates(tenantId);

  const { data } = await db
    .from('document_template')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('status', 'active')
    .order('created_at', { ascending: true });

  return (data ?? []).map(mapTemplateRow);
}

export async function getTemplate(tenantId: string, id: string): Promise<TemplateRow | null> {
  const db = getSupabaseClient();
  const { data } = await db
    .from('document_template')
    .select('*')
    .eq('id', id)
    .eq('tenant_id', tenantId)
    .eq('status', 'active')
    .limit(1);

  return data?.[0] ? mapTemplateRow(data[0]) : null;
}

export async function createTemplate(
  tenantId: string,
  userId: string,
  input: TemplateInput,
): Promise<TemplateRow> {
  const db = getSupabaseClient();
  const id = crypto.randomUUID();

  const { data, error } = await db
    .from('document_template')
    .insert({
      id,
      tenant_id: tenantId,
      code: input.code,
      name: input.name,
      doc_type: input.docType,
      scope: 'tenant',
      definition: input.definition,
      status: 'active',
      created_by: userId,
    })
    .select()
    .single();

  if (error || !data) {
    throw new Error(`创建模板失败: ${error?.message ?? '未知错误'}`);
  }

  return mapTemplateRow(data);
}

function mapTemplateRow(row: Record<string, unknown>): TemplateRow {
  return {
    id: row.id as string,
    tenantId: row.tenant_id as string,
    code: row.code as string,
    name: row.name as string,
    docType: row.doc_type as string,
    scope: row.scope as string,
    definition: (row.definition as { blocks: DocumentBlock[]; outline: string[] }) ?? { blocks: [], outline: [] },
    status: row.status as string,
    createdBy: row.created_by as string | null,
    createdAt: row.created_at as string,
  };
}