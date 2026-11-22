import { randomUUID } from 'node:crypto';
import type { SeedResult } from './seed-all';

type BankProductRow = {
  id: string;
  tenant_id: string;
  name: string;
  category: string;
  description: string;
  target_industry: string[];
  min_amount: number | null;
  max_amount: number | null;
  rate_range: string;
  term_range: string;
  status: string;
};

const BANK_PRODUCTS: Omit<BankProductRow, 'id' | 'tenant_id'>[] = [
  {
    name: '科技研发贷',
    category: '研发贷款',
    description: '面向人工智能、半导体、生物医药等科技型企业，支持核心技术研发投入，包括人员薪酬、实验设备、专利申请等研发支出。审批绿色通道，利率优惠。',
    target_industry: ['人工智能', '半导体/芯片', '生物医药'],
    min_amount: 5000000,
    max_amount: 50000000,
    rate_range: '3.5%-5.0%',
    term_range: '1-3年',
    status: 'active',
  },
  {
    name: '创新成长贷',
    category: '研发贷款',
    description: '面向智能制造、物联网等成长期科技企业，支持创新产品研发与技术升级。灵活还款方式，匹配企业成长节奏。',
    target_industry: ['智能制造', '物联网'],
    min_amount: 3000000,
    max_amount: 20000000,
    rate_range: '4.0%-5.5%',
    term_range: '1-2年',
    status: 'active',
  },
  {
    name: '产能扩张贷',
    category: '扩产贷款',
    description: '面向新能源、5G通信等高速扩张行业企业，支持产能扩建、产线升级、基地建设等资本支出。额度大、期限长，匹配重资产投入节奏。',
    target_industry: ['新能源', '5G通信'],
    min_amount: 10000000,
    max_amount: 100000000,
    rate_range: '4.5%-6.0%',
    term_range: '3-5年',
    status: 'active',
  },
  {
    name: '智造升级贷',
    category: '扩产贷款',
    description: '面向智能制造企业，支持数字化工厂建设、智能装备采购、工业互联网平台搭建等升级投入。专项支持制造业数字化转型。',
    target_industry: ['智能制造'],
    min_amount: 5000000,
    max_amount: 30000000,
    rate_range: '4.0%-5.5%',
    term_range: '2-3年',
    status: 'active',
  },
  {
    name: '智能结算通',
    category: '结算服务',
    description: '面向全行业企业提供智能结算服务，支持实时清算、批量支付、自动对账等功能。费率低廉，结算效率行业领先。',
    target_industry: ['人工智能', '半导体/芯片', '新能源', '生物医药', '智能制造', '金融科技', '电子商务', '云计算', '物联网', '5G通信'],
    min_amount: null,
    max_amount: null,
    rate_range: '0.1%-0.3%',
    term_range: '不限',
    status: 'active',
  },
  {
    name: '全球结算宝',
    category: '结算服务',
    description: '面向电子商务、金融科技等跨境业务企业，提供全球多币种结算、跨境支付、汇率风险管理等一站式服务。',
    target_industry: ['电子商务', '金融科技'],
    min_amount: null,
    max_amount: null,
    rate_range: '0.15%-0.35%',
    term_range: '不限',
    status: 'active',
  },
  {
    name: '供应链融通',
    category: '供应链金融',
    description: '面向全行业企业提供供应链金融服务，基于核心企业信用，为上下游供应商提供应收账款融资、预付款融资等灵活方案。',
    target_industry: ['人工智能', '半导体/芯片', '新能源', '生物医药', '智能制造', '金融科技', '电子商务', '云计算', '物联网', '5G通信'],
    min_amount: 1000000,
    max_amount: 50000000,
    rate_range: '3.8%-5.5%',
    term_range: '90-180天',
    status: 'active',
  },
  {
    name: '链链贷',
    category: '供应链金融',
    description: '面向智能制造、新能源等产业链核心企业，提供深度供应链融资服务。支持多级供应商穿透融资，解决深层供应链资金需求。',
    target_industry: ['智能制造', '新能源'],
    min_amount: 2000000,
    max_amount: 20000000,
    rate_range: '4.0%-5.5%',
    term_range: '90-360天',
    status: 'active',
  },
  {
    name: '跨境金融通',
    category: '国际化金融',
    description: '面向电子商务、5G通信等出海企业，提供跨境融资、海外结算、汇率避险、出口信用保险等综合金融服务。',
    target_industry: ['电子商务', '5G通信'],
    min_amount: 5000000,
    max_amount: 50000000,
    rate_range: '4.5%-6.5%',
    term_range: '1-3年',
    status: 'active',
  },
  {
    name: '海外并购贷',
    category: '国际化金融',
    description: '面向全行业企业提供海外并购融资支持，包括并购贷款、过桥贷款、并购债券等。支持中国企业全球化战略布局。',
    target_industry: ['人工智能', '半导体/芯片', '新能源', '生物医药', '智能制造', '金融科技', '电子商务', '云计算', '物联网', '5G通信'],
    min_amount: 10000000,
    max_amount: 500000000,
    rate_range: '5.0%-7.0%',
    term_range: '3-7年',
    status: 'active',
  },
];

export async function seedBankProducts(tenantId: string): Promise<SeedResult> {
  console.log(`[Seed] bank-products: tenant=${tenantId}`);
  const failures: Array<{ rowIndex: number; reason: string }> = [];
  let successCount = 0;

  let supabase;
  try {
    const { getSupabaseClient } = await import('@/storage/database/supabase-client');
    supabase = getSupabaseClient();
  } catch (err) {
    console.warn('[Seed] bank-products: Supabase client unavailable (DEMO_MODE), skipping actual writes');
    console.log('[Seed] bank-products: Data prepared — 10 bank financial products');
    return {
      module: 'bank-products',
      successCount: 0,
      failureCount: BANK_PRODUCTS.length,
      failures: BANK_PRODUCTS.map((_, i) => ({ rowIndex: i, reason: 'DEMO_MODE: database not connected' })),
    };
  }

  for (let i = 0; i < BANK_PRODUCTS.length; i++) {
    const product = BANK_PRODUCTS[i];
    const id = randomUUID();
    const row: BankProductRow = {
      ...product,
      id,
      tenant_id: tenantId,
    };

    try {
      const { data: existing } = await supabase
        .from('bank_product')
        .select('id')
        .eq('tenant_id', tenantId)
        .eq('name', product.name)
        .maybeSingle();

      if (existing) {
        const { error } = await supabase
          .from('bank_product')
          .update({
            category: row.category,
            description: row.description,
            target_industry: row.target_industry,
            min_amount: row.min_amount,
            max_amount: row.max_amount,
            rate_range: row.rate_range,
            term_range: row.term_range,
            status: row.status,
          })
          .eq('id', existing.id);
        if (error) {
          failures.push({ rowIndex: i, reason: `Update failed: ${error.message}` });
        } else {
          successCount++;
        }
      } else {
        const { error } = await supabase.from('bank_product').insert(row);
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

  return { module: 'bank-products', successCount, failureCount: failures.length, failures };
}