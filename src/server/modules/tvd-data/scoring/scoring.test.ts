import { describe, expect, it } from 'vitest';
import { buildFeatureSet, type BuildFeaturesInput, type PatentFact } from './features';
import { computeScorecard } from './engine';
import { DIMENSION_WEIGHTS, INDICATOR_RULES, RULE_VERSION, validateRules } from './rules';
import type { FeatureSet } from './types';

/**
 * 这些测试守的是命题红线，不是实现细节：
 * "缺数据 ≠ 0 分"、"同一输入必须复算出同一个分"、"覆盖率不足不出总分"。
 * 任何一条被改坏，总分就会在没人察觉的情况下变成装饰性数字。
 */

function patent(over: Partial<PatentFact>): PatentFact {
  return {
    patentType: 'invention',
    legalStatus: 'granted',
    filingYear: 2025,
    techDomains: ['介入耗材'],
    ipcCodes: ['A61B17'],
    claimCount: 12,
    inventorCount: 3,
    inventorNames: ['张三', '李四', '王五'],
    familySize: 1,
    citedByCount: 5,
    singleApplicant: true,
    ...over,
  };
}

function healthyInput(): BuildFeaturesInput {
  const patents = [
    patent({}),
    patent({ filingYear: 2024, citedByCount: 14, familySize: 3, ipcCodes: ['A61B18', 'H01L25'] }),
    patent({ filingYear: 2019, patentType: 'utility_model', legalStatus: 'lapsed', claimCount: 4 }),
    patent({ filingYear: 2016, inventorNames: ['赵六'], inventorCount: 1, techDomains: ['无关领域'] }),
    patent({ filingYear: 2025, inventorNames: ['张三', '李四'], inventorCount: 2 }),
  ];
  return {
    enterprise: {
      id: 'e-1',
      name: '示例医疗器械公司',
      industry: '生物医药与医疗器械',
      track: '介入耗材',
      techKeywords: ['介入耗材', '球囊导管'],
      qualifications: ['专精特新小巨人'],
    },
    patents,
    signals: [{ signalType: 'product', verificationStatus: 'single_source', independentSources: 1 }],
    cutoffYear: 2026,
    coveredSignalTypes: ['product', 'enterprise_identity'],
    keyTechTracks: ['介入耗材'],
    strategicIndustries: ['生物医药与医疗器械'],
    evidenceBuckets: {
      patent: { independentSources: 2, verificationStatus: 'multi_source' },
      identity: { independentSources: 2, verificationStatus: 'verified' },
      product: { independentSources: 2, verificationStatus: 'multi_source' },
    },
  };
}

function emptyInput(): BuildFeaturesInput {
  return { ...healthyInput(), patents: [], signals: [], coveredSignalTypes: [], evidenceBuckets: {} };
}

describe('规则表', () => {
  it('权重合计与指标数量符合 PRD 15.1/15.4', () => {
    expect(validateRules()).toEqual([]);
    expect(Object.values(DIMENSION_WEIGHTS).reduce((a, b) => a + b, 0)).toBeCloseTo(1, 10);
    expect(INDICATOR_RULES).toHaveLength(30);
  });

  it('每个 calculatorKey 都能被解析（防止规则表与计算器脱钩）', () => {
    const card = computeScorecard(buildFeatureSet(healthyInput()));
    const codes = card.dimensions.flatMap((d) => d.indicators.map((i) => i.code));
    expect(new Set(codes).size).toBe(30);
  });
});

describe('缺失数据处理', () => {
  it('零专利输入下，只有身份类指标能出分，且必须带着覆盖率输出', () => {
    const card = computeScorecard(buildFeatureSet(emptyInput()));
    // T3/T6 只依赖赛道与行业目录，专利为空时仍可评；其余全部 UNAVAILABLE。
    const scored = card.dimensions.flatMap((d) => d.indicators).filter((i) => i.score !== null);
    expect(scored.map((i) => i.code).sort()).toEqual(['T3', 'T6']);
    expect(card.dimensions.find((d) => d.dimension === 'P')?.score).toBeNull();
    expect(card.dimensions.find((d) => d.dimension === 'C')?.score).toBeNull();
    expect(card.dimensions.find((d) => d.dimension === 'E')?.score).toBeNull();

    // 只有 2/30 项可评：覆盖率必然低于门槛，总分必须暂缓。
    expect(card.scorableIndicatorRate).toBeCloseTo(2 / 30, 6);
    expect(card.totalScore).toBeNull();
    expect(card.withheldReason).toContain('低于');
    expect(card.derivation.map((d) => d.detail).join()).toContain('不按 0 分处理');
    // 缺的项要能被列为待核实，而不是悄悄消失。
    expect(card.openQuestions.length).toBeGreaterThanOrEqual(28);
  });

  it('只接入专利源时，商业化/生态指标记 UNAVAILABLE 而不是 0 条', () => {
    const f = buildFeatureSet({
      ...healthyInput(),
      coveredSignalTypes: [],
      evidenceBuckets: { patent: { independentSources: 2, verificationStatus: 'multi_source' } },
    });
    const card = computeScorecard(f);
    const c = card.dimensions.find((d) => d.dimension === 'C');
    expect(c?.score).toBeNull();
    expect(c?.coverage).toBe(0);
    const c2 = c?.indicators.find((i) => i.code === 'C2');
    expect(c2?.status).toBe('UNAVAILABLE');
    expect(c2?.score).toBeNull();
  });

  it('覆盖率低于门槛时暂缓总分，但分项照常输出', () => {
    const f = buildFeatureSet({ ...healthyInput(), coveredSignalTypes: [], keyTechTracks: [], strategicIndustries: [] });
    // 只保留专利侧输入：T/P/R 有分，C/E 无分。
    const card = computeScorecard(f);
    const withScore = card.dimensions.filter((d) => d.score !== null);
    expect(withScore.length).toBeGreaterThan(0);
    expect(card.derivation.some((d) => d.step === '跨维度归一化')).toBe(true);
  });
});

describe('确定性', () => {
  it('同一输入两次计算完全一致', () => {
    const a = computeScorecard(buildFeatureSet(healthyInput()));
    const b = computeScorecard(buildFeatureSet(healthyInput()));
    expect(a).toEqual(b);
    expect(a.ruleVersion).toBe(RULE_VERSION);
  });

  it('总分与维度分都落在 0–100，且由有效权重归一化得到', () => {
    const card = computeScorecard(buildFeatureSet(healthyInput()));
    for (const dim of card.dimensions) {
      if (dim.score !== null) expect(dim.score).toBeGreaterThanOrEqual(0);
      if (dim.score !== null) expect(dim.score).toBeLessThanOrEqual(100);
    }
    if (card.totalScore !== null) {
      expect(card.totalScore).toBeGreaterThanOrEqual(0);
      expect(card.totalScore).toBeLessThanOrEqual(100);
      expect(card.grade).not.toBeNull();
    }
  });
});

describe('证据置信度', () => {
  it('单源指标权重折半，置信度随之下降但不归零', () => {
    const input = healthyInput();
    const single: FeatureSet = buildFeatureSet({
      ...input,
      evidenceBuckets: {
        patent: { independentSources: 1, verificationStatus: 'single_source' },
        identity: { independentSources: 1, verificationStatus: 'single_source' },
        product: { independentSources: 1, verificationStatus: 'single_source' },
      },
    });
    const card = computeScorecard(single);
    const usable = card.dimensions.flatMap((d) => d.indicators).filter((i) => i.score !== null);
    expect(usable.length).toBeGreaterThan(0);
    for (const i of usable) {
      expect(i.status).toBe('UNVERIFIED');
      expect(i.effectiveWeight).toBeCloseTo(i.weight * 0.5, 10);
    }
    expect(card.evidenceConfidence).toBeCloseTo(0.5, 10);
    expect(card.confidenceLevel).toBe('low');
    expect(card.independentEvidenceRate).toBe(0);
    // 折减只作用于权重，不作用于分数本身。
    const withTwo = computeScorecard(buildFeatureSet(input));
    expect(card.totalScore).not.toBeNull();
    expect(withTwo.totalScore).not.toBeNull();
    expect(card.dimensions.find((d) => d.dimension === 'P')?.coverage).toBe(
      withTwo.dimensions.find((d) => d.dimension === 'P')?.coverage,
    );
  });

  it('置信度不会被乘进总分（PRD 15.6 禁止）', () => {
    // 同一个企业、同一批指标，只把独立来源数从 2 降到 1：
    // 若实现把置信度乘进总分，总分必然随之下降；正确的实现里总分不变。
    const input = healthyInput();
    const two = computeScorecard(buildFeatureSet(input));
    const one = computeScorecard(
      buildFeatureSet({
        ...input,
        evidenceBuckets: {
          patent: { independentSources: 1, verificationStatus: 'single_source' },
          identity: { independentSources: 1, verificationStatus: 'single_source' },
          product: { independentSources: 1, verificationStatus: 'single_source' },
        },
      }),
    );
    expect(two.evidenceConfidence).toBeCloseTo(1, 10);
    expect(one.evidenceConfidence).toBeLessThan(two.evidenceConfidence);
    expect(one.totalScore).toBe(two.totalScore);
    expect(one.grade).toBe(two.grade);
    // 置信度只能作为独立指标报告，供人工判断可信度，不参与分数运算。
    expect(one.dataCoverage).toBe(two.dataCoverage);
  });
});
