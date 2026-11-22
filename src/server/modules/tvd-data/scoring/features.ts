/**
 * 输入特征构建：把落库的客观事实折算成指标要的数值。
 *
 * 三条硬约束：
 * 1) 不读系统时间。"近 3 年"这种口径必须锚在一个显式的 cutoff 年份上，
 *    否则同一条数据今天跑和明天跑分数会漂，回归测试也无从对比。
 * 2) 没有采到的信号类型返回 null，不返回 0。
 *    0 的含义是"采集了、确认没有"，null 的含义是"这个源根本没接进来"。
 *    把两者混在一起，就是把"无法接入"伪装成"企业没有"。
 * 3) 同名发明人不自动合并成人（身份归并需要证据），所以人才类指标一律偏保守。
 */

import type { FeatureSet } from './types';

export type PatentFact = {
  patentType: string;
  legalStatus: string;
  /** 申请年份；未知传 null。 */
  filingYear: number | null;
  techDomains: string[];
  ipcCodes: string[];
  claimCount: number;
  inventorCount: number;
  inventorNames: string[];
  familySize: number;
  citedByCount: number;
  /** 申请人是否只有一个主体，用于联合申请判断。 */
  singleApplicant: boolean;
};

export type EnterpriseFact = {
  id: string;
  name: string;
  industry: string | null;
  track: string | null;
  techKeywords: string[];
  qualifications: string[];
};

export type SignalFact = {
  signalType: string;
  verificationStatus: string;
  independentSources: number;
};

export type BuildFeaturesInput = {
  enterprise: EnterpriseFact;
  patents: PatentFact[];
  signals: SignalFact[];
  /** 数据截止年份，"近 3 年"以此为右端点。 */
  cutoffYear: number;
  /** 已接入连接器能覆盖的信号类型；不在其中的类型一律视为未采集。 */
  coveredSignalTypes: string[];
  keyTechTracks: string[];
  strategicIndustries: string[];
  /**
   * 各证据桶的独立来源数与核验状态，由调用方从 source/evidence 表算好后传入。
   * 引擎自己不再去猜"这条数据有几个来源"——那正是上次把 560 写成常量的那类错误。
   */
  evidenceBuckets?: Record<string, { independentSources: number; verificationStatus: string }>;
};

const VALID_STATUSES = new Set(['granted']);
const DEAD_STATUSES = new Set(['expired', 'abandoned', 'lapsed', 'rejected']);

function ratio(num: number, den: number): number | null {
  return den > 0 ? num / den : null;
}

function yearsInRange(years: (number | null)[], from: number, to: number): number {
  return years.filter((y) => y !== null && y >= from && y <= to).length;
}

/** 把 [from,to] 区间内出现过的发明人取出来，用于新增/持平/收缩判断。 */
function inventorsIn(patents: PatentFact[], from: number, to: number): Set<string> {
  const set = new Set<string>();
  for (const p of patents) {
    if (p.filingYear !== null && p.filingYear >= from && p.filingYear <= to) {
      for (const n of p.inventorNames) set.add(n);
    }
  }
  return set;
}

export function buildFeatureSet(input: BuildFeaturesInput): FeatureSet {
  const { enterprise, patents, signals, cutoffYear, coveredSignalTypes } = input;
  const total = patents.length;
  const filingYears = patents.map((p) => p.filingYear);

  const inventions = patents.filter((p) => p.patentType === 'invention').length;
  const granted = patents.filter((p) => VALID_STATUSES.has(p.legalStatus)).length;
  const valid = patents.filter((p) => VALID_STATUSES.has(p.legalStatus)).length;
  const dead = patents.filter((p) => DEAD_STATUSES.has(p.legalStatus)).length;
  const claims = patents.reduce((n, p) => n + (p.claimCount || 0), 0);
  const citedBy = patents.reduce((n, p) => n + (p.citedByCount || 0), 0);
  const familyGe2 = patents.filter((p) => p.familySize >= 2).length;
  const multiApplicant = patents.filter((p) => !p.singleApplicant).length;

  const keywordSet = new Set(enterprise.techKeywords);
  const relevant = patents.filter((p) => p.techDomains.some((d) => keywordSet.has(d) || d.includes('相关'))).length;

  const distinctDomains = new Set(patents.flatMap((p) => p.techDomains)).size;
  // IPC 小类 = 前四位（如 H01L），布局宽度按小类数而不是整串分类号算。
  const distinctSubclasses = new Set(
    patents.flatMap((p) => p.ipcCodes.map((c) => c.slice(0, 4))).filter((c) => c.length >= 4),
  ).size;

  const allInventors = new Set(patents.flatMap((p) => p.inventorNames));
  const perPerson = new Map<string, number>();
  for (const p of patents) {
    for (const n of new Set(p.inventorNames)) perPerson.set(n, (perPerson.get(n) ?? 0) + 1);
  }
  const topInventorPatents = perPerson.size > 0 ? Math.max(...perPerson.values()) : 0;

  const recentFrom = cutoffYear - 2;
  const priorFrom = cutoffYear - 5;
  const recentFilings = yearsInRange(filingYears, recentFrom, cutoffYear);
  const priorFilings = yearsInRange(filingYears, priorFrom, recentFrom - 1);
  const knownYears = filingYears.filter((y): y is number => y !== null);
  const span = knownYears.length > 0 ? Math.max(...knownYears) - Math.min(...knownYears) + 1 : 0;

  const recentInv = inventorsIn(patents, recentFrom, cutoffYear);
  const priorInv = inventorsIn(patents, priorFrom, recentFrom - 1);
  const newcomers = [...recentInv].filter((n) => !priorInv.has(n)).length;

  const signalCount = (type: string): number | null =>
    coveredSignalTypes.includes(type) ? signals.filter((s) => s.signalType === type).length : null;

  const metrics: Record<string, number | null | undefined> = {
    // T
    invention_share: ratio(inventions, total),
    distinct_tech_domains: total > 0 ? distinctDomains : null,
    key_track_hit: enterprise.track ? (input.keyTechTracks.includes(enterprise.track) ? 1 : 0) : null,
    recent_filing_ratio: total > 0 ? ratio(recentFilings, total) : null,
    granted_share: total > 0 ? ratio(granted, total) : null,
    strategic_industry_hit: enterprise.industry ? (input.strategicIndustries.includes(enterprise.industry) ? 1 : 0) : null,
    qualification_count: enterprise.qualifications.length,
    // P
    avg_claim_count: ratio(claims, total),
    valid_share: total > 0 ? (total - dead) / total : null,
    invalid_share: ratio(dead, total),
    distinct_ipc_count: total > 0 ? distinctSubclasses : null,
    total_patents: total,
    domain_relevance_ratio: keywordSet.size > 0 ? ratio(relevant, total) : null,
    inventors_per_patent: ratio(
      patents.reduce((n, p) => n + (p.inventorCount || p.inventorNames.length), 0),
      total,
    ),
    avg_cited_by: ratio(citedBy, total),
    family_ge2_ratio: ratio(familyGe2, total),
    // R
    top_inventor_patents: perPerson.size > 0 ? topInventorPatents : null,
    distinct_inventors: allInventors.size > 0 ? allInventors.size : null,
    filing_year_span: span > 0 ? span : null,
    recent_inventor_ratio: recentInv.size > 0 ? ratio(newcomers, recentInv.size) : null,
    inventor_growth_ratio: priorInv.size > 0 ? recentInv.size / priorInv.size : null,
    // 岗位结构 / 人事变动没有合法数据源，显式 null 而不是 0。
    team_function_mix: null,
    key_person_change_count: null,
    // C
    product_signal_count: signalCount('product'),
    customer_signal_count: signalCount('customer'),
    order_signal_count: signalCount('order'),
    tender_signal_count: signalCount('tender'),
    delivery_signal_count: null,
    ecosystem_signal_count: signalCount('ecosystem'),
    revenue_signal_count: null,
    // E
    research_signal_count: signalCount('research'),
    investment_signal_count: signalCount('investment'),
    industry_chain_signal_count: signalCount('industry_chain'),
    park_signal_count: null,
    recent_filing_growth_ratio: priorFilings > 0 ? recentFilings / priorFilings : null,
    collab_patent_ratio: multiApplicant > 0 ? ratio(multiApplicant, total) : null,
  };

  const verification: FeatureSet['verification'] = { ...(input.evidenceBuckets ?? {}) };
  for (const s of signals) {
    const bucket = s.signalType;
    const prev = verification[bucket];
    verification[bucket] = {
      independentSources: Math.max(prev?.independentSources ?? 0, s.independentSources),
      verificationStatus: s.verificationStatus,
    };
  }

  return {
    enterpriseId: enterprise.id,
    enterpriseName: enterprise.name,
    metrics,
    verification,
  };
}
