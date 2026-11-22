/**
 * 指标计算器：每个 calculatorKey 一个纯函数，输入特征、输出"原始值 + 档位 + 分数 + 状态"。
 *
 * 这里没有任何自然语言判断，也没有模型调用 —— PRD 15.4 的原话是
 * "不得直接让大模型凭主观感觉生成分数"。要改口径只能改分档表或改这个文件，
 * 两者都会体现在 rule_version 上。
 */

import { MIN_INDEPENDENT_SOURCES, UNVERIFIED_WEIGHT_FACTOR, type IndicatorRule } from './rules';
import type { FeatureSet, IndicatorStatus } from './types';

export type CalcResult = {
  rawValue: number | null;
  score: number | null;
  status: IndicatorStatus;
  bandLabel: string | null;
  explanation: string;
};

export type CalcContext = {
  /** 该指标背后的证据情况（独立来源数、核验状态）。 */
  independentSources: number;
  verificationStatus: string;
};

/** C/E 的信号类指标各自的证据桶；其余专利派生指标统一走 patent 桶。 */
const METRIC_TO_BUCKET: Record<string, string> = {
  product_signal_count: 'product',
  customer_signal_count: 'customer',
  order_signal_count: 'order',
  tender_signal_count: 'tender',
  ecosystem_signal_count: 'ecosystem',
  research_signal_count: 'research',
  investment_signal_count: 'investment',
  industry_chain_signal_count: 'industry_chain',
};

export function evidenceBucket(rule: IndicatorRule): string {
  for (const m of rule.requiredMetrics) {
    if (METRIC_TO_BUCKET[m]) return METRIC_TO_BUCKET[m];
  }
  if (rule.dimension === 'T' && (rule.code === 'T3' || rule.code === 'T6')) return 'identity';
  return 'patent';
}

function missing(name: string, why: string): CalcResult {
  return {
    rawValue: null,
    score: null,
    status: 'UNAVAILABLE',
    bandLabel: null,
    explanation: `${name} 缺少输入数据：${why}。按"未获得"处理，不计 0 分。`,
  };
}

/** 从高分档往低分档扫，取第一个命中的档。 */
function pickBand(rule: IndicatorRule, value: number) {
  for (const band of rule.bands) {
    if (value >= band.atLeast) return band;
  }
  return rule.bands[rule.bands.length - 1] ?? null;
}

function requiredValues(rule: IndicatorRule, f: FeatureSet): number[] | null {
  const out: number[] = [];
  for (const key of rule.requiredMetrics) {
    const v = f.metrics[key];
    if (v === null || v === undefined) return null;
    out.push(v);
  }
  return out;
}

const pct = (n: number) => `${(n * 100).toFixed(1)}%`;
const fixed = (n: number, d = 2) => n.toFixed(d);

function finish(
  rule: IndicatorRule,
  f: FeatureSet,
  ctx: CalcContext,
  rawValue: number,
  score: number,
  bandLabel: string | null,
  extra?: string,
): CalcResult {
  // 命题约束：未核实/单源的信号不能成为高权重评分依据。这里折减权重，而不是删掉指标。
  const thin = ctx.independentSources < MIN_INDEPENDENT_SOURCES;
  const status: IndicatorStatus = thin ? 'UNVERIFIED' : 'AVAILABLE';
  return {
    rawValue,
    score,
    status,
    bandLabel,
    explanation:
      `${rule.name}：${formatRaw(rule, rawValue)} → ${score.toFixed(1)} 分` +
      `${bandLabel ? `（${bandLabel}）` : ''}。${extra ?? ''}` +
      (thin
        ? ` 该指标仅有 ${ctx.independentSources} 个独立来源（门槛 ${MIN_INDEPENDENT_SOURCES} 个），权重按 ${UNVERIFIED_WEIGHT_FACTOR} 折减计入总分。`
        : ''),
  };
}

function formatRaw(rule: IndicatorRule, value: number): string {
  const integerish = ['distinct_tech_domains', 'total_patents', 'top_inventor_patents', 'distinct_ipc_count'];
  if (integerish.some((k) => rule.requiredMetrics.includes(k))) return `${Math.round(value)} 项`;
  if (value > 0 && value <= 1.0001 && /share|ratio|relevance/.test(rule.requiredMetrics.join('|'))) return pct(value);
  return fixed(value);
}

type Calculator = (rule: IndicatorRule, f: FeatureSet, ctx: CalcContext) => CalcResult;

/** 单指标直接查档，方向统一为越大越好。 */
const ratioBand: Calculator = (rule, f, ctx) => {
  const vals = requiredValues(rule, f);
  if (!vals) return missing(rule.name, rule.basis);
  const v = vals[0];
  const band = pickBand(rule, v);
  return finish(rule, f, ctx, v, band?.score ?? 0, band?.label ?? null);
};

const countBand: Calculator = ratioBand;

/** T3：赛道是否命中关键核心技术目录。 */
const keyTrackBand: Calculator = (rule, f, ctx) => {
  const vals = requiredValues(rule, f);
  if (!vals) return missing(rule.name, '企业细分赛道未采集');
  const hit = vals[0] >= 1;
  const band = pickBand(rule, vals[0]);
  return finish(
    rule,
    f,
    ctx,
    vals[0],
    band?.score ?? 0,
    band?.label ?? null,
    hit ? '' : ' 目录为 V1 词表，未命中不代表技术不关键，已写入待核实。',
  );
};

/** T6：战略行业命中 + 公开资质，两项合成 0/1/2。 */
const industryFitBand: Calculator = (rule, f, ctx) => {
  const industry = f.metrics['strategic_industry_hit'];
  const quals = f.metrics['qualification_count'];
  if (industry === null || industry === undefined || quals === null || quals === undefined) {
    return missing(rule.name, '行业与资质字段均未采集');
  }
  const value = (industry >= 1 ? 1 : 0) + (quals > 0 ? 1 : 0);
  const band = pickBand(rule, value);
  return finish(rule, f, ctx, value, band?.score ?? 0, band?.label ?? null);
};

/** P1：发明占比与平均权利要求项数加权。 */
const patentQualityAttribute: Calculator = (rule, f, ctx) => {
  const share = f.metrics['invention_share'];
  const claims = f.metrics['avg_claim_count'];
  if (share === null || share === undefined || claims === null || claims === undefined) {
    return missing(rule.name, '无专利或无权利要求字段');
  }
  const w = rule.params?.inventionWeight ?? 0.7;
  const cw = rule.params?.claimWeight ?? 0.3;
  const claimFull = rule.params?.claimFullScore ?? 15;
  const raw = w * share + cw * Math.min(1, claims / claimFull);
  const score100 = raw * 100;
  const band = pickBand(rule, score100);
  return finish(
    rule,
    f,
    ctx,
    score100,
    band?.score ?? 0,
    band?.label ?? null,
    ` 发明占比 ${pct(share)}（权重 ${w}）+ 平均权利要求 ${fixed(claims, 1)} 项/件（权重 ${cw}，${claimFull} 项封顶）。`,
  );
};

/** P2：有效权利占比（失效原因未采集，故不做贬损性推断）。 */
const legalStatusBand: Calculator = (rule, f, ctx) => {
  const valid = f.metrics['valid_share'];
  if (valid === null || valid === undefined) return missing(rule.name, '无专利记录');
  const band = pickBand(rule, valid);
  const invalid = f.metrics['invalid_share'];
  return finish(
    rule,
    f,
    ctx,
    valid,
    band?.score ?? 0,
    band?.label ?? null,
    invalid !== null && invalid !== undefined ? ` 失效/驳回占比 ${pct(invalid)}，失效原因本语料未采集。` : '',
  );
};

/** P3：布局宽度按 IPC 小类数与组合规模合成，反向档在这里折算成正向量。 */
const portfolioLayoutBand: Calculator = (rule, f, ctx) => {
  const ipc = f.metrics['distinct_ipc_count'];
  const total = f.metrics['total_patents'];
  if (ipc === null || ipc === undefined || total === null || total === undefined) {
    return missing(rule.name, 'IPC 分类号或专利总量未采集');
  }
  // 4 档语义（1 最好）：小类数 ≥8 且总量 ≥100 → 1；≥4 → 2；≥2 → 3；否则 4。
  const tier = ipc >= 8 && total >= 100 ? 1 : ipc >= 4 ? 2 : ipc >= 2 ? 3 : 4;
  const band = pickBand(rule, tier);
  return finish(
    rule,
    f,
    ctx,
    tier,
    band?.score ?? 0,
    band?.label ?? null,
    ` IPC 小类 ${Math.round(ipc)} 个、组合规模 ${Math.round(total)} 件。`,
  );
};

/** P5：协作度 + 规模。 */
const portfolioConcentration: Calculator = (rule, f, ctx) => {
  const coop = f.metrics['inventors_per_patent'];
  const total = f.metrics['total_patents'];
  if (coop === null || coop === undefined || total === null || total === undefined) {
    return missing(rule.name, '发明人字段缺失');
  }
  const coopFull = rule.params?.coopFullScore ?? 3.5;
  const scaleFull = rule.params?.scaleFullScore ?? 120;
  const score100 = (Math.min(1, coop / coopFull) * 0.6 + Math.min(1, total / scaleFull) * 0.4) * 100;
  const band = pickBand(rule, score100);
  return finish(
    rule,
    f,
    ctx,
    score100,
    band?.score ?? 0,
    band?.label ?? null,
    ` 平均 ${fixed(coop, 2)} 名发明人/件（${coopFull} 封顶），总量 ${Math.round(total)} 件（${scaleFull} 封顶）。`,
  );
};

/** P6：被引与同族信号。 */
const impactSignalBand: Calculator = (rule, f, ctx) => {
  const cited = f.metrics['avg_cited_by'];
  const family = f.metrics['family_ge2_ratio'];
  if (cited === null || cited === undefined || family === null || family === undefined) {
    return missing(rule.name, '被引/同族字段未采集');
  }
  const citedFull = rule.params?.citedFull ?? 8;
  const familyFull = rule.params?.familyFull ?? 0.25;
  const strength = Math.min(1, cited / citedFull) * 0.6 + Math.min(1, family / familyFull) * 0.4;
  // 该指标的分档表按"越小越好"写死为 1..4，这里折算成同样的 4 档。
  const tier = strength >= 0.6 ? 1 : strength >= 0.35 ? 2 : strength >= 0.12 ? 3 : 4;
  const band = pickBand(rule, tier);
  return finish(
    rule,
    f,
    ctx,
    tier,
    band?.score ?? 0,
    band?.label ?? null,
    ` 平均被引 ${fixed(cited, 2)} 次（${citedFull} 封顶），同族 ≥2 占比 ${pct(family)}（${pct(familyFull)} 封顶）。`,
  );
};

/** R1：核心发明人产出件数。 */
const coreInventorBand: Calculator = (rule, f, ctx) => {
  const v = f.metrics['top_inventor_patents'];
  if (v === null || v === undefined) return missing(rule.name, '无发明人关联数据');
  const band = pickBand(rule, v);
  return finish(rule, f, ctx, v, band?.score ?? 0, band?.label ?? null, ' 口径为专利发明人代理，非履历证据。');
};

/** R3：发明人规模 × 年份跨度，两者都要满足才进高档。 */
const inventorDepthBand: Calculator = (rule, f, ctx) => {
  const people = f.metrics['distinct_inventors'];
  const span = f.metrics['filing_year_span'];
  if (people === null || people === undefined || span === null || span === undefined) {
    return missing(rule.name, '发明人或申请年份缺失');
  }
  const pFull = rule.params?.inventorFull ?? 40;
  const sFull = rule.params?.spanFull ?? 8;
  const score100 = Math.min(people / pFull, span / sFull) * 100;
  const band = pickBand(rule, score100);
  return finish(
    rule,
    f,
    ctx,
    score100,
    band?.score ?? 0,
    band?.label ?? null,
    ` ${Math.round(people)} 名发明人、跨度 ${Math.round(span)} 年，按较小者定档（避免一次性堆量被读成长期积累）。`,
  );
};

/** R6 / E5：增长比值查档。 */
const growthTrendBand: Calculator = (rule, f, ctx) => {
  const key = rule.requiredMetrics[0];
  const v = f.metrics[key];
  if (v === null || v === undefined) {
    return missing(rule.name, `${key} 无同期基期数据（早期无申请或发明人为空）`);
  }
  const band = pickBand(rule, v);
  return finish(rule, f, ctx, v, band?.score ?? 0, band?.label ?? null, ` 比值 ${fixed(v, 2)}（近期/前期）。`);
};

/** C1：信号条数查档；0 条是"采集过且确认没有"，与未接入不同。 */
const signalPresenceBand: Calculator = (rule, f, ctx) => {
  const v = f.metrics[rule.requiredMetrics[0]];
  if (v === null || v === undefined) {
    return missing(rule.name, `该信号类型不在已接入连接器覆盖范围内`);
  }
  const count = Math.round(v);
  const band = pickBand(rule, count);
  if (count === 0) {
    return finish(rule, f, ctx, count, band?.score ?? 0, band?.label ?? null, ' 已接入来源中未见该类信号。');
  }
  return finish(rule, f, ctx, count, band?.score ?? 0, band?.label ?? null, ` 命中 ${count} 条该类信号。`);
};

/**
 * 无源的指标一律走这里：明确说明缺的是哪个连接器，
 * 页面据此显示"待补充"而不是 0 分。指标没数据不代表企业没能力。
 */
const unavailable = (reason: string): Calculator => (rule, _f, _ctx) => ({
  rawValue: null,
  score: null,
  status: 'UNAVAILABLE',
  bandLabel: null,
  explanation: `${rule.name}：${reason}，本次不参与总分（也不计 0 分）。${rule.basis}`,
});

const notApplicable = (reason: string): Calculator => (rule, f, _ctx) => {
  const v = f.metrics[rule.requiredMetrics[0]];
  if (v !== null && v !== undefined && v > 0) {
    const band = pickBand(rule, v);
    return {
      rawValue: v,
      score: band?.score ?? null,
      status: band && band.score >= 70 ? 'PARTIAL' : 'UNVERIFIED',
      bandLabel: band?.label ?? null,
      explanation: `${rule.name}：观测到 ${fixed(v, 2)}，按可用部分计入。${rule.basis}`,
    };
  }
  return {
    rawValue: v ?? null,
    score: null,
    status: 'NOT_APPLICABLE',
    bandLabel: null,
    explanation: `${rule.name}：${reason}，本语料内不适用，不计 0 分。`,
  };
};

export const CALCULATORS: Record<string, Calculator> = {
  ratio_band: ratioBand,
  count_band: countBand,
  key_track_band: keyTrackBand,
  industry_fit_band: industryFitBand,
  patent_quality_attribute: patentQualityAttribute,
  legal_status_band: legalStatusBand,
  portfolio_layout_band: portfolioLayoutBand,
  portfolio_concentration: portfolioConcentration,
  impact_signal_band: impactSignalBand,
  core_inventor_band: coreInventorBand,
  inventor_depth_band: inventorDepthBand,
  growth_trend_band: growthTrendBand,
  signal_presence_band: signalPresenceBand,
  requires_team_roster: unavailable('研发岗位/职能结构需企业上传或招聘源，二者均未接入'),
  requires_personnel_change: unavailable('核心人员变动需工商/公开人事源，合规限制未接入'),
  requires_customer_evidence: unavailable('客户与应用验证证据多为非公开信息，无合法公开源'),
  requires_tender_evidence: unavailable('招投标/中标公告源需开通凭证，尚未接入'),
  requires_delivery_evidence: unavailable('交付与验收记录需行内尽调材料，本语料未含'),
  requires_market_evidence: unavailable('市场拓展需生态合作与产业链源，尚未接入'),
  requires_financial_evidence: unavailable('持续收入需财报或企业授权数据，演示语料不含'),
  requires_research_evidence: unavailable('论文与科研项目源未接入'),
  requires_investment_evidence: unavailable('投融资数据源未接入'),
  requires_chain_evidence: unavailable('产业链图谱源未接入'),
  requires_park_evidence: unavailable('园区与集群名单源未接入'),
  requires_collab_evidence: notApplicable('联合申请需多主体申请人字段，本语料均为单主体'),
};

export function runIndicator(
  rule: IndicatorRule,
  f: FeatureSet,
  bucket: string,
): { result: CalcResult; ctx: CalcContext } {
  const calc = CALCULATORS[rule.calculator];
  if (!calc) throw new Error(`未知的 calculatorKey: ${rule.calculator}（指标 ${rule.code}）`);
  const v = f.verification[bucket];
  const ctx: CalcContext = {
    independentSources: v?.independentSources ?? 0,
    verificationStatus: v?.verificationStatus ?? 'unverified',
  };
  return { result: calc(rule, f, ctx), ctx };
}
