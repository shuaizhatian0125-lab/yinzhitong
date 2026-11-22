'use client';

import * as React from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  ArrowLeft,
  CircleAlert,
  ExternalLink,
  Loader2,
  RefreshCw,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import type { EChartsOption } from 'echarts';
import { PageHeader } from '@/components/layout/PageHeader';
import { authFetch, loginUrl } from '@/lib/auth-client';
import { Chart } from '@/components/charts/Chart';
import {
  ACCESS_METHOD_LABEL,
  ANOMALY_SEVERITY_LABEL,
  ANOMALY_TYPE_LABEL,
  CONFIDENCE_LABEL,
  DATA_KIND_LABEL,
  INDICATOR_STATUS_LABEL,
  PATENT_LEGAL_STATUS_LABEL,
  PATENT_TYPE_LABEL,
  SIGNAL_TYPE_LABEL,
  SOURCE_TIER_LABEL,
  VERIFICATION_LABEL,
  badgeOf,
  labelOf,
} from '@/lib/tvd-labels';

/**
 * TVD 企业全景页。
 *
 * 页面只认两样东西：确定性代码算出来的数字，以及每条结论背后的证据链。
 * 缺数据一律显示"待评分/—"，绝不补 0 —— 把缺失当 0 分是把"没查到"说成"不好"。
 */

type Enterprise = {
  id: string;
  name: string;
  industry: string | null;
  track: string | null;
  region: string | null;
  stage: string | null;
  qualifications: string[];
  techKeywords: string[];
  coreTechSummary: string | null;
  identityConfidence: string;
  verificationStatus: string;
  dataKind: string;
};

type Profile = {
  overallScore: string | null;
  scoreConfidence: string | null;
  dataCoverage: string | null;
  evidenceConfidence: string | null;
  profileVersion: string;
  identityLayer: Record<string, unknown>;
  techIdentityLayer: Record<string, unknown>;
  evidenceLayer: Record<string, unknown>;
  growthLayer: Record<string, unknown>;
  riskLayer: Record<string, unknown>;
  openQuestions: string[];
  pendingVerificationCount: number;
  conflictCount: number;
};

/**
 * 五维评分卡：来自 /api/v1/tvd/assessments，即已落库的那次 run。
 * 页面不做任何再计算，也不"当场补一个分" —— 展示的分必须与库里的 rule_version 对得上。
 */
type ScoreIndicator = {
  code: string;
  name: string;
  status: string;
  weight: string;
  raw_value: string | null;
  score: string | null;
  independent_sources: number;
  verification_status: string;
  insufficient_evidence: boolean;
  explanation: string | null;
  evidence_ids: string[];
};

type ScoreDimension = {
  dimension: string;
  name: string;
  weight: number;
  score: number | null;
  coverage: number;
  status: string;
  indicators: ScoreIndicator[];
};

type Scorecard = {
  run_id: string;
  run_no: string;
  rule_version: string;
  status: string;
  data_kind: string;
  computed_at: string;
  total_score: string | null;
  grade: string | null;
  withheld_reason: string | null;
  data_coverage: string | null;
  conflict_count: number;
  pending_review_count: number;
  /** PRD 15.6 要求随分一起输出的元指标，来自画像的 evidence_layer。 */
  evidence: {
    evidence_confidence?: number;
    scorable_indicator_rate?: number;
    independent_evidence_rate?: number;
    conflict_rate?: number;
    score_stability?: number;
    grade_label?: string | null;
    withheld_reason?: string | null;
    rule_version?: string;
  };
  dimensions: ScoreDimension[];
  derivation: { step?: string; detail?: string; value?: string }[];
  strengths: string[];
  weaknesses: string[];
  open_questions: string[];
  risk_notes: string[];
  provenance: Record<string, unknown>;
  /** 时间在拉数时算好，渲染期不碰 new Date()，避免 CSR/SSR 文本不一致。 */
  computedLabel: string;
};

type QcAnomaly = {
  id: string;
  anomaly_type: string;
  severity: string;
  patent_id: string | null;
  publication_number: string | null;
  detail: string;
  observed: Record<string, unknown>;
  threshold: Record<string, unknown>;
  related_count: number;
};

/** TVD-05/06 的读视图：质量分只从专利客观字段推算，异常只描述命中了什么线。 */
type PatentQc = {
  rule_version: string;
  weight_profile: string;
  patents: number;
  scored: number;
  avg_quality_score: number | null;
  grade_counts: Record<string, number>;
  dimensions: { key: string; name: string; weight: number; avg: number | null; insufficient: number }[];
  anomalies: { total: number; by_type: Record<string, number>; items: QcAnomaly[]; truncated: boolean };
  computed_at: string | null;
  computedLabel: string;
};

type PatentStats = {
  total: number;
  inventionCount: number;
  utilityModelCount: number;
  designCount: number;
  grantedCount: number;
  pendingCount: number;
  invalidCount: number;
  validInventionRatio: string | null;
  recentFilingRatio: string | null;
  avgQualityScore: string | null;
  anomalyCount: number;
  byYear: Record<string, unknown>;
  byTechDomain: Record<string, unknown>;
  ruleVersion: string;
};

type Patent = {
  id: string;
  publicationNumber: string;
  title: string;
  patentType: string;
  legalStatus: string;
  filingDate: string | null;
  citedByCount: number;
  claimCount: number;
  techDomains: string[];
  inventorNames: string[];
  dataKind: string;
};

type Evidence = {
  evidenceId: string;
  claimText: string;
  excerpt: string | null;
  credibility: string;
  sourceRecordId: string;
  sourceTitle: string | null;
  sourceUrl: string | null;
  sourceTier: string | null;
  sourceName: string | null;
  publisher: string | null;
  publishedAt: string | null;
  retrievedAt: string | null;
  accessMethod: string | null;
  originRecordId: string | null;
};

type Signal = {
  id: string;
  signalType: string;
  subject: string;
  textValue: string | null;
  observedValue: string | null;
  valueUnit: string | null;
  occurredAt: string | null;
  confidence: string;
  verificationStatus: string;
  independentSourceCount: number;
  dataKind: string;
  evidence: Evidence[];
};

type Detail = {
  is_demo: boolean;
  backend: string;
  enterprise: Enterprise;
  profile: Profile | null;
  patentStats: PatentStats | null;
  recentPatents: Patent[];
  signals: Signal[];
};

const BRAND = 'var(--bz-brand)';

/**
 * ECharts 走 canvas 绘制，fillStyle 不解析 CSS 变量 —— 传 var(--bz-brand) 会画不出来。
 * 所以图内颜色用与主题同值的十六进制，DOM 部分继续用变量。
 */
const C_BRAND = '#cc0000';
const C_LINE = '#e8e4e2';
const C_AXIS = '#9a8f8d';
const C_LABEL = '#5c5150';

function kindBadge(kind: string) {
  const m = badgeOf(DATA_KIND_LABEL, kind);
  return <span className={`bz-badge ${m.cls}`}>{m.label}</span>;
}

function verificationBadge(status: string) {
  const m = badgeOf(VERIFICATION_LABEL, status);
  return <span className={`bz-badge ${m.cls}`}>{m.label}</span>;
}

/** 比率一律是 numeric 列的字符串或 JSONB 里的数值，直接显示 0.667 没人看得懂。 */
function ratio(v: string | number | null | undefined): string {
  if (v === null || v === undefined) return '—';
  const n = Number(v);
  if (!Number.isFinite(n)) return '—';
  return `${(n * 100).toFixed(1)}%`;
}

function dateOnly(v: string | null | undefined): string {
  if (!v) return '—';
  return v.slice(0, 10);
}

/** jsonb 聚合列（byYear / byTechDomain）转成有序数值对。 */
function numPairs(rec: Record<string, unknown> | undefined): [string, number][] {
  return Object.entries(rec ?? {})
    .map(([k, v]) => [k, typeof v === 'number' ? v : Number(v) || 0] as [string, number])
    .sort((a, b) => a[0].localeCompare(b[0], undefined, { numeric: true }));
}

function JsonValue({ value }: { value: unknown }) {
  if (value === null || value === undefined) return <span className="text-[var(--bz-text-muted)]">—</span>;
  if (typeof value === 'string') return <span>{value}</span>;
  if (typeof value === 'number' || typeof value === 'boolean') return <span className="num">{String(value)}</span>;
  if (Array.isArray(value)) {
    return (
      <span className="flex flex-wrap gap-1">
        {value.map((v, i) => (
          <span key={i} className="bz-badge bz-badge-gray">
            {typeof v === 'object' ? JSON.stringify(v) : String(v)}
          </span>
        ))}
      </span>
    );
  }
  return <span className="text-[12px] text-[var(--bz-text-muted)]">{JSON.stringify(value)}</span>;
}

function LayerTable({ title, note, data }: { title: string; note?: string; data: Record<string, unknown> }) {
  const entries = Object.entries(data);
  return (
    <div>
      <div className="flex items-baseline justify-between gap-3 mb-2">
        <h4 className="text-[14px] font-semibold text-[var(--bz-text)]">{title}</h4>
        {note && <span className="text-[12px] text-[var(--bz-text-muted)]">{note}</span>}
      </div>
      {entries.length === 0 ? (
        <p className="text-[13px] text-[var(--bz-text-muted)]">该层尚无数据 —— 未采集不等于 0 分。</p>
      ) : (
        <dl className="grid grid-cols-[110px_1fr] gap-y-2 gap-x-3 text-[13px]">
          {entries.map(([k, v]) => (
            <React.Fragment key={k}>
              <dt className="text-[var(--bz-text-sub)]">{k}</dt>
              <dd className="break-words">
                <JsonValue value={v} />
              </dd>
            </React.Fragment>
          ))}
        </dl>
      )}
    </div>
  );
}

function Tile({ label, value, hint }: { label: string; value: React.ReactNode; hint?: string }) {
  return (
    <div className="bz-card rounded-[6px] px-4 py-3">
      <div className="text-[13px] text-[var(--bz-text-muted)]">{label}</div>
      <div className="text-[22px] font-semibold num mt-1 leading-tight" style={{ color: 'var(--bz-text)' }}>
        {value}
      </div>
      {hint && <div className="text-[12px] text-[var(--bz-text-muted)] mt-1">{hint}</div>}
    </div>
  );
}

export default function TvdEnterpriseDetailPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const enterpriseId = params.id;

  const [detail, setDetail] = React.useState<Detail | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [failed, setFailed] = React.useState<string | null>(null);
  const [openSignalId, setOpenSignalId] = React.useState<string | null>(null);

  const [aiText, setAiText] = React.useState<string | null>(null);
  const [aiLoading, setAiLoading] = React.useState(false);
  const [aiError, setAiError] = React.useState<string | null>(null);

  const [score, setScore] = React.useState<Scorecard | null>(null);
  const [scoreMissing, setScoreMissing] = React.useState(false);
  const [scoreRunning, setScoreRunning] = React.useState(false);
  const [scoreError, setScoreError] = React.useState<string | null>(null);
  const [showIndicators, setShowIndicators] = React.useState(false);

  const [qc, setQc] = React.useState<PatentQc | null>(null);
  const [qcAssessed, setQcAssessed] = React.useState(false);
  const [qcRunning, setQcRunning] = React.useState(false);
  const [qcError, setQcError] = React.useState<string | null>(null);
  const [showAnomalies, setShowAnomalies] = React.useState(false);

  const fetchDetail = React.useCallback(async () => {
    setLoading(true);
    setFailed(null);
    const res = await authFetch<Detail>(`/api/v1/tvd/enterprises/${enterpriseId}`);
    if (res.unauthorized) {
      // 令牌已失效：清掉之后直接去登录页，别把"没登录"渲染成"没有这家企业"。
      setLoading(false);
      router.push(loginUrl());
      return;
    }
    if (res.ok && res.data) {
      setDetail(res.data);
      setOpenSignalId((res.data.signals[0] ?? null)?.id ?? null);
      setLoading(false);
      return;
    }
    setFailed(res.message ?? '未找到该企业，或它不属于当前租户/分行。');
    setLoading(false);
  }, [enterpriseId, router]);

  React.useEffect(() => {
    void fetchDetail();
  }, [fetchDetail]);

  /**
   * 评分卡读的是库里那次 run（带 rule_version 与 feature_snapshot），页面不现算。
   * 404 = 这家企业还没跑过评分器 → 显示"待评分"；其它失败必须照实报错，
   * 把 500 渲染成"暂无数据"是上一版统计数字骗人的同款毛病。
   */
  const fetchScore = React.useCallback(async () => {
    const res = await authFetch<{ assessment: Omit<Scorecard, 'computedLabel'> }>(
      `/api/v1/tvd/assessments?enterprise_id=${enterpriseId}`,
    );
    if (res.unauthorized) {
      router.push(loginUrl());
      return;
    }
    if (res.ok && res.data?.assessment) {
      const a = res.data.assessment;
      setScore({ ...a, computedLabel: new Date(a.computed_at).toLocaleString('zh-CN') });
      setScoreMissing(false);
      setScoreError(null);
      return;
    }
    setScore(null);
    setScoreMissing(res.status === 404);
    setScoreError(res.status === 404 ? null : (res.message ?? '评分记录读取失败'));
  }, [enterpriseId, router]);

  React.useEffect(() => {
    void fetchScore();
  }, [fetchScore]);

  /** 点一次算一次：同一份数据重跑必须得到同一个分，这也是页面上唯一能验证确定性的动作。 */
  const runScore = React.useCallback(async () => {
    setScoreRunning(true);
    setScoreError(null);
    const res = await authFetch<{ results?: { ok: boolean; message?: string }[] }>(
      '/api/v1/tvd/assessments',
      { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ enterprise_id: enterpriseId }) },
    );
    if (res.unauthorized) {
      setScoreRunning(false);
      router.push(loginUrl());
      return;
    }
    if (!res.ok) {
      setScoreError(res.message ?? '评分执行失败');
      setScoreRunning(false);
      return;
    }
    const first = res.data?.results?.[0];
    if (first && !first.ok) setScoreError(first.message ?? '评分执行失败');
    await fetchScore();
    // 画像的分数列也变了，顶部瓦片要跟着刷新，不然同一页会出现两个分数。
    await fetchDetail();
    setScoreRunning(false);
  }, [enterpriseId, fetchDetail, fetchScore, router]);

  /** 质量行与异常行同样是"读库里已落地的结果"，页面不现算。 */
  const fetchQc = React.useCallback(async () => {
    const res = await authFetch<{ assessed: boolean; quality: Omit<PatentQc, 'computedLabel'> }>(
      `/api/v1/tvd/patent-quality?enterprise_id=${enterpriseId}`,
    );
    if (res.unauthorized) {
      router.push(loginUrl());
      return;
    }
    if (res.ok && res.data?.quality) {
      const q = res.data.quality;
      setQc({ ...q, computedLabel: q.computed_at ? new Date(q.computed_at).toLocaleString('zh-CN') : '' });
      setQcAssessed(res.data.assessed);
      setQcError(null);
      return;
    }
    setQc(null);
    setQcAssessed(false);
    setQcError(res.status === 404 ? null : (res.message ?? '专利质量记录读取失败'));
  }, [enterpriseId, router]);

  React.useEffect(() => {
    void fetchQc();
  }, [fetchQc]);

  const runQc = React.useCallback(async () => {
    setQcRunning(true);
    setQcError(null);
    const res = await authFetch<{ result?: { ok?: boolean; message?: string } }>(
      '/api/v1/tvd/patent-quality',
      { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ enterprise_id: enterpriseId }) },
    );
    if (res.unauthorized) {
      setQcRunning(false);
      router.push(loginUrl());
      return;
    }
    if (!res.ok) {
      setQcError(res.message ?? '专利质量评估执行失败');
      setQcRunning(false);
      return;
    }
    await fetchQc();
    // 平均质量分与异常数会回填进聚合行，专利结构那四个格子要跟着变，否则同页两个数。
    await fetchDetail();
    setQcRunning(false);
  }, [enterpriseId, fetchDetail, fetchQc, router]);

  const trendOption = React.useMemo<EChartsOption>(() => {
    const pairs = numPairs(detail?.patentStats?.byYear);
    return {
      grid: { left: 44, right: 16, top: 20, bottom: 28 },
      tooltip: { trigger: 'axis' },
      xAxis: {
        type: 'category',
        data: pairs.map(([y]) => y),
        axisLabel: { color: C_AXIS, fontSize: 11 },
      },
      yAxis: {
        type: 'value',
        splitLine: { lineStyle: { color: C_LINE } },
        axisLabel: { color: C_AXIS, fontSize: 11 },
      },
      series: [
        {
          type: 'line',
          smooth: true,
          symbolSize: 6,
          data: pairs.map(([, n]) => n),
          lineStyle: { color: C_BRAND, width: 2 },
          itemStyle: { color: C_BRAND },
          areaStyle: { color: 'rgba(204, 0, 0, 0.08)' },
        },
      ],
    };
  }, [detail]);

  const legalOption = React.useMemo<EChartsOption>(() => {
    const s = detail?.patentStats;
    return {
      tooltip: { trigger: 'item' },
      legend: { bottom: 0, itemWidth: 10, itemHeight: 10, textStyle: { fontSize: 12 } },
      series: [
        {
          type: 'pie',
          radius: ['46%', '68%'],
          center: ['50%', '44%'],
          avoidLabelOverlap: true,
          label: { show: false },
          data: [
            { name: '授权', value: s?.grantedCount ?? 0, itemStyle: { color: '#1e7b4f' } },
            { name: '审中', value: s?.pendingCount ?? 0, itemStyle: { color: '#b08a4a' } },
            { name: '失效/放弃', value: s?.invalidCount ?? 0, itemStyle: { color: '#cc0000' } },
          ],
        },
      ],
    };
  }, [detail]);

  const domainOption = React.useMemo<EChartsOption>(() => {
    const pairs = numPairs(detail?.patentStats?.byTechDomain)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .reverse();
    return {
      grid: { left: 8, right: 40, top: 12, bottom: 12, containLabel: true },
      tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
      xAxis: { type: 'value', splitLine: { lineStyle: { color: C_LINE } } },
      yAxis: {
        type: 'category',
        data: pairs.map(([k]) => k),
        axisLabel: { fontSize: 12, color: C_LABEL },
      },
      series: [
        {
          type: 'bar',
          barMaxWidth: 14,
          data: pairs.map(([, n]) => n),
          itemStyle: { color: C_BRAND, borderRadius: [0, 3, 3, 0] },
          label: { show: true, position: 'right', fontSize: 12 },
        },
      ],
    };
  }, [detail]);

  /**
   * AI 解读的输入只有本页已经落库的事实与证据原文。
   * 提示词里禁止补事实：模型一旦自由发挥，页面上的"可溯源"就是假的。
   */
  const runAiRead = React.useCallback(async () => {
    if (!detail) return;
    setAiLoading(true);
    setAiError(null);
    const facts = [
      `企业：${detail.enterprise.name}`,
      `行业/赛道：${detail.enterprise.industry ?? '未采集'} / ${detail.enterprise.track ?? '未采集'}`,
      `地区：${detail.enterprise.region ?? '未采集'}`,
      `资质：${detail.enterprise.qualifications.join('、') || '未采集'}`,
      `专利统计（规则版本 ${detail.patentStats?.ruleVersion ?? '—'}）：总量 ${detail.patentStats?.total ?? '—'}，发明 ${detail.patentStats?.inventionCount ?? '—'}，授权 ${detail.patentStats?.grantedCount ?? '—'}，失效 ${detail.patentStats?.invalidCount ?? '—'}`,
      `信号 ${detail.signals.length} 条，证据 ${detail.signals.reduce((n, s) => n + s.evidence.length, 0)} 条`,
      '证据原文：',
      ...detail.signals.flatMap((s) =>
        s.evidence.map((e) => `- [${labelOf(SOURCE_TIER_LABEL, e.sourceTier)}] ${e.claimText}（来源：${e.sourceTitle ?? '未命名'}）`),
      ),
    ].join('\n');

    const res = await authFetch<{ text?: string }>('/api/v1/ai/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        task_type: 'tvd_enterprise_read',
        temperature: 0.2,
        max_tokens: 900,
        messages: [
          {
            role: 'system',
            content:
              '你是银行科技型企业价值发现引擎的分析助手。只能使用用户给出的证据做归纳、解释与提示风险；' +
              '不得补充任何未提供的数字、企业、专利、客户、订单、融资或来源；证据不足时必须明确说"证据不足"。' +
              '不要给出评分或投资建议，评分由确定性规则引擎产生。输出中文，3—5 条要点，每条一行。',
          },
          { role: 'user', content: `请基于以下事实与证据，概述该企业的技术看点与需要人工核实的缺口：\n\n${facts}` },
        ],
      }),
    });
    if (res.unauthorized) {
      setAiLoading(false);
      router.push(loginUrl());
      return;
    }
    if (res.ok && res.data?.text) {
      setAiText(String(res.data.text));
    } else {
      setAiError(res.message ?? 'AI 服务暂不可用。');
    }
    setAiLoading(false);
  }, [detail, router]);

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-[14px] text-[var(--bz-text-muted)] py-16">
        <Loader2 className="w-4 h-4 animate-spin" /> 正在读取企业全景数据…
      </div>
    );
  }

  if (!detail) {
    return (
      <div className="bz-card rounded-[6px] p-6">
        <div className="flex items-center gap-2 text-[15px] font-semibold" style={{ color: BRAND }}>
          <CircleAlert className="w-4 h-4" /> 无法展示企业全景
        </div>
        <p className="text-[13px] text-[var(--bz-text-sub)] mt-2">{failed}</p>
        <button type="button" className="bz-btn bz-btn-ghost mt-4" onClick={() => router.push('/centers/enterprise')}>
          <ArrowLeft className="w-4 h-4" /> 返回企业列表
        </button>
      </div>
    );
  }

  const { enterprise, profile, patentStats, recentPatents, signals } = detail;
  const evidenceTotal = signals.reduce((n, s) => n + s.evidence.length, 0);
  const maxIndependent = signals.reduce((n, s) => Math.max(n, s.independentSourceCount), 0);

  const steps = [
    {
      no: '01',
      title: '身份识别',
      desc: `identityConfidence=${labelOf(CONFIDENCE_LABEL, enterprise.identityConfidence)}`,
      ok: enterprise.identityConfidence !== 'low',
    },
    {
      no: '02',
      title: '数据采集',
      desc: `${signals.length} 条信号 / ${evidenceTotal} 条证据`,
      ok: evidenceTotal > 0,
    },
    {
      no: '03',
      title: '证据认定',
      desc: `企业核验态：${badgeOf(VERIFICATION_LABEL, enterprise.verificationStatus).label}`,
      ok: enterprise.verificationStatus === 'verified' || enterprise.verificationStatus === 'multi_source',
    },
    {
      no: '04',
      title: '原文存证',
      desc: '证据保留 claim_text 与 excerpt，只可标记失效、不可覆盖',
      ok: signals.some((s) => s.evidence.some((e) => Boolean(e.excerpt))),
    },
    {
      no: '05',
      title: '独立校验',
      desc: `单条结论最多 ${maxIndependent} 个独立来源${maxIndependent >= 2 ? '，已达双源门槛' : '，未达双源门槛'}`,
      ok: maxIndependent >= 2,
    },
  ];

  return (
    <div>
      <PageHeader
        title={enterprise.name}
        description={`${enterprise.industry ?? '行业未采集'} ｜ ${enterprise.track ?? '细分领域未采集'} ｜ ${enterprise.region ?? '地区未采集'}${enterprise.stage ? ` ｜ ${enterprise.stage}` : ''}`}
        actions={
          <>
            <span className="bz-badge bz-badge-gold">演示数据</span>
            <button type="button" className="bz-btn bz-btn-ghost" onClick={() => router.push('/centers/enterprise')}>
              <ArrowLeft className="w-4 h-4" /> 返回列表
            </button>
          </>
        }
      />

      <p className="text-[12px] text-[var(--bz-text-muted)] mb-5 -mt-2">
        数据后端 {detail.backend}。企业身份与资质来自公开名单（标记为真实采集），专利明细为合成演示值，
        画像与五维评分都由确定性规则写入、随规则版本落库；本页所有数字均来自库内实际行数，非装饰值。
      </p>

      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3 mb-5">
        <Tile
          label="综合评分"
          value={score?.total_score ?? profile?.overallScore ?? '待评分'}
          hint={
            score
              ? `规则 ${score.rule_version} ｜ ${score.grade ?? '证据不足'} 级 ｜ ${score.computedLabel}`
              : profile
                ? `画像 ${profile.profileVersion}，评分器尚未运行`
                : '画像尚未生成'
          }
        />
        <Tile label="数据覆盖率" value={ratio(profile?.dataCoverage)} hint="缺失维度不计 0 分" />
        <Tile
          label="专利总数"
          value={patentStats?.total ?? '—'}
          hint={patentStats ? `规则 ${patentStats.ruleVersion}` : '本语料内无专利记录'}
        />
        <Tile
          label="发明专利"
          value={patentStats?.inventionCount ?? '—'}
          hint={`占比 ${ratio(patentStats?.validInventionRatio)}`}
        />
        <Tile label="待核实事项" value={profile?.pendingVerificationCount ?? 0} hint="含未采集字段与单源结论" />
        <Tile label="证据条数" value={evidenceTotal} hint={`信号 ${signals.length} 条`} />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <div className="xl:col-span-2 flex flex-col gap-4">
          <section className="bz-card">
            <div className="bz-card-head">
              <h3 className="bz-card-title">五维技术价值评分（确定性代码执行）</h3>
              <div className="flex items-center gap-2">
                {score && (
                  <span className="text-[12px] text-[var(--bz-text-muted)]">
                    规则 {score.rule_version} ｜ {score.computedLabel}
                  </span>
                )}
                <button type="button" className="bz-btn bz-btn-ghost" onClick={() => void runScore()} disabled={scoreRunning}>
                  {scoreRunning ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                  {score ? '重算评分' : '运行评分'}
                </button>
              </div>
            </div>

            {scoreError && (
              <p className="px-5 pt-4 text-[13px]" style={{ color: 'var(--bz-danger, #cc0000)' }}>
                {scoreError}
              </p>
            )}

            {!score && !scoreError && (
              <p className="p-5 text-[13px] text-[var(--bz-text-muted)]">
                {scoreMissing
                  ? '该企业尚未运行评分器。评分由确定性规则产出、按规则版本落库，缺记录不等于 0 分。'
                  : '正在读取评分记录…'}
              </p>
            )}

            {score && (
              <div className="p-5">
                <div className="flex flex-wrap items-end gap-x-8 gap-y-3 mb-5">
                  <div>
                    <div className="text-[13px] text-[var(--bz-text-muted)]">综合分 TVS</div>
                    <div className="text-[34px] font-semibold num leading-tight" style={{ color: BRAND }}>
                      {score.total_score ?? '证据不足'}
                    </div>
                  </div>
                  <div className="text-[13px]">
                    <span className="bz-badge bz-badge-gold">{score.grade ?? '—'}</span>
                    <span className="ml-2 text-[var(--bz-text-sub)]">
                      {score.evidence.grade_label ?? '未分级（覆盖率未达门槛）'}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-[12px] md:ml-auto">
                    <div>
                      <div className="text-[var(--bz-text-muted)]">数据覆盖率</div>
                      <div className="num font-semibold">{ratio(score.data_coverage)}</div>
                    </div>
                    <div>
                      <div className="text-[var(--bz-text-muted)]">证据置信度</div>
                      <div className="num font-semibold">{ratio(score.evidence.evidence_confidence)}</div>
                    </div>
                    <div>
                      <div className="text-[var(--bz-text-muted)]">可评分指标率</div>
                      <div className="num font-semibold">{ratio(score.evidence.scorable_indicator_rate)}</div>
                    </div>
                    <div>
                      <div className="text-[var(--bz-text-muted)]">独立证据率</div>
                      <div className="num font-semibold">{ratio(score.evidence.independent_evidence_rate)}</div>
                    </div>
                  </div>
                </div>

                {score.withheld_reason && (
                  <p className="mb-4 rounded-[4px] px-3 py-2 text-[12px]" style={{ background: 'var(--bz-warn-soft, #fff7e6)', color: 'var(--bz-text-sub)' }}>
                    {score.withheld_reason}
                  </p>
                )}

                <div className="flex flex-col gap-2 mb-5">
                  {score.dimensions.map((d) => (
                    <div key={d.dimension} className="flex items-center gap-3">
                      <div className="w-[168px] shrink-0 text-[13px]">
                        <span className="num font-semibold mr-1">{d.dimension}</span>
                        {d.name}
                      </div>
                      <div className="flex-1 h-[10px] rounded-full overflow-hidden" style={{ background: 'var(--bz-bg-soft, #f4f1f0)' }}>
                        <div
                          className="h-full rounded-full"
                          style={{
                            width: `${d.score === null ? 0 : Math.max(2, Math.min(100, d.score))}%`,
                            background: d.score === null ? 'transparent' : BRAND,
                          }}
                        />
                      </div>
                      <div className="w-[74px] text-right num text-[13px]">{d.score === null ? '证据不足' : d.score.toFixed(1)}</div>
                      <div className="w-[112px] text-right text-[12px] text-[var(--bz-text-muted)]">
                        权重 {(d.weight * 100).toFixed(0)}% ｜ 覆盖 {(d.coverage * 100).toFixed(0)}%
                      </div>
                      <div className="w-[96px] text-right">
                        <span className={`bz-badge ${badgeOf(INDICATOR_STATUS_LABEL, d.status).cls}`}>
                          {badgeOf(INDICATOR_STATUS_LABEL, d.status).label}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="flex flex-wrap items-center gap-3 text-[12px] text-[var(--bz-text-muted)] mb-3">
                  <button type="button" className="bz-btn bz-btn-ghost" onClick={() => setShowIndicators((v) => !v)}>
                    {showIndicators ? '收起 30 项指标明细' : '展开 30 项指标明细'}
                  </button>
                  <span>
                    短板 {score.weaknesses.length} 项 ｜ 亮点 {score.strengths.length} 项 ｜ 待核实 {score.pending_review_count} 项
                  </span>
                  <span>数据来源标记：{badgeOf(DATA_KIND_LABEL, score.data_kind).label}</span>
                </div>

                {showIndicators && (
                  <div className="bz-scroll mb-5">
                    <table className="bz-table">
                      <thead>
                        <tr>
                          <th>指标</th>
                          <th className="text-right">权重</th>
                          <th className="text-right">原始值</th>
                          <th className="text-right">得分</th>
                          <th>状态</th>
                          <th className="text-right">独立来源</th>
                          <th className="text-right">证据</th>
                          <th>口径与解释</th>
                        </tr>
                      </thead>
                      <tbody>
                        {score.dimensions.flatMap((d) =>
                          d.indicators.map((i) => (
                            <tr key={`${d.dimension}-${i.code}`}>
                              <td className="whitespace-nowrap">
                                <span className="num font-semibold mr-1">{i.code}</span>
                                <span className="text-[var(--bz-text-sub)]">{i.name}</span>
                              </td>
                              <td className="text-right num">{Number(i.weight).toFixed(3)}</td>
                              <td className="text-right num">{i.raw_value ?? '—'}</td>
                              <td className="text-right num">
                                {i.score === null ? <span className="text-[var(--bz-text-muted)]">缺证据</span> : i.score}
                              </td>
                              <td>
                                <span className={`bz-badge ${badgeOf(INDICATOR_STATUS_LABEL, i.status).cls}`}>
                                  {badgeOf(INDICATOR_STATUS_LABEL, i.status).label}
                                </span>
                              </td>
                              <td className="text-right num">{i.independent_sources}</td>
                              <td className="text-right num">
                                {i.evidence_ids.length > 0 ? `${i.evidence_ids.length} 条` : '—'}
                              </td>
                              <td className="text-[12px] text-[var(--bz-text-sub)] max-w-[520px]">{i.explanation ?? '—'}</td>
                            </tr>
                          )),
                        )}
                      </tbody>
                    </table>
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div>
                    <h4 className="text-[14px] font-semibold mb-2">计算过程（为什么是这个分）</h4>
                    <ol className="flex flex-col gap-2 text-[12px] text-[var(--bz-text-sub)]">
                      {score.derivation.map((s, idx) => (
                        <li key={`${s.step}-${idx}`} className="rounded-[4px] px-3 py-2" style={{ background: 'var(--bz-bg-soft, #f7f5f4)' }}>
                          <div className="font-semibold text-[var(--bz-text)]">
                            {idx + 1}. {s.step} = {s.value}
                          </div>
                          <div className="mt-1">{s.detail}</div>
                        </li>
                      ))}
                    </ol>
                  </div>
                  <div className="flex flex-col gap-4">
                    {score.strengths.length > 0 && (
                      <div>
                        <h4 className="text-[14px] font-semibold mb-2">相对亮点</h4>
                        <ul className="list-disc pl-5 text-[13px] text-[var(--bz-text-sub)] space-y-1">
                          {score.strengths.map((t) => (
                            <li key={t}>{t}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                    <div>
                      <h4 className="text-[14px] font-semibold mb-2">短板（有证据且偏低）</h4>
                      {score.weaknesses.length > 0 ? (
                        <ul className="list-disc pl-5 text-[13px] text-[var(--bz-text-sub)] space-y-1">
                          {score.weaknesses.map((t) => (
                            <li key={t}>{t}</li>
                          ))}
                        </ul>
                      ) : (
                        <p className="text-[13px] text-[var(--bz-text-muted)]">本次没有「有证据且低于 60 分」的维度。</p>
                      )}
                    </div>
                    <p className="text-[12px] text-[var(--bz-text-muted)]">
                      评分与证据置信度分开输出：置信度不参与总分运算，只说明「这些分有多少来自双源印证的证据」。
                    </p>
                  </div>
                </div>
              </div>
            )}
          </section>

          <section className="bz-card">
            <div className="bz-card-head">
              <h3 className="bz-card-title">技术画像（确定性规则输出）</h3>
              {profile && (
                <span className="text-[12px] text-[var(--bz-text-muted)]">
                  证据置信 {labelOf(CONFIDENCE_LABEL, profile.evidenceConfidence)}
                </span>
              )}
            </div>
            <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-6">
              {profile ? (
                <>
                  <LayerTable title="身份层" data={profile.identityLayer} />
                  <LayerTable title="技术身份层" data={profile.techIdentityLayer} />
                  <LayerTable title="证据层" data={profile.evidenceLayer} />
                  <LayerTable title="成长层" data={profile.growthLayer} note="未采集即为空" />
                  <LayerTable title="风险层" data={profile.riskLayer} note="不做造假推断" />
                  <div className="md:col-span-2">
                    <h4 className="text-[14px] font-semibold mb-2">待人工确认（{profile.openQuestions.length}）</h4>
                    <ul className="list-disc pl-5 text-[13px] text-[var(--bz-text-sub)] space-y-1">
                      {profile.openQuestions.map((q) => (
                        <li key={q}>{q}</li>
                      ))}
                    </ul>
                  </div>
                </>
              ) : (
                <p className="text-[13px] text-[var(--bz-text-muted)] md:col-span-2">
                  该企业尚无画像记录 —— 画像由批处理任务写入，缺失不等于差评。
                </p>
              )}
            </div>
          </section>

          <section className="bz-card">
            <div className="bz-card-head">
              <h3 className="bz-card-title">专利结构</h3>
              <span className="text-[12px] text-[var(--bz-text-muted)]">
                {patentStats ? `聚合规则 ${patentStats.ruleVersion}` : '无聚合行'}
              </span>
            </div>
            {patentStats ? (
              <div className="p-5">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5 text-[13px]">
                  <div>
                    <div className="text-[var(--bz-text-muted)]">发明 / 实用新型 / 外观</div>
                    <div className="num font-semibold">
                      {patentStats.inventionCount} / {patentStats.utilityModelCount} / {patentStats.designCount}
                    </div>
                  </div>
                  <div>
                    <div className="text-[var(--bz-text-muted)]">近 5 年申请占比</div>
                    <div className="num font-semibold">{ratio(patentStats.recentFilingRatio)}</div>
                  </div>
                  <div>
                    <div className="text-[var(--bz-text-muted)]">平均质量分</div>
                    <div className="num font-semibold">{patentStats.avgQualityScore ?? '—'}</div>
                  </div>
                  <div>
                    <div className="text-[var(--bz-text-muted)]">异常候选</div>
                    <div className="num font-semibold">{patentStats.anomalyCount}</div>
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <div className="text-[13px] font-semibold mb-1">申请趋势（按申请年）</div>
                    <Chart option={trendOption} height={220} />
                  </div>
                  <div>
                    <div className="text-[13px] font-semibold mb-1">法律状态构成</div>
                    <Chart option={legalOption} height={220} />
                  </div>
                  <div className="md:col-span-2">
                    <div className="text-[13px] font-semibold mb-1">技术域分布 Top 8</div>
                    <Chart option={domainOption} height={240} />
                  </div>
                </div>
                <p className="text-[12px] text-[var(--bz-text-muted)] mt-3">
                  趋势与分布由 tvd_patent_stats 的聚合行直接渲染，聚合行由已落库的专利明细算出；
                  专利明细本身为合成演示值，用于验证算法与页面，不代表真实申请记录。
                </p>
              </div>
            ) : (
              <div className="p-5 text-[13px] text-[var(--bz-text-muted)]">
                本语料内没有该企业的专利行。这里显示「无记录」而不是 0，是为了和「确实查到 0 件」区分开。
              </div>
            )}
          </section>

          <section className="bz-card">
            <div className="bz-card-head">
              <h3 className="bz-card-title">近期专利（{recentPatents.length}）</h3>
              <span className="text-[12px] text-[var(--bz-text-muted)]">按申请日倒序，最多 20 条</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-[13px]">
                <thead>
                  <tr className="text-left text-[var(--bz-text-sub)] border-b border-[var(--bz-line)]">
                    <th className="px-4 py-2 font-medium">公开号</th>
                    <th className="px-4 py-2 font-medium">名称</th>
                    <th className="px-4 py-2 font-medium">类型</th>
                    <th className="px-4 py-2 font-medium">法律状态</th>
                    <th className="px-4 py-2 font-medium">申请日</th>
                    <th className="px-4 py-2 font-medium text-right">被引</th>
                    <th className="px-4 py-2 font-medium text-right">权利要求</th>
                    <th className="px-4 py-2 font-medium">数据分级</th>
                  </tr>
                </thead>
                <tbody>
                  {recentPatents.map((p) => (
                    <tr key={p.id} className="border-b border-[var(--bz-line)] last:border-0">
                      <td className="px-4 py-2 num whitespace-nowrap">{p.publicationNumber}</td>
                      <td className="px-4 py-2">{p.title}</td>
                      <td className="px-4 py-2">{labelOf(PATENT_TYPE_LABEL, p.patentType)}</td>
                      <td className="px-4 py-2">{labelOf(PATENT_LEGAL_STATUS_LABEL, p.legalStatus)}</td>
                      <td className="px-4 py-2 num">{dateOnly(p.filingDate)}</td>
                      <td className="px-4 py-2 num text-right">{p.citedByCount}</td>
                      <td className="px-4 py-2 num text-right">{p.claimCount}</td>
                      <td className="px-4 py-2">{kindBadge(p.dataKind)}</td>
                    </tr>
                  ))}
                  {recentPatents.length === 0 && (
                    <tr>
                      <td className="px-4 py-6 text-[var(--bz-text-muted)]" colSpan={8}>
                        无专利明细。
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
          <section className="bz-card">
            <div className="bz-card-head">
              <h3 className="bz-card-title">专利质量与异常信号（确定性规则）</h3>
              <div className="flex items-center gap-3">
                <span className="text-[12px] text-[var(--bz-text-muted)]">
                  {qc ? `规则 ${qc.rule_version}${qc.computedLabel ? ` ｜ ${qc.computedLabel}` : ''}` : 'TVD-05 / TVD-06'}
                </span>
                <button type="button" className="bz-btn bz-btn-ghost" onClick={() => void runQc()} disabled={qcRunning}>
                  {qcRunning ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                  重算质量与异常
                </button>
              </div>
            </div>

            {qcError && <div className="px-5 pb-2 text-[12px] text-[var(--bz-danger)]">{qcError}</div>}

            {!qc && !qcError && (
              <div className="p-5 text-[13px] text-[var(--bz-text-muted)]">
                {qcAssessed
                  ? '质量行还没读回来，稍后刷新；读不到就留空，不会用 0 分顶上。'
                  : '尚未执行专利质量评估。质量分与异常都由确定性规则从专利客观字段算出，没跑过就显示"待评估"，不会显示 0 分。'}
              </div>
            )}

            {qc && (
              <div className="p-5 flex flex-col gap-4">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-[13px]">
                  <div>
                    <div className="text-[var(--bz-text-muted)]">平均质量分</div>
                    <div className="num font-semibold text-[16px]">{qc.avg_quality_score ?? '缺输入'}</div>
                  </div>
                  <div>
                    <div className="text-[var(--bz-text-muted)]">出分件数</div>
                    <div className="num font-semibold text-[16px]">
                      {qc.scored} / {qc.patents}
                    </div>
                  </div>
                  <div>
                    <div className="text-[var(--bz-text-muted)]">待核实异常</div>
                    <div className="num font-semibold text-[16px]">{qc.anomalies.total}</div>
                  </div>
                  <div>
                    <div className="text-[var(--bz-text-muted)]">权重口径</div>
                    <div className="num font-semibold text-[13px]">{qc.weight_profile}</div>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2 items-center">
                  {['A', 'B', 'C', 'D', 'E'].map((g) =>
                    qc.grade_counts[g] ? (
                      <span key={g} className="bz-badge bz-badge-gray">
                        {g} 级 {qc.grade_counts[g]} 件
                      </span>
                    ) : null,
                  )}
                  <span className="text-[12px] text-[var(--bz-text-muted)]">
                    分级只描述单件专利的信息强度，不代表企业技术好坏。
                  </span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-[13px]">
                    <thead>
                      <tr className="text-left text-[var(--bz-text-sub)] border-b border-[var(--bz-line)]">
                        <th className="px-3 py-2 font-medium">质量维度</th>
                        <th className="px-3 py-2 font-medium text-right">权重</th>
                        <th className="px-3 py-2 font-medium text-right">平均分</th>
                        <th className="px-3 py-2 font-medium text-right">缺输入件数</th>
                      </tr>
                    </thead>
                    <tbody>
                      {qc.dimensions.map((d) => (
                        <tr key={d.key} className="border-b border-[var(--bz-line)] last:border-0">
                          <td className="px-3 py-2">
                            <span className="num font-semibold mr-2">{d.key}</span>
                            {d.name}
                          </td>
                          <td className="px-3 py-2 num text-right">{Math.round(d.weight * 100)}%</td>
                          <td className="px-3 py-2 num text-right">{d.avg ?? '—'}</td>
                          <td className="px-3 py-2 num text-right">
                            {d.insufficient > 0 ? (
                              <span className="bz-badge bz-badge-warn">{d.insufficient}</span>
                            ) : (
                              <span className="text-[var(--bz-text-muted)]">0</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <div className="text-[13px] font-semibold">异常清单（需人工核实，不是造假结论）</div>
                    <div className="flex items-center gap-3">
                      <span className="text-[12px] text-[var(--bz-text-muted)]">
                        命中 {Object.entries(qc.anomalies.by_type).map(([k, v]) => `${labelOf(ANOMALY_TYPE_LABEL, k)} ${v}`).join('、') || '无'}
                      </span>
                      {qc.anomalies.items.length > 6 && (
                        <button type="button" className="bz-btn bz-btn-ghost" onClick={() => setShowAnomalies((v) => !v)}>
                          {showAnomalies ? '收起' : `展开 ${qc.anomalies.items.length} 条`}
                        </button>
                      )}
                    </div>
                  </div>
                  <ul className="flex flex-col gap-2">
                    {qc.anomalies.items.slice(0, showAnomalies ? qc.anomalies.items.length : 6).map((it) => {
                      const sev = badgeOf(ANOMALY_SEVERITY_LABEL, it.severity);
                      return (
                        <li key={it.id} className="border border-[var(--bz-line)] rounded-[6px] p-3">
                          <div className="flex flex-wrap items-center gap-2 mb-1">
                            <span className={`bz-badge ${sev.cls}`}>{sev.label}</span>
                            <span className="text-[13px] font-semibold">{labelOf(ANOMALY_TYPE_LABEL, it.anomaly_type)}</span>
                            {it.publication_number && <span className="num text-[12px] text-[var(--bz-text-sub)]">{it.publication_number}</span>}
                            <span className="text-[12px] text-[var(--bz-text-muted)]">涉及 {it.related_count} 件</span>
                          </div>
                          <div className="text-[12px] leading-relaxed text-[var(--bz-text-sub)]">{it.detail}</div>
                          <div className="text-[12px] text-[var(--bz-text-muted)] mt-1 num">
                            观测：
                            {Object.entries(it.observed)
                              .filter(([k]) => k !== 'publication_numbers')
                              .map(([k, v]) => `${k}=${Array.isArray(v) ? v.length : String(v)}`)
                              .join('，')}
                          </div>
                        </li>
                      );
                    })}
                    {qc.anomalies.items.length === 0 && (
                      <li className="text-[13px] text-[var(--bz-text-muted)]">
                        本轮 8 类异常规则扫描 {qc.patents} 件专利，未命中任何一条。没有异常不等于查过没问题，
                        口径与阈值写在 pqc 规则目录里，可复核。
                      </li>
                    )}
                  </ul>
                  {qc.anomalies.truncated && (
                    <p className="text-[12px] text-[var(--bz-text-muted)] mt-2">
                      清单按严重程度截断显示前 {qc.anomalies.items.length} 条，全量 {qc.anomalies.total} 条仍在 tvd_patent_anomalies。
                    </p>
                  )}
                </div>

                <p className="text-[12px] text-[var(--bz-text-muted)]">
                  质量分只在「有输入的维度」上归一：某个维度缺字段就标为证据不足并从加权里剔除，不按 0 分计入。
                  异常行随规则版本整批重算，原始专利明细不被覆盖。
                </p>
              </div>
            )}
          </section>
        </div>

        <div className="flex flex-col gap-4">
          <section className="bz-card">
            <div className="bz-card-head">
              <h3 className="bz-card-title">溯源流水线</h3>
              <ShieldCheck className="w-4 h-4" style={{ color: BRAND }} />
            </div>
            <ol className="p-4 flex flex-col gap-2">
              {steps.map((s) => (
                <li key={s.no} className="flex gap-3 items-start">
                  <span
                    className="shrink-0 w-7 h-7 rounded-[4px] grid place-items-center text-[12px] font-semibold num"
                    style={{
                      background: s.ok ? 'var(--bz-brand-tint)' : 'var(--bz-line)',
                      color: s.ok ? BRAND : 'var(--bz-text-muted)',
                    }}
                  >
                    {s.no}
                  </span>
                  <div className="min-w-0">
                    <div className="text-[13px] font-semibold">{s.title}</div>
                    <div className="text-[12px] text-[var(--bz-text-muted)] leading-relaxed">{s.desc}</div>
                  </div>
                </li>
              ))}
            </ol>
            <p className="px-4 pb-4 text-[12px] text-[var(--bz-text-muted)]">
              第 05 步未达标时结论保持「单源/待核实」，系统不会自动补源或抹平冲突。
            </p>
          </section>

          <section className="bz-card">
            <div className="bz-card-head">
              <h3 className="bz-card-title">信号与证据（{signals.length}）</h3>
              <span className="text-[12px] text-[var(--bz-text-muted)]">点开看原文</span>
            </div>
            <div className="p-3 flex flex-col gap-2">
              {signals.map((s) => {
                const open = openSignalId === s.id;
                return (
                  <div key={s.id} className="rounded-[6px] border border-[var(--bz-line)]">
                    <button
                      type="button"
                      className="w-full text-left px-3 py-2 flex items-start justify-between gap-2"
                      onClick={() => setOpenSignalId(open ? null : s.id)}
                    >
                      <div className="min-w-0">
                        <div className="text-[13px] font-semibold truncate">
                          {labelOf(SIGNAL_TYPE_LABEL, s.signalType)}｜{s.subject}
                        </div>
                        <div className="text-[12px] text-[var(--bz-text-muted)] truncate">
                          {s.textValue ?? s.observedValue ?? '—'}
                          {s.valueUnit ? ` ${s.valueUnit}` : ''}
                        </div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">{verificationBadge(s.verificationStatus)}</div>
                    </button>

                    {open && (
                      <div className="px-3 pb-3 flex flex-col gap-2">
                        <div className="text-[12px] text-[var(--bz-text-muted)] flex flex-wrap gap-x-3 gap-y-1">
                          <span>发生日期 {dateOnly(s.occurredAt)}</span>
                          <span>独立来源 {s.independentSourceCount}</span>
                          <span>置信 {labelOf(CONFIDENCE_LABEL, s.confidence)}</span>
                          <span className="flex items-center gap-1">
                            分级 {kindBadge(s.dataKind)}
                          </span>
                        </div>
                        {s.evidence.length === 0 && (
                          <p className="text-[12px] text-[var(--bz-warn)]">
                            该结论暂无绑定证据 —— 按规则它不能进入评分输入。
                          </p>
                        )}
                        {s.evidence.map((e) => (
                          <div key={e.evidenceId} className="rounded-[4px] bg-[var(--bz-brand-tint)]/40 p-3">
                            <div className="text-[13px] leading-relaxed">{e.claimText}</div>
                            {e.excerpt && (
                              <div className="text-[12px] text-[var(--bz-text-sub)] mt-1 break-all">
                                原文摘录：{e.excerpt}
                              </div>
                            )}
                            <div className="text-[12px] text-[var(--bz-text-muted)] mt-2 flex flex-wrap gap-x-3 gap-y-1">
                              <span>{e.sourceTitle ?? '未命名来源'}</span>
                              {e.sourceName && <span>· {e.sourceName}</span>}
                              {e.sourceTier && <span>· {labelOf(SOURCE_TIER_LABEL, e.sourceTier)}</span>}
                              <span>· 可信度 {e.credibility}</span>
                              <span>· 发布 {dateOnly(e.publishedAt)}</span>
                              <span>· 采集 {dateOnly(e.retrievedAt)}</span>
                              {e.accessMethod && <span>· {labelOf(ACCESS_METHOD_LABEL, e.accessMethod)}</span>}
                            </div>
                            {e.sourceUrl && (
                              <a
                                href={e.sourceUrl}
                                target="_blank"
                                rel="noreferrer noopener"
                                className="inline-flex items-center gap-1 text-[12px] mt-2"
                                style={{ color: BRAND }}
                              >
                                <ExternalLink className="w-3 h-3" /> 打开原始来源
                              </a>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
              {signals.length === 0 && (
                <p className="text-[13px] text-[var(--bz-text-muted)] p-3">该企业暂无信号记录。</p>
              )}
            </div>
          </section>

          <section className="bz-card">
            <div className="bz-card-head">
              <h3 className="bz-card-title">AI 辅助解读</h3>
              <button
                type="button"
                className="bz-btn bz-btn-primary h-8 text-[13px]"
                onClick={() => void runAiRead()}
                disabled={aiLoading}
              >
                {aiLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                {aiText ? '重新生成' : '生成解读'}
              </button>
            </div>
            <div className="p-4">
              <p className="text-[12px] text-[var(--bz-text-muted)] mb-3">
                解读只使用本页已落库的证据原文，模型不补充事实；输出需人工复核，不作为授信依据。
              </p>
              {aiError && <p className="text-[13px]" style={{ color: BRAND }}>{aiError}</p>}
              {aiText && (
                <div className="text-[13px] leading-relaxed whitespace-pre-wrap text-[var(--bz-text)]">{aiText}</div>
              )}
              {!aiText && !aiError && !aiLoading && (
                <p className="text-[13px] text-[var(--bz-text-muted)]">尚未生成。点击右上按钮开始。</p>
              )}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
