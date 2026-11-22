/**
 * TVD-05 / TVD-06 的计算侧：纯函数，不碰数据库、不读系统时间。
 *
 * 两条口径先说清楚，因为它们最容易写错：
 * 1) 缺字段不折算成 0 分。某个维度拿不到输入就把该维度标为证据不足并从加权里剔除，
 *    整件专利的总分只在"有输入的维度"上归一 —— 和五维评分用的是同一套归一思路。
 * 2) 异常是"需要核实的问题"，不是"造假结论"。这里产出的每一条都只描述命中了什么线，
 *    定性留给人工复核队列。
 *
 * 所有输出都按固定顺序排列，重跑必须逐行一致，否则规则版本对比就没有意义。
 */

import {
  ANOMALY_THRESHOLDS,
  LEGAL_STATUS_SCORE,
  PATENT_TYPE_SCORE,
  QUALITY_DIMENSIONS,
  patentGrade,
  type QualityDimensionKey,
} from './rules';

export type PatentQcFact = {
  patentId: string;
  publicationNumber: string;
  title: string;
  patentType: string;
  legalStatus: string;
  filingYear: number | null;
  /** 申请所在季度，如 2019Q3；突击申请按季度看。 */
  filingQuarter: string | null;
  grantYear: number | null;
  expiryYear: number | null;
  claimCount: number;
  inventorCount: number;
  inventorNames: string[];
  ipcCodes: string[];
  techDomains: string[];
  familySize: number;
  citedByCount: number;
  agency: string | null;
  applicantName: string | null;
  isCurrentApplicant: boolean;
  /** assignee_history 里出现过非本企业主体。 */
  hasAssigneeChange: boolean;
};

export type PatentQcContext = {
  /** 数据截止年：所有"距今多久"的口径都锚它，不锚 new Date()。 */
  cutoffYear: number;
  enterpriseName: string;
  techKeywords: string[];
  industry: string | null;
  track: string | null;
};

export type QualityDimensionScore = {
  key: QualityDimensionKey;
  name: string;
  weight: number;
  /** null = 该维度输入不足，不参与加权，也不记 0 分。 */
  score: number | null;
  inputs: Record<string, number | string | null>;
  reason: string;
};

export type PatentQualityResult = {
  patentId: string;
  totalScore: number | null;
  grade: string | null;
  gradeLabel: string | null;
  dimensions: QualityDimensionScore[];
  insufficientDimensions: string[];
  reasons: string[];
};

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** 去掉标点与空白，用于"名称是否实质一致"的比对。 */
export function normalizeTitle(title: string): string {
  return title
    .toLowerCase()
    .replace(/[\s　，,。.、；;：:（）()【】\[\]"'“”‘’\-—_/\\]+/g, '')
    .trim();
}

function band(value: number, table: [number, number][]): number {
  for (const [atLeast, score] of table) {
    if (value >= atLeast) return score;
  }
  return table[table.length - 1][1];
}

function avgOf(...values: (number | null)[]): number | null {
  const known = values.filter((v): v is number => v !== null);
  if (known.length === 0) return null;
  return round2(known.reduce((a, b) => a + b, 0) / known.length);
}

const CLAIM_BANDS: [number, number][] = [
  [15, 100],
  [10, 90],
  [6, 80],
  [3, 68],
  [1, 55],
];

const FAMILY_BANDS: [number, number][] = [
  [4, 100],
  [3, 90],
  [2, 78],
  [1, 55],
];

const IPC_BANDS: [number, number][] = [
  [4, 100],
  [3, 90],
  [2, 80],
  [1, 60],
];

const CITATION_BANDS: [number, number][] = [
  [3, 100],
  [1.5, 88],
  [0.6, 75],
  [0.2, 62],
  [0.0001, 50],
  [0, 45],
];

function relevanceHit(p: PatentQcFact, ctx: PatentQcContext): 'keyword' | 'track' | 'none' | 'unknown' {
  const keywords = ctx.techKeywords.filter(Boolean);
  const scopes = [ctx.track, ctx.industry].filter((v): v is string => Boolean(v));
  if (keywords.length === 0 && scopes.length === 0) return 'unknown';

  const haystack = [...p.techDomains, p.title].join(' ');
  if (keywords.some((k) => haystack.includes(k) || p.techDomains.some((d) => k.includes(d)))) return 'keyword';
  if (scopes.some((s) => haystack.includes(s))) return 'track';
  return 'none';
}

/** 单件专利的 Q1–Q6 质量分。 */
export function assessPatent(p: PatentQcFact, ctx: PatentQcContext): PatentQualityResult {
  const dims: Record<QualityDimensionKey, QualityDimensionScore> = {
    Q1: { key: 'Q1', name: '', weight: 0, score: null, inputs: {}, reason: '' },
    Q2: { key: 'Q2', name: '', weight: 0, score: null, inputs: {}, reason: '' },
    Q3: { key: 'Q3', name: '', weight: 0, score: null, inputs: {}, reason: '' },
    Q4: { key: 'Q4', name: '', weight: 0, score: null, inputs: {}, reason: '' },
    Q5: { key: 'Q5', name: '', weight: 0, score: null, inputs: {}, reason: '' },
    Q6: { key: 'Q6', name: '', weight: 0, score: null, inputs: {}, reason: '' },
  };

  // Q1 技术属性
  const typeScore = PATENT_TYPE_SCORE[p.patentType] ?? null;
  const claimScore = p.claimCount > 0 ? band(p.claimCount, CLAIM_BANDS) : null;
  dims.Q1 = {
    ...dims.Q1,
    score: typeScore === null ? null : claimScore === null ? typeScore : round2((typeScore + claimScore) / 2),
    inputs: { patent_type: p.patentType, claim_count: p.claimCount },
    reason:
      typeScore === null
        ? '专利类型未知，无法折算技术属性，本维度不计分。'
        : claimScore === null
          ? `专利类型折算 ${typeScore} 分；权利要求数未采集，本维度只按类型折算。`
          : `类型折算 ${typeScore} 分、权利要求 ${p.claimCount} 项折算 ${claimScore} 分，取均值。`,
  };

  // Q2 权利状态
  const statusScore = LEGAL_STATUS_SCORE[p.legalStatus] ?? null;
  dims.Q2 = {
    ...dims.Q2,
    score: statusScore,
    inputs: { legal_status: p.legalStatus, grant_year: p.grantYear },
    reason:
      statusScore === null
        ? '法律状态未知（未取得），本维度不计分，也不按失效处理。'
        : `法律状态 ${p.legalStatus} 折算 ${statusScore} 分。`,
  };

  // Q3 技术布局
  const familyScore = p.familySize >= 1 ? band(p.familySize, FAMILY_BANDS) : null;
  const ipcCount = new Set(p.ipcCodes.filter(Boolean).map((c) => c.slice(0, 4))).size;
  const ipcScore = ipcCount > 0 ? band(ipcCount, IPC_BANDS) : null;
  dims.Q3 = {
    ...dims.Q3,
    score: avgOf(familyScore, ipcScore),
    inputs: { family_size: p.familySize, ipc_count: ipcCount },
    reason:
      familyScore === null && ipcScore === null
        ? '同族与 IPC 分类均未采集，本维度不计分。'
        : `同族规模 ${p.familySize} 折算 ${familyScore ?? '—'} 分、IPC 分类 ${ipcCount} 个折算 ${ipcScore ?? '—'} 分。`,
  };

  // Q4 主营关联度
  const hit = relevanceHit(p, ctx);
  dims.Q4 = {
    ...dims.Q4,
    score: hit === 'keyword' ? 90 : hit === 'track' ? 70 : hit === 'none' ? 40 : null,
    inputs: { tech_domains: p.techDomains.join('、') || null, match: hit },
    reason:
      hit === 'unknown'
        ? '企业主营关键词与赛道未采集，无法比对关联度，本维度不计分。'
        : hit === 'keyword'
          ? '专利技术领域或名称命中企业主营关键词，折算 90 分。'
          : hit === 'track'
            ? '未命中主营关键词，但命中所在赛道/行业，折算 70 分。'
            : '与企业主营关键词、赛道、行业均无交集，折算 40 分（不相关不等于没有价值）。',
  };

  // Q5 研发协作
  const inv = p.inventorCount;
  const invScore = inv <= 0 ? null : inv === 1 ? 55 : inv <= 3 ? 75 : inv <= 6 ? 90 : 80;
  dims.Q5 = {
    ...dims.Q5,
    score: invScore,
    inputs: { inventor_count: inv },
    reason:
      invScore === null
        ? '发明人名单未采集，本维度不计分。'
        : inv >= 7
          ? `${inv} 位发明人，人数偏多，折算 ${invScore} 分；挂名情况需核实。`
          : `${inv} 位发明人，折算 ${invScore} 分。`,
  };

  // Q6 影响与引用
  const age = p.filingYear === null ? null : Math.max(1, ctx.cutoffYear - p.filingYear + 1);
  const citeRate = age === null ? null : round2(p.citedByCount / age);
  dims.Q6 = {
    ...dims.Q6,
    score: citeRate === null ? null : band(citeRate, CITATION_BANDS),
    inputs: { cited_by: p.citedByCount, years_since_filing: age, citations_per_year: citeRate },
    reason:
      citeRate === null
        ? '申请年份未知，无法按时间归一引用数，本维度不计分。'
        : `被引 ${p.citedByCount} 次 ÷ ${age} 年 = ${citeRate} 次/年，折算 ${band(citeRate, CITATION_BANDS)} 分。`,
  };

  let weightSum = 0;
  let acc = 0;
  const insufficient: string[] = [];
  for (const rule of QUALITY_DIMENSIONS) {
    const d = dims[rule.key];
    d.name = rule.name;
    d.weight = rule.weight;
    if (d.score === null) insufficient.push(rule.key);
    else {
      weightSum += rule.weight;
      acc += rule.weight * d.score;
    }
  }

  const totalScore = weightSum > 0 ? round2(acc / weightSum) : null;
  const { grade, label } = patentGrade(totalScore);
  const reasons: string[] = [];
  if (totalScore === null) reasons.push('六个质量维度全部缺少输入，本件专利不出质量分。');
  else if (insufficient.length > 0)
    reasons.push(`总分只在 ${QUALITY_DIMENSIONS.length - insufficient.length}/6 个维度上归一：${insufficient.join('、')} 缺少输入。`);
  if (grade) reasons.push(`质量分级 ${grade}：${label}。`);

  return {
    patentId: p.patentId,
    totalScore,
    grade,
    gradeLabel: label,
    dimensions: QUALITY_DIMENSIONS.map((r) => dims[r.key]),
    insufficientDimensions: insufficient,
    reasons,
  };
}

export type AnomalyFinding = {
  anomalyType:
    | 'filing_surge'
    | 'near_duplicate'
    | 'repeated_topic'
    | 'assignee_irregularity'
    | 'legal_status_irregularity'
    | 'inventor_concentration'
    | 'agency_concentration'
    | 'tech_mismatch';
  /** 单件级异常才有；企业级异常为 null。 */
  patentId: string | null;
  severity: 'info' | 'warning' | 'high';
  observed: Record<string, unknown>;
  threshold: Record<string, unknown>;
  detail: string;
  relatedPatentIds: string[];
};

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

/** 企业级 + 单件级异常扫描；输出顺序固定，重跑逐行一致。 */
export function detectAnomalies(patents: PatentQcFact[], ctx: PatentQcContext): AnomalyFinding[] {
  const out: AnomalyFinding[] = [];
  const total = patents.length;

  // 1) 突击申请：按申请季度看
  const byQuarter = new Map<string, string[]>();
  for (const p of patents) {
    if (!p.filingQuarter) continue;
    byQuarter.set(p.filingQuarter, [...(byQuarter.get(p.filingQuarter) ?? []), p.patentId]);
  }
  const quarterCounts = [...byQuarter.values()].map((v) => v.length);
  const med = median(quarterCounts.filter((n) => n > 0));
  for (const [quarter, ids] of [...byQuarter.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
    const rel = med > 0 ? ids.length / med : Infinity;
    if (ids.length >= ANOMALY_THRESHOLDS.filingSurge.minPerQuarter && rel >= ANOMALY_THRESHOLDS.filingSurge.medianMultiple) {
      out.push({
        anomalyType: 'filing_surge',
        patentId: null,
        severity: 'warning',
        observed: { quarter, count: ids.length, quarter_median: med, multiple: med > 0 ? round2(rel) : null },
        threshold: { ...ANOMALY_THRESHOLDS.filingSurge },
        detail: `${quarter} 申请 ${ids.length} 件，为该企季度中位数（${med}）的 ${med > 0 ? round2(rel) : '—'} 倍。集中申报本身不构成问题，需核是该阶段确有研发产出还是为凑数批量提交。`,
        relatedPatentIds: ids.slice(0, 20),
      });
    }
  }

  // 2) 疑似重复申报：标准化名称完全一致且不止一件
  const byTitle = new Map<string, PatentQcFact[]>();
  for (const p of [...patents].sort((a, b) => a.patentId.localeCompare(b.patentId))) {
    const key = normalizeTitle(p.title);
    if (!key) continue;
    byTitle.set(key, [...(byTitle.get(key) ?? []), p]);
  }
  for (const [key, group] of [...byTitle.entries()].sort((a, b) => (a[0] < b[0] ? -1 : 1))) {
    if (group.length < ANOMALY_THRESHOLDS.nearDuplicate.minGroupSize) continue;
    out.push({
      anomalyType: 'near_duplicate',
      patentId: null,
      severity: 'warning',
      observed: { normalized_title: key, count: group.length, publication_numbers: group.map((g) => g.publicationNumber) },
      threshold: { ...ANOMALY_THRESHOLDS.nearDuplicate },
      detail: `${group.length} 件专利名称去标点后完全一致（${group[0].title}），公开号 ${group.map((g) => g.publicationNumber).join('、')}。需核是否为同一技术方案的重复申报或分案。`,
      relatedPatentIds: group.map((g) => g.patentId).slice(0, 20),
    });
  }

  // 3) 主题重复：单一技术领域占比过高
  const byDomain = new Map<string, string[]>();
  for (const p of patents) {
    for (const d of p.techDomains) {
      if (!d) continue;
      byDomain.set(d, [...(byDomain.get(d) ?? []), p.patentId]);
    }
  }
  for (const [domain, ids] of [...byDomain.entries()].sort((a, b) => (a[0] < b[0] ? -1 : 1))) {
    const share = total > 0 ? ids.length / total : 0;
    if (ids.length >= ANOMALY_THRESHOLDS.repeatedTopic.minCount && share >= ANOMALY_THRESHOLDS.repeatedTopic.minShare) {
      out.push({
        anomalyType: 'repeated_topic',
        patentId: null,
        severity: 'info',
        observed: { tech_domain: domain, count: ids.length, share: round2(share) },
        threshold: { ...ANOMALY_THRESHOLDS.repeatedTopic },
        detail: `技术领域「${domain}」占全部专利的 ${Math.round(share * 100)}%（${ids.length}/${total}）。布局集中本身可以是策略，需核是同一主题的重复申报还是持续深耕。`,
        relatedPatentIds: ids.slice(0, 20),
      });
    }
  }

  // 4) 审中超期：企业级汇总成一条，避免逐件刷屏
  const stale = patents.filter(
    (p) => p.legalStatus === 'pending' && p.filingYear !== null && ctx.cutoffYear - p.filingYear >= ANOMALY_THRESHOLDS.stalePending.minYears,
  );
  if (stale.length >= ANOMALY_THRESHOLDS.stalePending.minCount) {
    out.push({
      anomalyType: 'legal_status_irregularity',
      patentId: null,
      severity: 'warning',
      observed: {
        count: stale.length,
        oldest_filing_year: Math.min(...stale.map((s) => s.filingYear ?? 0)),
        cutoff_year: ctx.cutoffYear,
      },
      threshold: { ...ANOMALY_THRESHOLDS.stalePending },
      detail: `${stale.length} 件申请已超过 ${ANOMALY_THRESHOLDS.stalePending.minYears} 年仍显示"审中"。更可能是法律状态没有及时更新，需重新取数而不是据此判断权利状态。`,
      relatedPatentIds: stale.map((s) => s.patentId).slice(0, 20),
    });
  }

  // 5) 单件级矛盾：逐件判定
  for (const p of [...patents].sort((a, b) => a.patentId.localeCompare(b.patentId))) {
    if (p.legalStatus === 'granted' && p.grantYear === null) {
      out.push({
        anomalyType: 'legal_status_irregularity',
        patentId: p.patentId,
        severity: 'high',
        observed: { legal_status: p.legalStatus, grant_year: null, publication_number: p.publicationNumber },
        threshold: { rule: '授权状态必须有授权公告日' },
        detail: `${p.publicationNumber} 法律状态为"授权"但没有授权日期，两个字段互相矛盾，需回源核对。`,
        relatedPatentIds: [p.patentId],
      });
    }
    if (p.grantYear !== null && p.filingYear !== null && p.grantYear < p.filingYear) {
      out.push({
        anomalyType: 'legal_status_irregularity',
        patentId: p.patentId,
        severity: 'high',
        observed: { filing_year: p.filingYear, grant_year: p.grantYear, publication_number: p.publicationNumber },
        threshold: { rule: '授权日不得早于申请日' },
        detail: `${p.publicationNumber} 授权年（${p.grantYear}）早于申请年（${p.filingYear}），时间字段矛盾，需回源核对。`,
        relatedPatentIds: [p.patentId],
      });
    }
    if (p.expiryYear !== null && p.filingYear !== null && p.expiryYear < p.filingYear) {
      out.push({
        anomalyType: 'legal_status_irregularity',
        patentId: p.patentId,
        severity: 'high',
        observed: { filing_year: p.filingYear, expiry_year: p.expiryYear, publication_number: p.publicationNumber },
        threshold: { rule: '失效日不得早于申请日' },
        detail: `${p.publicationNumber} 失效年（${p.expiryYear}）早于申请年（${p.filingYear}），时间字段矛盾，需回源核对。`,
        relatedPatentIds: [p.patentId],
      });
    }
    if (p.expiryYear !== null && p.expiryYear <= ctx.cutoffYear && p.legalStatus === 'granted') {
      out.push({
        anomalyType: 'legal_status_irregularity',
        patentId: p.patentId,
        severity: 'warning',
        observed: { expiry_year: p.expiryYear, legal_status: p.legalStatus, cutoff_year: ctx.cutoffYear, publication_number: p.publicationNumber },
        threshold: { rule: '失效日已过但状态仍为授权' },
        detail: `${p.publicationNumber} 记录的失效年为 ${p.expiryYear}（数据截止 ${ctx.cutoffYear}），状态仍是"授权"，权利是否有效需核实。`,
        relatedPatentIds: [p.patentId],
      });
    }
    if (!p.isCurrentApplicant || p.hasAssigneeChange || (p.applicantName && p.applicantName !== ctx.enterpriseName)) {
      out.push({
        anomalyType: 'assignee_irregularity',
        patentId: p.patentId,
        severity: 'warning',
        observed: {
          applicant_raw: p.applicantName,
          enterprise_name: ctx.enterpriseName,
          is_current_applicant: p.isCurrentApplicant,
          has_assignee_change: p.hasAssigneeChange,
          publication_number: p.publicationNumber,
        },
        threshold: { rule: '申请人应与被评估企业一致，转让需有登记记录' },
        detail: `${p.publicationNumber} 的申请人为「${p.applicantName ?? '未采集'}」，与本企业名称不一致或存在权利变更记录，归属需核实后再计入企业专利组合。`,
        relatedPatentIds: [p.patentId],
      });
    }
    if (relevanceHit(p, ctx) === 'none') {
      out.push({
        anomalyType: 'tech_mismatch',
        patentId: p.patentId,
        severity: 'info',
        observed: { tech_domains: p.techDomains.join('、') || null, title: p.title, publication_number: p.publicationNumber },
        threshold: { rule: '专利技术领域/名称应命中企业主营关键词或赛道' },
        detail: `${p.publicationNumber} 的技术领域与名称均未命中企业主营关键词、赛道与行业，需核实是否属于本企业实际研发方向（外购、受让或同名主体都可能造成此结果）。`,
        relatedPatentIds: [p.patentId],
      });
    }
  }

  // 6) 发明人集中
  if (total >= ANOMALY_THRESHOLDS.inventorConcentration.minPatents) {
    const invCount = new Map<string, number>();
    for (const p of patents) for (const n of p.inventorNames) invCount.set(n, (invCount.get(n) ?? 0) + 1);
    for (const [name, n] of [...invCount.entries()].sort((a, b) => (a[0] < b[0] ? -1 : 1))) {
      const share = n / total;
      if (share >= ANOMALY_THRESHOLDS.inventorConcentration.minShare) {
        out.push({
          anomalyType: 'inventor_concentration',
          patentId: null,
          severity: 'info',
          observed: { inventor: name, count: n, share: round2(share), total },
          threshold: { ...ANOMALY_THRESHOLDS.inventorConcentration },
          detail: `发明人「${name}」出现在 ${Math.round(share * 100)}% 的专利名单中（${n}/${total}）。核心发明人集中是事实，需结合团队规模判断是骨干带动还是名单挂名。`,
          relatedPatentIds: patents.filter((p) => p.inventorNames.includes(name)).map((p) => p.patentId).slice(0, 20),
        });
      }
    }
  }

  // 7) 代理机构集中
  const agencies = patents.filter((p) => p.agency);
  if (agencies.length >= ANOMALY_THRESHOLDS.agencyConcentration.minPatents) {
    const byAgency = new Map<string, number>();
    for (const p of agencies) byAgency.set(p.agency as string, (byAgency.get(p.agency as string) ?? 0) + 1);
    for (const [name, n] of [...byAgency.entries()].sort((a, b) => (a[0] < b[0] ? -1 : 1))) {
      const share = n / agencies.length;
      if (share >= ANOMALY_THRESHOLDS.agencyConcentration.minShare) {
        out.push({
          anomalyType: 'agency_concentration',
          patentId: null,
          severity: 'info',
          observed: { agency: name, count: n, share: round2(share), known_agency_total: agencies.length },
          threshold: { ...ANOMALY_THRESHOLDS.agencyConcentration },
          detail: `${Math.round(share * 100)}% 的专利由「${name}」代理（${n}/${agencies.length}）。长期固定代理所很正常，此项仅作提示。`,
          relatedPatentIds: agencies.filter((p) => p.agency === name).map((p) => p.patentId).slice(0, 20),
        });
      }
    }
  }

  const order: AnomalyFinding['anomalyType'][] = [
    'filing_surge',
    'near_duplicate',
    'repeated_topic',
    'assignee_irregularity',
    'legal_status_irregularity',
    'inventor_concentration',
    'agency_concentration',
    'tech_mismatch',
  ];
  return out.sort((a, b) => {
    const t = order.indexOf(a.anomalyType) - order.indexOf(b.anomalyType);
    if (t !== 0) return t;
    return `${a.patentId ?? ''}|${JSON.stringify(a.observed)}`.localeCompare(`${b.patentId ?? ''}|${JSON.stringify(b.observed)}`);
  });
}
