/**
 * 评分引擎的数据结构（纯类型，不碰数据库、不碰时间）。
 *
 * 为什么单独拆一层：PRD 15.5 要求"缺失数据不得通过权重重新归一化后掩盖信息不足"，
 * 这条约束能不能落地，取决于"缺失"在类型上是不是一个独立状态。
 * 如果指标结果只有 number，缺失就只能写成 0 —— 而 0 分在这里的含义是"有证据且确实差"。
 */

/** 与 PRD 15.5 的六态一一对应。 */
export type IndicatorStatus =
  | 'AVAILABLE'
  | 'PARTIAL'
  | 'UNAVAILABLE'
  | 'NOT_APPLICABLE'
  | 'CONFLICTED'
  | 'UNVERIFIED';

export type Dimension = 'T' | 'P' | 'R' | 'C' | 'E';

/** 参与计算的输入特征：数值一律可空，空表示"这项数据没拿到"，不是 0。 */
export type FeatureSet = {
  enterpriseId: string;
  enterpriseName: string;
  /** 下面每个键都对应 rules.ts 里 requiredMetricKeys 用到的名字。 */
  metrics: Record<string, number | null | undefined>;
  /** 指标级证据情况：来源是否独立、是否只有单源。 */
  verification: Record<string, { independentSources: number; verificationStatus: string }>;
};

export type IndicatorResult = {
  code: string;
  name: string;
  dimension: Dimension;
  weight: number;
  status: IndicatorStatus;
  /** 原始值，用于解释"为什么是这个分"；缺失时为 null。 */
  rawValue: number | null;
  /** 0-100；status 不是可评分状态时为 null。 */
  score: number | null;
  /** 实际计入归一化的权重（未核实信号按 params.unverifiedWeight 折减）。 */
  effectiveWeight: number;
  independentSources: number;
  explanation: string;
  /** 命中了哪一档，直接来自 rules.ts 的 bands，UI 原样展示。 */
  bandLabel: string | null;
};

export type DimensionResult = {
  dimension: Dimension;
  name: string;
  weight: number;
  /** 归一化后的维度分；该维度无任何可评分指标时为 null。 */
  score: number | null;
  /** 该维度内可评分指标的权重占比，0-1。 */
  coverage: number;
  status: IndicatorStatus;
  indicators: IndicatorResult[];
  explanation: string;
};

export type Scorecard = {
  ruleVersion: string;
  enterpriseId: string;
  /** 总分；覆盖率不足时为 null，并给出 withheldReason。 */
  totalScore: number | null;
  grade: string | null;
  gradeLabel: string | null;
  /** 全模型口径的数据覆盖率 = Σ(维度权重 × 维度内可评分权重占比)。 */
  dataCoverage: number;
  /** 证据置信度独立输出；PRD 15.6 明确禁止把它乘进总分。 */
  evidenceConfidence: number;
  confidenceLevel: 'high' | 'medium' | 'low';
  /** 可评分指标数 / 指标总数。 */
  scorableIndicatorRate: number;
  independentEvidenceRate: number;
  conflictRate: number;
  withheldReason: string | null;
  dimensions: DimensionResult[];
  /** 逐步计算过程，UI 的"为什么是这个分"直接渲染它。 */
  derivation: DerivationStep[];
  strengths: string[];
  weaknesses: string[];
  openQuestions: string[];
};

export type DerivationStep = {
  step: string;
  detail: string;
  value: string;
};
