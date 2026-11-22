/**
 * 五维评分引擎（纯函数）。
 *
 * 两个最容易出错的地方，这里都按 PRD 15.5 的写法显式实现：
 *
 * 1) 维度内归一化：Score_d = Σ(W_i·S_i) / Σ(W_i)，i 只取"可评分"的指标。
 *    没数据的指标不进分子也不进分母 —— 它不是 0 分。
 * 2) 归一化会天然掩盖"缺了多少"，所以覆盖率、置信度、可评分率必须同时输出，
 *    并且低于 MIN_DATA_COVERAGE 时直接不出总分，而不是出一个看起来正常的分。
 *
 * 未核实/单源指标的处理：不删除，权重折半后计入（UNVERIFIED_WEIGHT_FACTOR）。
 * 于是同一份折半也给了证据置信度一个可对外的定义：
 * 置信度 = 折减后权重合计 / 可评分权重合计。
 */

import { evidenceBucket, runIndicator } from './calculators';
import {
  DIMENSION_NAMES,
  DIMENSION_WEIGHTS,
  GRADE_BANDS,
  INDICATOR_RULES,
  MIN_DATA_COVERAGE,
  MIN_INDEPENDENT_SOURCES,
  RULE_VERSION,
  UNVERIFIED_WEIGHT_FACTOR,
  indicatorsOf,
  validateRules,
} from './rules';
import type { DerivationStep, Dimension, FeatureSet, IndicatorResult, IndicatorStatus, Scorecard } from './types';

const DIMENSIONS: Dimension[] = ['T', 'P', 'R', 'C', 'E'];

function scorable(status: string): boolean {
  return status === 'AVAILABLE' || status === 'PARTIAL' || status === 'UNVERIFIED';
}

function fmt(n: number | null, d = 1): string {
  return n === null ? '—' : n.toFixed(d);
}

export function computeScorecard(features: FeatureSet, extra?: { conflictCount?: number; factCount?: number }): Scorecard {
  const problems = validateRules();
  if (problems.length > 0) throw new Error(`规则表校验未通过：\n - ${problems.join('\n - ')}`);

  const derivation: DerivationStep[] = [];
  const dimensions = DIMENSIONS.map((dim) => {
    const rules = indicatorsOf(dim);
    const indicators: IndicatorResult[] = rules.map((rule) => {
      const bucket = evidenceBucket(rule);
      const { result, ctx } = runIndicator(rule, features, bucket);
      const usable = scorable(result.status);
      const factor = result.status === 'UNVERIFIED' ? UNVERIFIED_WEIGHT_FACTOR : 1;
      return {
        code: rule.code,
        name: rule.name,
        dimension: dim,
        weight: rule.weight,
        status: result.status,
        rawValue: result.rawValue,
        score: usable ? result.score : null,
        effectiveWeight: usable ? rule.weight * factor : 0,
        independentSources: ctx.independentSources,
        explanation: result.explanation,
        bandLabel: result.bandLabel,
      };
    });

    const weightUsable = indicators.filter((i) => scorable(i.status) && i.score !== null);
    const numerator = weightUsable.reduce((n, i) => n + i.effectiveWeight * (i.score as number), 0);
    const denominator = weightUsable.reduce((n, i) => n + i.effectiveWeight, 0);
    const score = denominator > 0 ? numerator / denominator : null;
    // 覆盖率只看"有没有数据"，不掺折减：否则单源会把覆盖率也一起压低，两个概念就分不开了。
    const coverage = weightUsable.reduce((n, i) => n + i.weight, 0);

    const status: IndicatorStatus =
      coverage === 0 ? 'UNAVAILABLE' : weightUsable.length === indicators.length ? 'AVAILABLE' : 'PARTIAL';
    derivation.push({
      step: `${dim} · ${DIMENSION_NAMES[dim]}`,
      detail:
        score === null
          ? `${indicators.length} 项子指标全部无可用数据，该维度不出分（记为证据不足，不按 0 分处理）。`
          : `可评分子指标 ${weightUsable.length}/${indicators.length} 项，权重合计 ${denominator.toFixed(4)}；` +
            `Σ(有效权重×分)/Σ(有效权重) = ${numerator.toFixed(4)}/${denominator.toFixed(4)} = ${score.toFixed(2)}；` +
            `数据覆盖率 ${(coverage * 100).toFixed(0)}%。`,
      value: fmt(score),
    });

    return {
      dimension: dim,
      name: DIMENSION_NAMES[dim],
      weight: DIMENSION_WEIGHTS[dim],
      score,
      coverage,
      status,
      indicators,
      explanation:
        score === null
          ? `${DIMENSION_NAMES[dim]}：本语料内无可用输入，显示"证据不足"而不是低分。`
          : `${DIMENSION_NAMES[dim]} ${score.toFixed(1)} 分，由 ${weightUsable.map((i) => i.code).join('、')} 归一化得到。`,
    };
  });

  const withData = dimensions.filter((d) => d.score !== null);
  const dataCoverage = dimensions.reduce((n, d) => n + d.weight * d.coverage, 0);
  const crossDenominator = withData.reduce((n, d) => n + d.weight, 0);
  const crossNumerator = withData.reduce((n, d) => n + d.weight * (d.score as number), 0);
  const rawTotal = crossDenominator > 0 ? crossNumerator / crossDenominator : null;

  const allIndicators = dimensions.flatMap((d) => d.indicators);
  const usableIndicators = allIndicators.filter((i) => scorable(i.status) && i.score !== null);
  const weightBefore = usableIndicators.reduce((n, i) => n + i.weight, 0);
  const weightAfter = usableIndicators.reduce((n, i) => n + i.effectiveWeight, 0);
  const evidenceConfidence = weightBefore > 0 ? weightAfter / weightBefore : 0;
  const independentEvidenceRate =
    usableIndicators.length > 0
      ? usableIndicators.filter((i) => i.independentSources >= MIN_INDEPENDENT_SOURCES).length / usableIndicators.length
      : 0;
  const scorableIndicatorRate = allIndicators.length > 0 ? usableIndicators.length / allIndicators.length : 0;
  const conflictRate = extra?.factCount ? (extra.conflictCount ?? 0) / (extra.factCount as number) : 0;
  const scoreStability = 1 - 0.5 * (1 - dataCoverage) - 0.5 * (1 - evidenceConfidence);

  derivation.push({
    step: '跨维度归一化',
    detail:
      `出分的维度 ${withData.length}/5（权重合计 ${crossDenominator.toFixed(2)}）；` +
      `总分 = Σ(维度权重×维度分)/Σ(出分维度权重) = ${crossNumerator.toFixed(4)}/${crossDenominator.toFixed(4)} = ${fmt(rawTotal, 2)}。` +
      `缺数据的维度不参与加权，因此总分不会因为"某维度没采到"被系统性拉低。`,
    value: fmt(rawTotal, 2),
  });
  derivation.push({
    step: '数据覆盖率与证据置信度',
    detail:
      `数据覆盖率 = Σ(维度权重 × 维度内可评分权重占比) = ${(dataCoverage * 100).toFixed(1)}%（门槛 ${(MIN_DATA_COVERAGE * 100).toFixed(0)}%）；` +
      `指标可评分率 ${(scorableIndicatorRate * 100).toFixed(1)}%；` +
      `证据置信度 = 折减后权重/可评分权重 = ${(evidenceConfidence * 100).toFixed(1)}%；` +
      `独立证据覆盖率 ${(independentEvidenceRate * 100).toFixed(1)}%；信息冲突比例 ${(conflictRate * 100).toFixed(1)}%。` +
      `按 PRD 15.6，置信度独立展示，不与总分相乘。`,
    value: `${(dataCoverage * 100).toFixed(1)}% / ${(evidenceConfidence * 100).toFixed(1)}%`,
  });

  const withhold = dataCoverage < MIN_DATA_COVERAGE;
  const totalScore = withhold ? null : rawTotal;
  const gradeBand = totalScore === null ? null : GRADE_BANDS.find((g) => totalScore >= g.atLeast) ?? null;

  if (withhold) {
    derivation.push({
      step: '总分暂缓',
      detail:
        `数据覆盖率 ${(dataCoverage * 100).toFixed(1)}% 低于门槛 ${(MIN_DATA_COVERAGE * 100).toFixed(0)}%，` +
        `只输出五维分项与证据，不给综合分：此时给分等于把"没采到"说成"评过了"。`,
      value: '证据不足',
    });
  } else {
    derivation.push({
      step: '分级',
      detail: `综合分 ${fmt(totalScore, 2)} 落在 ${gradeBand?.grade ?? '—'} 档（区间见 GRADE_BANDS）。`,
      value: gradeBand?.grade ?? '—',
    });
  }

  const strengths = dimensions
    .filter((d) => d.score !== null && d.score >= 75)
    .map((d) => `${d.name} ${d.score?.toFixed(1)} 分（覆盖率 ${(d.coverage * 100).toFixed(0)}%）`);

  // 只有"有证据且确实低"才算短板；无数据的维度进 openQuestions，不进 weaknesses。
  const weaknesses = dimensions
    .filter((d) => d.score !== null && d.score < 60)
    .map((d) => `${d.name} ${d.score?.toFixed(1)} 分：${d.indicators.filter((i) => i.score !== null && i.score < 60).map((i) => i.code).join('、')} 档偏低`);

  const openQuestions = [
    ...dimensions
      .filter((d) => d.score === null)
      .map((d) => `${d.name}（${d.dimension}）整体无可用输入，需接入对应数据源后重跑。`),
    ...allIndicators
      .filter((i) => i.status === 'UNAVAILABLE' || i.status === 'NOT_APPLICABLE')
      .map((i) => `${i.code} ${i.name}：${i.explanation}`),
    ...allIndicators
      .filter((i) => i.status === 'UNVERIFIED')
      .map((i) => `${i.code} ${i.name}：仅 ${i.independentSources} 个独立来源，需第二来源印证（权重已按 ${UNVERIFIED_WEIGHT_FACTOR} 折减）。`),
  ];

  const confidenceLevel = evidenceConfidence >= 0.9 ? 'high' : evidenceConfidence >= 0.7 ? 'medium' : 'low';

  return {
    ruleVersion: RULE_VERSION,
    enterpriseId: features.enterpriseId,
    totalScore,
    grade: gradeBand?.grade ?? null,
    gradeLabel: gradeBand?.label ?? null,
    dataCoverage,
    evidenceConfidence,
    confidenceLevel,
    scorableIndicatorRate,
    independentEvidenceRate,
    conflictRate,
    withheldReason: withhold
      ? `数据覆盖率 ${(dataCoverage * 100).toFixed(1)}% 低于 ${(MIN_DATA_COVERAGE * 100).toFixed(0)}% 门槛，本次不出综合分。`
      : null,
    dimensions,
    derivation,
    strengths,
    weaknesses,
    openQuestions,
  };
}

export const ALL_INDICATOR_COUNT = INDICATOR_RULES.length;
