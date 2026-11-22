import { describe, expect, it } from 'vitest';
import { assessPatent, detectAnomalies, normalizeTitle, type PatentQcContext, type PatentQcFact } from './assess';
import { QUALITY_DIMENSIONS } from './rules';

const ctx: PatentQcContext = {
  cutoffYear: 2024,
  enterpriseName: '测试企业股份有限公司',
  techKeywords: ['球囊导管', '介入器械'],
  industry: '医疗器械',
  track: '高值医用耗材',
};

/** 展开合并而不是 ??：用例要能显式传 null，表示"该字段没采到"。 */
const DEFAULTS: PatentQcFact = {
  patentId: 'p1',
  publicationNumber: 'CN100000001A',
  title: '一种球囊导管的制备方法及装置',
  patentType: 'invention',
  legalStatus: 'granted',
  filingYear: 2019,
  filingQuarter: '2019Q1',
  grantYear: 2021,
  expiryYear: null,
  claimCount: 10,
  inventorCount: 3,
  inventorNames: ['张伟', '王芳', '李强'],
  ipcCodes: ['A61M25'],
  techDomains: ['球囊导管'],
  familySize: 2,
  citedByCount: 8,
  agency: '北京品源专利代理有限公司',
  applicantName: ctx.enterpriseName,
  isCurrentApplicant: true,
  hasAssigneeChange: false,
};

function patent(over: Partial<PatentQcFact> = {}): PatentQcFact {
  return { ...DEFAULTS, ...over };
}

describe('assessPatent', () => {
  it('六维权重合计为 1，且维度键与规则目录一致', () => {
    const r = assessPatent(patent(), ctx);
    expect(r.dimensions.map((d) => d.key)).toEqual(QUALITY_DIMENSIONS.map((d) => d.key));
    expect(QUALITY_DIMENSIONS.reduce((a, d) => a + d.weight, 0)).toBeCloseTo(1, 10);
  });

  it('缺输入的维度剔除出加权，而不是按 0 分拉低总分', () => {
    const r = assessPatent(
      patent({
        claimCount: 0,
        legalStatus: 'unknown',
        familySize: 0,
        ipcCodes: [],
        inventorCount: 0,
        filingYear: null,
        filingQuarter: null,
      }),
      ctx,
    );
    // Q1 只剩类型一档、Q4 命中主营关键词，其余四维缺输入。
    expect(r.dimensions.find((d) => d.key === 'Q1')?.score).toBe(100);
    expect(r.insufficientDimensions.sort()).toEqual(['Q2', 'Q3', 'Q5', 'Q6']);
    expect(r.totalScore).toBeCloseTo((0.25 * 100 + 0.2 * 90) / 0.45, 2);
    expect(r.totalScore).not.toBe(0);
    expect(r.reasons.join()).toContain('6 个维度');
  });

  it('主营关联：命中关键词 > 命中赛道 > 无交集，三者都不等于 0 分', () => {
    const hit = assessPatent(patent({ techDomains: ['球囊导管'] }), ctx).dimensions.find((d) => d.key === 'Q4');
    const track = assessPatent(
      patent({ patentId: 'p2', techDomains: ['高值医用耗材'], title: '一种介入泵控制系统' }),
      ctx,
    ).dimensions.find((d) => d.key === 'Q4');
    const none = assessPatent(
      patent({ patentId: 'p3', techDomains: ['工业机器人'], title: '一种机械臂关节结构' }),
      ctx,
    ).dimensions.find((d) => d.key === 'Q4');
    expect([hit?.score, track?.score, none?.score]).toEqual([90, 70, 40]);

    const blind = assessPatent(patent({ patentId: 'p4' }), { ...ctx, techKeywords: [], industry: null, track: null });
    expect(blind.dimensions.find((d) => d.key === 'Q4')?.score).toBeNull();
    expect(blind.insufficientDimensions).toContain('Q4');
  });

  it('法律状态未知不判成失效，引用按年归一避免老专利占优', () => {
    const unknown = assessPatent(patent({ legalStatus: 'unknown' }), ctx);
    expect(unknown.dimensions.find((d) => d.key === 'Q2')?.reason).toContain('不按失效处理');

    const old = assessPatent(patent({ patentId: 'p5', filingYear: 2014, citedByCount: 20 }), ctx);
    const fresh = assessPatent(patent({ patentId: 'p6', filingYear: 2023, citedByCount: 20 }), ctx);
    const oldQ6 = old.dimensions.find((d) => d.key === 'Q6')!;
    const freshQ6 = fresh.dimensions.find((d) => d.key === 'Q6')!;
    expect(oldQ6.score).toBeLessThan(freshQ6.score!);
    expect(oldQ6.inputs.citations_per_year).toBeCloseTo(20 / 11, 2);
    expect(freshQ6.inputs.citations_per_year).toBeCloseTo(20 / 2, 2);
  });

  it('同一件专利重跑结果逐字段一致', () => {
    const a = assessPatent(patent(), ctx);
    const b = assessPatent(patent(), ctx);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });
});

describe('detectAnomalies', () => {
  it('突击申请按季度命中绝对线与相对线才报', () => {
    const base = Array.from({ length: 8 }, (_, i) =>
      patent({ patentId: `b${i}`, filingQuarter: `20${15 + (i % 4)}Q${1 + (i % 4)}`, filingYear: 2015 + (i % 4) }),
    );
    const burst = Array.from({ length: 6 }, (_, i) => patent({ patentId: `s${i}`, filingQuarter: '2023Q2', filingYear: 2023 }));
    const findings = detectAnomalies([...base, ...burst], ctx).filter((f) => f.anomalyType === 'filing_surge');
    expect(findings).toHaveLength(1);
    expect(findings[0].observed).toMatchObject({ quarter: '2023Q2', count: 6 });
    expect(findings[0].threshold).toMatchObject({ minPerQuarter: 5, medianMultiple: 3 });
    expect(findings[0].patentId).toBeNull();

    // 同样 6 件但摊到六个季度，就不该报。
    const spread = Array.from({ length: 6 }, (_, i) => patent({ patentId: `d${i}`, filingQuarter: `2023Q${1 + (i % 4)}`, filingYear: 2023 }));
    expect(detectAnomalies([...base, ...spread], ctx).filter((f) => f.anomalyType === 'filing_surge')).toHaveLength(0);
  });

  it('名称去标点后一致算重复，且一条异常覆盖整组而不是逐件刷屏', () => {
    const group = [
      patent({ patentId: 'n1', title: '一种球囊导管的制备方法及装置' }),
      patent({ patentId: 'n2', title: '一种球囊导管的制备方法及装置。' }),
      patent({ patentId: 'n3', title: '一种机械臂关节结构' }),
    ];
    const findings = detectAnomalies(group, { ...ctx, techKeywords: ['球囊导管', '机械臂'] }).filter(
      (f) => f.anomalyType === 'near_duplicate',
    );
    expect(findings).toHaveLength(1);
    expect(findings[0].relatedPatentIds.sort()).toEqual(['n1', 'n2']);
    expect(normalizeTitle('一种球囊导管 的制备方法及装置。')).toBe(normalizeTitle('一种球囊导管的制备方法及装置'));
  });

  it('审中超期汇总成企业级一条，单件字段矛盾才逐件报', () => {
    const stale = Array.from({ length: 4 }, (_, i) =>
      patent({ patentId: `t${i}`, legalStatus: 'pending', grantYear: null, filingYear: 2016, filingQuarter: '2016Q1' }),
    );
    const contradictions = [
      patent({ patentId: 'c1', legalStatus: 'granted', grantYear: null }),
      patent({ patentId: 'c2', legalStatus: 'granted', filingYear: 2020, grantYear: 2018 }),
    ];
    const findings = detectAnomalies([...stale, ...contradictions], ctx).filter(
      (f) => f.anomalyType === 'legal_status_irregularity',
    );
    const aggregated = findings.filter((f) => f.patentId === null);
    const perPatent = findings.filter((f) => f.patentId !== null);
    expect(aggregated).toHaveLength(1);
    expect(aggregated[0].observed).toMatchObject({ count: 4 });
    expect(perPatent.map((f) => f.patentId).sort()).toEqual(['c1', 'c2']);
    expect(perPatent.every((f) => f.severity === 'high')).toBe(true);
  });

  it('申请人不一致时只说"需核实归属"，不替人工下造假的结论', () => {
    const findings = detectAnomalies(
      [patent({ patentId: 'a1', applicantName: '另一主体有限公司' })],
      ctx,
    ).filter((f) => f.anomalyType === 'assignee_irregularity');
    expect(findings).toHaveLength(1);
    expect(findings[0].detail).toContain('需核实');
    const all = detectAnomalies([patent({ patentId: 'a1', applicantName: '另一主体有限公司' })], ctx)
      .map((f) => f.detail)
      .join();
    expect(all).not.toContain('造假');
    expect(all).not.toContain('虚假');
  });

  it('输入顺序打乱后，异常清单逐行一致', () => {
    const list = [
      patent({ patentId: 'x1', title: '一种球囊导管的制备方法及装置' }),
      patent({ patentId: 'x2', title: '一种球囊导管的制备方法及装置' }),
      patent({ patentId: 'x3', legalStatus: 'granted', grantYear: null }),
      patent({ patentId: 'x4', techDomains: ['工业机器人'], title: '一种机械臂关节结构' }),
    ];
    const forward = JSON.stringify(detectAnomalies(list, ctx));
    const backward = JSON.stringify(detectAnomalies([...list].reverse(), ctx));
    expect(backward).toBe(forward);
  });
});
