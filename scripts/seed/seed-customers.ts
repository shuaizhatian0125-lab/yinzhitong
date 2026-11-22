import { randomUUID } from 'node:crypto';
import type { SeedResult } from './seed-all';

type CustomerContactRow = {
  id: string;
  tenant_id: string;
  customer_id: string;
  name: string;
  title: string;
  mobile_enc: string;
  email: string;
  decision_role: string;
};

type OpportunityRow = {
  id: string;
  tenant_id: string;
  customer_id: string;
  title: string;
  stage: string;
  amount: number;
  probability: number;
  expected_close_at: string;
  owner_id: string;
};

type VisitRecordRow = {
  id: string;
  tenant_id: string;
  customer_id: string;
  user_id: string;
  visited_at: string;
  purpose: string;
  summary: string;
  next_action: string;
};

type CustomerData = {
  name: string;
  level: string;
  enterpriseName: string;
  tags: string[];
  contacts: Array<{
    name: string;
    title: string;
    decision_role: string;
  }>;
  opportunities: Array<{
    title: string;
    stage: string;
    amount: number;
    probability: number;
    expected_close_at: string;
  }>;
  visits: Array<{
    purpose: string;
    summary: string;
    next_action: string;
    visited_at: string;
  }>;
};

const CUSTOMERS: CustomerData[] = [
  {
    name: '华为技术有限公司',
    level: 'A',
    enterpriseName: '华为技术有限公司',
    tags: ['战略客户', '科技龙头', '通信设备'],
    contacts: [
      { name: '张志远', title: '财务总监', decision_role: '决策人' },
      { name: '李明辉', title: '资金管理部经理', decision_role: '影响人' },
      { name: '王建国', title: '供应链金融主管', decision_role: '使用者' },
    ],
    opportunities: [
      { title: '供应链融通服务', stage: 'proposal', amount: 50000000, probability: 60, expected_close_at: '2026-06-30' },
      { title: '跨境金融通-海外业务结算', stage: 'qualified', amount: 30000000, probability: 40, expected_close_at: '2026-09-30' },
    ],
    visits: [
      { purpose: '年度授信方案沟通', summary: '与财务总监沟通2026年授信需求，华为计划扩大研发投入，需增加研发贷款额度', next_action: '准备科技研发贷方案', visited_at: '2026-01-15' },
      { purpose: '供应链金融需求调研', summary: '了解华为上下游供应商融资需求，供应商约2000家，融资需求旺盛', next_action: '设计供应链融通方案', visited_at: '2026-02-20' },
    ],
  },
  {
    name: '腾讯云计算',
    level: 'A',
    enterpriseName: '腾讯控股有限公司',
    tags: ['战略客户', '云计算', '互联网'],
    contacts: [
      { name: '陈晓东', title: 'CFO', decision_role: '决策人' },
      { name: '刘文涛', title: '财务副总裁', decision_role: '影响人' },
      { name: '赵思远', title: '资金部高级经理', decision_role: '使用者' },
    ],
    opportunities: [
      { title: '创新成长贷-云基础设施扩容', stage: 'negotiation', amount: 20000000, probability: 70, expected_close_at: '2026-03-31' },
      { title: '全球结算宝-跨境支付', stage: 'initial', amount: 10000000, probability: 30, expected_close_at: '2026-12-31' },
    ],
    visits: [
      { purpose: '云业务融资需求对接', summary: '腾讯云计划扩容数据中心，需创新成长贷支持，金额约2000万', next_action: '提交贷款审批材料', visited_at: '2026-01-20' },
      { purpose: '跨境结算业务沟通', summary: '腾讯云海外业务增长迅速，需跨境结算服务支持', next_action: '对接全球结算宝产品', visited_at: '2026-03-05' },
    ],
  },
  {
    name: '阿里云智能',
    level: 'A',
    enterpriseName: '阿里巴巴集团',
    tags: ['战略客户', '云计算', 'AI'],
    contacts: [
      { name: '吴敏杰', title: '集团财务负责人', decision_role: '决策人' },
      { name: '孙丽芳', title: '阿里云财务总监', decision_role: '影响人' },
      { name: '周文博', title: '资金运营经理', decision_role: '使用者' },
    ],
    opportunities: [
      { title: '产能扩张贷-数据中心建设', stage: 'proposal', amount: 50000000, probability: 55, expected_close_at: '2026-06-30' },
      { title: '智能结算通-平台结算服务', stage: 'qualified', amount: 5000000, probability: 50, expected_close_at: '2026-08-31' },
    ],
    visits: [
      { purpose: '阿里云扩产融资对接', summary: '阿里云计划新建3个数据中心，产能扩张贷需求约5000万', next_action: '制定扩产贷款方案', visited_at: '2026-02-10' },
      { purpose: '结算服务需求沟通', summary: '阿里电商平台日均交易量巨大，需高效结算服务', next_action: '对接智能结算通', visited_at: '2026-03-15' },
    ],
  },
  {
    name: '字节跳动科技',
    level: 'A',
    enterpriseName: '字节跳动',
    tags: ['战略客户', 'AI', '短视频'],
    contacts: [
      { name: '高振宇', title: '财务负责人', decision_role: '决策人' },
      { name: '马天明', title: '资金管理总监', decision_role: '影响人' },
      { name: '杨思琪', title: '海外业务财务经理', decision_role: '使用者' },
    ],
    opportunities: [
      { title: '跨境金融通-TikTok海外结算', stage: 'negotiation', amount: 30000000, probability: 65, expected_close_at: '2026-04-30' },
      { title: '科技研发贷-AI大模型研发', stage: 'qualified', amount: 40000000, probability: 45, expected_close_at: '2026-09-30' },
    ],
    visits: [
      { purpose: '跨境金融需求对接', summary: 'TikTok海外收入结算需求大，需跨境金融通服务', next_action: '设计跨境结算方案', visited_at: '2026-01-25' },
      { purpose: 'AI研发融资沟通', summary: '豆包大模型研发投入大，需科技研发贷支持', next_action: '准备研发贷方案', visited_at: '2026-03-01' },
    ],
  },
  {
    name: '百度在线网络',
    level: 'B',
    enterpriseName: '百度公司',
    tags: ['重点客户', 'AI', '搜索'],
    contacts: [
      { name: '余海峰', title: '财务副总裁', decision_role: '决策人' },
      { name: '林佳怡', title: '资金部经理', decision_role: '影响人' },
    ],
    opportunities: [
      { title: '科技研发贷-文心大模型', stage: 'proposal', amount: 15000000, probability: 50, expected_close_at: '2026-07-31' },
    ],
    visits: [
      { purpose: 'AI研发融资需求沟通', summary: '百度文心大模型研发持续投入，需研发贷支持约1500万', next_action: '准备研发贷审批', visited_at: '2026-02-15' },
    ],
  },
  {
    name: '京东物流集团',
    level: 'B',
    enterpriseName: '京东集团',
    tags: ['重点客户', '物流', '供应链'],
    contacts: [
      { name: '许志强', title: '物流集团CFO', decision_role: '决策人' },
      { name: '何文静', title: '供应链金融负责人', decision_role: '影响人' },
      { name: '罗建军', title: '资金运营主管', decision_role: '使用者' },
    ],
    opportunities: [
      { title: '供应链融通-京东物流供应商', stage: 'qualified', amount: 20000000, probability: 55, expected_close_at: '2026-05-31' },
      { title: '产能扩张贷-物流仓储扩建', stage: 'initial', amount: 30000000, probability: 35, expected_close_at: '2026-10-31' },
    ],
    visits: [
      { purpose: '供应链金融需求调研', summary: '京东物流上游供应商约5000家，供应链融通需求旺盛', next_action: '设计供应链融通方案', visited_at: '2026-02-25' },
    ],
  },
  {
    name: '美团优选',
    level: 'B',
    enterpriseName: '美团',
    tags: ['重点客户', '本地生活', '社区团购'],
    contacts: [
      { name: '秦晓波', title: '优选事业部财务总监', decision_role: '决策人' },
      { name: '邓丽君', title: '资金管理经理', decision_role: '影响人' },
    ],
    opportunities: [
      { title: '供应链融通-优选供应商融资', stage: 'proposal', amount: 10000000, probability: 45, expected_close_at: '2026-08-31' },
    ],
    visits: [
      { purpose: '社区团购供应链金融沟通', summary: '美团优选上游农产品供应商融资需求约1000万', next_action: '对接供应链融通产品', visited_at: '2026-03-10' },
    ],
  },
  {
    name: '大疆百旺科技',
    level: 'B',
    enterpriseName: '大疆创新',
    tags: ['重点客户', '无人机', '机器人'],
    contacts: [
      { name: '邵明远', title: '财务总监', decision_role: '决策人' },
      { name: '蔡文华', title: '资金部经理', decision_role: '影响人' },
    ],
    opportunities: [
      { title: '科技研发贷-行业无人机研发', stage: 'qualified', amount: 8000000, probability: 50, expected_close_at: '2026-06-30' },
      { title: '跨境金融通-海外销售结算', stage: 'initial', amount: 5000000, probability: 30, expected_close_at: '2026-12-31' },
    ],
    visits: [
      { purpose: '研发融资需求沟通', summary: '大疆行业级无人机研发投入大，需研发贷约800万', next_action: '准备研发贷方案', visited_at: '2026-02-28' },
    ],
  },
  {
    name: '商汤智能科技',
    level: 'C',
    enterpriseName: '商汤科技',
    tags: ['一般客户', 'AI', '计算机视觉'],
    contacts: [
      { name: '田立新', title: '财务负责人', decision_role: '决策人' },
      { name: '冯雅琴', title: '资金主管', decision_role: '影响人' },
    ],
    opportunities: [
      { title: '科技研发贷-大模型研发', stage: 'initial', amount: 5000000, probability: 25, expected_close_at: '2026-12-31' },
    ],
    visits: [
      { purpose: 'AI企业融资需求初步接触', summary: '商汤处于亏损期，研发投入大，需了解银行融资可能性', next_action: '评估授信风险', visited_at: '2026-03-20' },
    ],
  },
  {
    name: '旷视智能科技',
    level: 'C',
    enterpriseName: '旷视科技',
    tags: ['一般客户', 'AI', '计算机视觉'],
    contacts: [
      { name: '蒋文博', title: '财务总监', decision_role: '决策人' },
    ],
    opportunities: [
      { title: '科技研发贷-AIoT研发', stage: 'initial', amount: 3000000, probability: 20, expected_close_at: '2026-12-31' },
    ],
    visits: [
      { purpose: '融资需求初步接触', summary: '旷视IPO受阻，资金紧张，需了解银行融资渠道', next_action: '评估授信可行性', visited_at: '2026-03-25' },
    ],
  },
  {
    name: '科大讯飞信息',
    level: 'B',
    enterpriseName: '科大讯飞',
    tags: ['重点客户', 'AI', '语音技术', '教育'],
    contacts: [
      { name: '段志远', title: 'CFO', decision_role: '决策人' },
      { name: '尹晓芳', title: '资金部总监', decision_role: '影响人' },
      { name: '韦文杰', title: '教育事业部财务经理', decision_role: '使用者' },
    ],
    opportunities: [
      { title: '科技研发贷-星火大模型', stage: 'proposal', amount: 10000000, probability: 55, expected_close_at: '2026-06-30' },
      { title: '智能结算通-教育平台结算', stage: 'initial', amount: 2000000, probability: 30, expected_close_at: '2026-12-31' },
    ],
    visits: [
      { purpose: '大模型研发融资对接', summary: '星火大模型研发投入持续加大，需研发贷约1000万', next_action: '准备研发贷审批', visited_at: '2026-02-18' },
      { purpose: '教育业务结算需求沟通', summary: '讯飞教育平台覆盖全国学校，结算需求大', next_action: '对接智能结算通', visited_at: '2026-04-01' },
    ],
  },
  {
    name: '中芯国际集成电路',
    level: 'A',
    enterpriseName: '中芯国际',
    tags: ['战略客户', '半导体', '芯片制造'],
    contacts: [
      { name: '梁孟松', title: '联合CEO', decision_role: '决策人' },
      { name: '高永岗', title: 'CFO', decision_role: '决策人' },
      { name: '吴金刚', title: '资金管理部总经理', decision_role: '影响人' },
    ],
    opportunities: [
      { title: '产能扩张贷-晶圆厂扩建', stage: 'negotiation', amount: 100000000, probability: 75, expected_close_at: '2026-03-31' },
      { title: '供应链融通-设备供应商融资', stage: 'proposal', amount: 30000000, probability: 50, expected_close_at: '2026-06-30' },
    ],
    visits: [
      { purpose: '扩产融资方案沟通', summary: '中芯国际计划扩建28nm产线，产能扩张贷需求约1亿', next_action: '提交扩产贷审批', visited_at: '2026-01-10' },
      { purpose: '供应链金融需求调研', summary: '中芯国际上游设备供应商融资需求约3000万', next_action: '设计供应链融通方案', visited_at: '2026-02-22' },
    ],
  },
  {
    name: '宁德时代新能源',
    level: 'A',
    enterpriseName: '宁德时代',
    tags: ['战略客户', '新能源', '动力电池'],
    contacts: [
      { name: '曾毓群', title: '董事长', decision_role: '决策人' },
      { name: '周佳', title: 'CFO', decision_role: '决策人' },
      { name: '汪云飞', title: '资金部总监', decision_role: '影响人' },
    ],
    opportunities: [
      { title: '产能扩张贷-电池基地建设', stage: 'negotiation', amount: 80000000, probability: 80, expected_close_at: '2026-04-30' },
      { title: '供应链融通-锂矿供应商融资', stage: 'qualified', amount: 20000000, probability: 60, expected_close_at: '2026-07-31' },
    ],
    visits: [
      { purpose: '扩产融资方案沟通', summary: '宁德时代计划新建宜春基地，产能扩张贷需求约8000万', next_action: '提交扩产贷审批', visited_at: '2026-01-08' },
      { purpose: '供应链金融需求调研', summary: '宁德时代上游锂矿/材料供应商融资需求约2000万', next_action: '设计供应链融通方案', visited_at: '2026-02-15' },
      { purpose: '储能业务融资对接', summary: '储能业务高速增长，需额外融资支持', next_action: '评估储能业务授信', visited_at: '2026-03-18' },
    ],
  },
  {
    name: '比亚迪股份',
    level: 'A',
    enterpriseName: '比亚迪',
    tags: ['战略客户', '新能源汽车', '电池'],
    contacts: [
      { name: '王传福', title: '董事长', decision_role: '决策人' },
      { name: '廉玉波', title: 'CFO', decision_role: '决策人' },
      { name: '罗红斌', title: '资金管理部总经理', decision_role: '影响人' },
    ],
    opportunities: [
      { title: '产能扩张贷-新能源车产线', stage: 'negotiation', amount: 100000000, probability: 85, expected_close_at: '2026-03-31' },
      { title: '供应链融通-电池材料供应商', stage: 'proposal', amount: 40000000, probability: 55, expected_close_at: '2026-06-30' },
    ],
    visits: [
      { purpose: '年度授信方案沟通', summary: '比亚迪2026年扩产计划庞大，产能扩张贷需求约1亿', next_action: '提交扩产贷审批', visited_at: '2026-01-05' },
      { purpose: '供应链金融需求调研', summary: '比亚迪上游电池材料供应商约3000家，融资需求旺盛', next_action: '设计供应链融通方案', visited_at: '2026-02-12' },
    ],
  },
  {
    name: '小米通讯技术',
    level: 'B',
    enterpriseName: '小米集团',
    tags: ['重点客户', '智能手机', 'IoT', '新能源汽车'],
    contacts: [
      { name: '林斌', title: '副董事长', decision_role: '决策人' },
      { name: '卢伟冰', title: '财务副总裁', decision_role: '影响人' },
      { name: '曾学忠', title: '资金部经理', decision_role: '使用者' },
    ],
    opportunities: [
      { title: '产能扩张贷-汽车产线建设', stage: 'proposal', amount: 30000000, probability: 50, expected_close_at: '2026-06-30' },
      { title: '供应链融通-IoT供应商融资', stage: 'qualified', amount: 15000000, probability: 45, expected_close_at: '2026-09-30' },
    ],
    visits: [
      { purpose: '汽车业务融资需求沟通', summary: '小米汽车产线建设投入大，产能扩张贷需求约3000万', next_action: '准备扩产贷方案', visited_at: '2026-02-08' },
      { purpose: 'IoT供应链金融调研', summary: '小米IoT生态链企业约400家，供应链融通需求约1500万', next_action: '设计供应链融通方案', visited_at: '2026-03-22' },
    ],
  },
];

export async function seedCustomers(tenantId: string): Promise<SeedResult> {
  console.log(`[Seed] customers: tenant=${tenantId}`);
  const failures: Array<{ rowIndex: number; reason: string }> = [];
  let successCount = 0;

  let supabase;
  try {
    const { getSupabaseClient } = await import('@/storage/database/supabase-client');
    supabase = getSupabaseClient();
  } catch (err) {
    console.warn('[Seed] customers: Supabase client unavailable (DEMO_MODE), skipping actual writes');
    console.log('[Seed] customers: Data prepared — 15 customers with contacts, opportunities, visits');
    return {
      module: 'customers',
      successCount: 0,
      failureCount: CUSTOMERS.length,
      failures: CUSTOMERS.map((_, i) => ({ rowIndex: i, reason: 'DEMO_MODE: database not connected' })),
    };
  }

  for (let i = 0; i < CUSTOMERS.length; i++) {
    const cust = CUSTOMERS[i];
    const customerId = randomUUID();

    try {
      const { data: existingCustomer } = await supabase
        .from('customer')
        .select('id')
        .eq('tenant_id', tenantId)
        .eq('name', cust.name)
        .maybeSingle();

      let actualCustomerId: string;

      if (existingCustomer) {
        actualCustomerId = existingCustomer.id;
        const { data: entData } = await supabase
          .from('enterprise')
          .select('id')
          .eq('tenant_id', tenantId)
          .eq('name', cust.enterpriseName)
          .maybeSingle();

        const { error: updateErr } = await supabase
          .from('customer')
          .update({
            level: cust.level,
            status: 'active',
            type: 'corp',
            enterprise_id: entData?.id ?? null,
            tags: cust.tags,
          })
          .eq('id', actualCustomerId);

        if (updateErr) {
          failures.push({ rowIndex: i, reason: `Customer update failed: ${updateErr.message}` });
          continue;
        }
      } else {
        const { data: entData } = await supabase
          .from('enterprise')
          .select('id')
          .eq('tenant_id', tenantId)
          .eq('name', cust.enterpriseName)
          .maybeSingle();

        const { error: insertErr } = await supabase.from('customer').insert({
          id: customerId,
          tenant_id: tenantId,
          name: cust.name,
          type: 'corp',
          enterprise_id: entData?.id ?? null,
          level: cust.level,
          status: 'active',
          tags: cust.tags,
          profile: {},
        });

        if (insertErr) {
          failures.push({ rowIndex: i, reason: `Customer insert failed: ${insertErr.message}` });
          continue;
        }
        actualCustomerId = customerId;
      }

      successCount++;

      for (const contact of cust.contacts) {
        const contactId = randomUUID();
        const { data: existingContact } = await supabase
          .from('customer_contact')
          .select('id')
          .eq('tenant_id', tenantId)
          .eq('customer_id', actualCustomerId)
          .eq('name', contact.name)
          .maybeSingle();

        if (existingContact) {
          await supabase
            .from('customer_contact')
            .update({
              title: contact.title,
              decision_role: contact.decision_role,
            })
            .eq('id', existingContact.id);
        } else {
          await supabase.from('customer_contact').insert({
            id: contactId,
            tenant_id: tenantId,
            customer_id: actualCustomerId,
            name: contact.name,
            title: contact.title,
            decision_role: contact.decision_role,
          });
        }
      }

      for (const opp of cust.opportunities) {
        const oppId = randomUUID();
        const { data: existingOpp } = await supabase
          .from('opportunity')
          .select('id')
          .eq('tenant_id', tenantId)
          .eq('customer_id', actualCustomerId)
          .eq('title', opp.title)
          .maybeSingle();

        if (existingOpp) {
          await supabase
            .from('opportunity')
            .update({
              stage: opp.stage,
              amount: opp.amount,
              probability: opp.probability,
              expected_close_at: opp.expected_close_at,
            })
            .eq('id', existingOpp.id);
        } else {
          await supabase.from('opportunity').insert({
            id: oppId,
            tenant_id: tenantId,
            customer_id: actualCustomerId,
            title: opp.title,
            stage: opp.stage,
            amount: opp.amount,
            probability: opp.probability,
            expected_close_at: opp.expected_close_at,
          });
        }
      }

      for (const visit of cust.visits) {
        const visitId = randomUUID();
        const { data: existingVisit } = await supabase
          .from('visit_record')
          .select('id')
          .eq('tenant_id', tenantId)
          .eq('customer_id', actualCustomerId)
          .eq('purpose', visit.purpose)
          .maybeSingle();

        if (existingVisit) {
          await supabase
            .from('visit_record')
            .update({
              summary: visit.summary,
              next_action: visit.next_action,
              visited_at: visit.visited_at,
            })
            .eq('id', existingVisit.id);
        } else {
          await supabase.from('visit_record').insert({
            id: visitId,
            tenant_id: tenantId,
            customer_id: actualCustomerId,
            user_id: 'system-seed',
            visited_at: visit.visited_at,
            purpose: visit.purpose,
            summary: visit.summary,
            next_action: visit.next_action,
          });
        }
      }
    } catch (err) {
      failures.push({ rowIndex: i, reason: String(err) });
    }
  }

  return { module: 'customers', successCount, failureCount: failures.length, failures };
}