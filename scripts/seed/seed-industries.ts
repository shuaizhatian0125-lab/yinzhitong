import { randomUUID } from 'node:crypto';
import type { SeedResult } from './seed-all';

type IndustryRow = {
  id: string;
  tenant_id: string;
  name: string;
  code: string;
  parent_id: string | null;
  level: number;
  description: string;
};

const PARENT_INDUSTRIES: Array<{
  name: string;
  code: string;
  description: string;
}> = [
  { name: '信息技术', code: 'IT', description: '涵盖人工智能、半导体、云计算、物联网等核心技术领域' },
  { name: '能源', code: 'ENERGY', description: '涵盖新能源、传统能源等能源产业' },
  { name: '医疗健康', code: 'HEALTH', description: '涵盖生物医药、医疗器械、医疗服务等' },
  { name: '制造业', code: 'MANUFACTURING', description: '涵盖智能制造、传统制造等制造业领域' },
  { name: '金融服务', code: 'FINANCE', description: '涵盖银行、保险、金融科技等金融服务' },
  { name: '零售', code: 'RETAIL', description: '涵盖电子商务、传统零售等零售业态' },
  { name: '通信', code: 'TELECOM', description: '涵盖5G通信、传统通信等通信产业' },
];

const SUB_INDUSTRIES: Array<{
  name: string;
  code: string;
  parentCode: string;
  description: string;
}> = [
  { name: '人工智能', code: 'AI', parentCode: 'IT', description: '涵盖大模型、计算机视觉、语音技术、自然语言处理等AI核心领域，市场规模超千亿' },
  { name: '半导体/芯片', code: 'SEMI', parentCode: 'IT', description: '涵盖芯片设计、制造、封测等半导体全产业链，国产替代加速推进' },
  { name: '新能源', code: 'NEW_ENERGY', parentCode: 'ENERGY', description: '涵盖动力电池、光伏、风电等新能源产业，全球碳中和驱动高速增长' },
  { name: '生物医药', code: 'BIO_PHARMA', parentCode: 'HEALTH', description: '涵盖创新药、疫苗、基因治疗等生物医药前沿领域' },
  { name: '智能制造', code: 'SMART_MFG', parentCode: 'MANUFACTURING', description: '涵盖工业互联网、智能装备、数字化工厂等智能制造领域' },
  { name: '金融科技', code: 'FIN_TECH', parentCode: 'FINANCE', description: '涵盖支付、区块链、数字货币、智能风控等金融科技领域' },
  { name: '电子商务', code: 'E_COMMERCE', parentCode: 'RETAIL', description: '涵盖综合电商、垂直电商、跨境电商等电子商务业态' },
  { name: '云计算', code: 'CLOUD', parentCode: 'IT', description: '涵盖IaaS、PaaS、SaaS等云计算服务，企业数字化转型核心基础设施' },
  { name: '物联网', code: 'IOT', parentCode: 'IT', description: '涵盖智能硬件、工业物联网、车联网等物联网应用领域' },
  { name: '5G通信', code: '5G', parentCode: 'TELECOM', description: '涵盖5G网络建设、5G应用、5G终端等5G全产业链' },
];

export async function seedIndustries(tenantId: string): Promise<SeedResult> {
  console.log(`[Seed] industries: tenant=${tenantId}`);
  const failures: Array<{ rowIndex: number; reason: string }> = [];
  let successCount = 0;

  let supabase;
  try {
    const { getSupabaseClient } = await import('@/storage/database/supabase-client');
    supabase = getSupabaseClient();
  } catch (err) {
    console.warn('[Seed] industries: Supabase client unavailable (DEMO_MODE), skipping actual writes');
    console.log('[Seed] industries: Data prepared — 7 parent industries + 10 sub industries');
    return {
      module: 'industries',
      successCount: 0,
      failureCount: PARENT_INDUSTRIES.length + SUB_INDUSTRIES.length,
      failures: PARENT_INDUSTRIES.map((_, i) => ({ rowIndex: i, reason: 'DEMO_MODE: database not connected' })),
    };
  }

  const parentIdMap = new Map<string, string>();

  for (let i = 0; i < PARENT_INDUSTRIES.length; i++) {
    const parent = PARENT_INDUSTRIES[i];
    const id = randomUUID();
    const row: IndustryRow = {
      id,
      tenant_id: tenantId,
      name: parent.name,
      code: parent.code,
      parent_id: null,
      level: 1,
      description: parent.description,
    };

    try {
      const { data: existing } = await supabase
        .from('industry')
        .select('id')
        .eq('tenant_id', tenantId)
        .eq('code', parent.code)
        .maybeSingle();

      if (existing) {
        parentIdMap.set(parent.code, existing.id);
        const { error } = await supabase
          .from('industry')
          .update({ name: parent.name, description: parent.description })
          .eq('id', existing.id);
        if (error) {
          failures.push({ rowIndex: i, reason: `Update failed: ${error.message}` });
        } else {
          successCount++;
        }
      } else {
        parentIdMap.set(parent.code, id);
        const { error } = await supabase.from('industry').insert(row);
        if (error) {
          failures.push({ rowIndex: i, reason: `Insert failed: ${error.message}` });
        } else {
          successCount++;
        }
      }
    } catch (err) {
      failures.push({ rowIndex: i, reason: String(err) });
    }
  }

  for (let i = 0; i < SUB_INDUSTRIES.length; i++) {
    const sub = SUB_INDUSTRIES[i];
    const parentId = parentIdMap.get(sub.parentCode);
    if (!parentId) {
      failures.push({ rowIndex: PARENT_INDUSTRIES.length + i, reason: `Parent industry ${sub.parentCode} not found` });
      continue;
    }

    const id = randomUUID();
    const row: IndustryRow = {
      id,
      tenant_id: tenantId,
      name: sub.name,
      code: sub.code,
      parent_id: parentId,
      level: 2,
      description: sub.description,
    };

    try {
      const { data: existing } = await supabase
        .from('industry')
        .select('id')
        .eq('tenant_id', tenantId)
        .eq('code', sub.code)
        .maybeSingle();

      if (existing) {
        const { error } = await supabase
          .from('industry')
          .update({ name: sub.name, parent_id: parentId, description: sub.description })
          .eq('id', existing.id);
        if (error) {
          failures.push({ rowIndex: PARENT_INDUSTRIES.length + i, reason: `Update failed: ${error.message}` });
        } else {
          successCount++;
        }
      } else {
        const { error } = await supabase.from('industry').insert(row);
        if (error) {
          failures.push({ rowIndex: PARENT_INDUSTRIES.length + i, reason: `Insert failed: ${error.message}` });
        } else {
          successCount++;
        }
      }
    } catch (err) {
      failures.push({ rowIndex: PARENT_INDUSTRIES.length + i, reason: String(err) });
    }
  }

  return { module: 'industries', successCount, failureCount: failures.length, failures };
}