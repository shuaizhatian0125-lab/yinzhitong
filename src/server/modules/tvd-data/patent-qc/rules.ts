/**
 * TVD-05 / TVD-06 的规则目录：单件专利质量分（Q1–Q6）与专利异常阈值。
 *
 * 这些数字全部是"口径"，不是"结论"：改任何一条都要体现在 pqc_rule_version 上，
 * 否则同一件专利上周 82 分这周 64 分就无从解释。
 *
 * 异常阈值同样写成数据而不是散在判断里 —— 复核人员要能看到"命中了哪条线"，
 * 所以每条异常都必须把 observed 与 threshold 一起落库。
 */

export const PQC_RULE_VERSION = 'pqc-v1';

/** 权重来源标记：目前只有一套口径，留字段是为了以后按行业分档时能区分。 */
export const WEIGHT_PROFILE = 'cn-tech-v1';

export type QualityDimensionKey = 'Q1' | 'Q2' | 'Q3' | 'Q4' | 'Q5' | 'Q6';

export type QualityDimensionRule = {
  key: QualityDimensionKey;
  name: string;
  /** 维度内权重，六项合计 1。 */
  weight: number;
  /** 计算口径说明，直接进 UI。 */
  basis: string;
};

export const QUALITY_DIMENSIONS: QualityDimensionRule[] = [
  {
    key: 'Q1',
    name: '技术属性',
    weight: 0.25,
    basis: '专利类型（发明/实用新型/外观）与权利要求数量共同折算：类型决定保护强度，项数决定保护范围。',
  },
  {
    key: 'Q2',
    name: '权利状态',
    weight: 0.2,
    basis: '按法律状态折算：授权 > 审中 > 失效/驳回；状态未知不折算成 0 分，而是标记该维度证据不足。',
  },
  {
    key: 'Q3',
    name: '技术布局',
    weight: 0.15,
    basis: '同族规模（跨国/跨主体布局）与 IPC 分类广度共同折算。',
  },
  {
    key: 'Q4',
    name: '主营关联度',
    weight: 0.2,
    basis: '专利技术领域、名称与企业主营关键词/赛道/行业比对；不相关按 40 分档处理，不按 0 分。',
  },
  {
    key: 'Q5',
    name: '研发协作',
    weight: 0.1,
    basis: '发明人人数折算：单人偏弱、2–6 人为常态、过多挂名需核实。',
  },
  {
    key: 'Q6',
    name: '影响与引用',
    weight: 0.1,
    basis: '被引次数按申请至数据截止年的年数归一，避免老专利天然占优。',
  },
];

/** 单件专利的质量分级；与五维总分（tvs-v1）是两套口径，不能混用。 */
export const PATENT_GRADE_BANDS: { atLeast: number; grade: string; label: string }[] = [
  { atLeast: 85, grade: 'A', label: '高质量专利' },
  { atLeast: 70, grade: 'B', label: '较高质量专利' },
  { atLeast: 55, grade: 'C', label: '中等质量专利' },
  { atLeast: 40, grade: 'D', label: '质量信号偏弱' },
  { atLeast: 0, grade: 'E', label: '当前信息支持较低' },
];

export const ANOMALY_THRESHOLDS = {
  /** 突击申请：某季度申请数同时超过绝对线与相对线。 */
  filingSurge: { minPerQuarter: 5, medianMultiple: 3 },
  /** 疑似重复申报：标准化后的名称完全一致且不止一件。 */
  nearDuplicate: { minGroupSize: 2 },
  /** 主题重复：单一技术领域占比过高。 */
  repeatedTopic: { minShare: 0.4, minCount: 8 },
  /** 审中超过 N 年仍未更新法律状态，按企业汇总成一条待核实事项。 */
  stalePending: { minYears: 4, minCount: 3 },
  /** 代理机构集中。 */
  agencyConcentration: { minShare: 0.7, minPatents: 10 },
  /** 发明人集中。 */
  inventorConcentration: { minShare: 0.5, minPatents: 10 },
} as const;

/** 法律状态 → 质量档；缺项（unknown）不在表里，走"证据不足"分支。 */
export const LEGAL_STATUS_SCORE: Record<string, number> = {
  granted: 100,
  pending: 70,
  lapsed: 35,
  abandoned: 30,
  expired: 25,
  rejected: 10,
};

export const PATENT_TYPE_SCORE: Record<string, number> = {
  invention: 100,
  utility_model: 60,
  design: 35,
};

export function patentGrade(score: number | null): { grade: string | null; label: string | null } {
  if (score === null) return { grade: null, label: null };
  for (const band of PATENT_GRADE_BANDS) {
    if (score >= band.atLeast) return { grade: band.grade, label: band.label };
  }
  return { grade: null, label: null };
}
