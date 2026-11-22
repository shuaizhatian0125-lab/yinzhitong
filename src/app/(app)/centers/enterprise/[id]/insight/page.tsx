'use client';

import * as React from 'react';
import { useRouter, useParams } from 'next/navigation';
import { ArrowLeft, Loader2, BarChart3 } from 'lucide-react';
import { RadarChartView } from '@/components/charts/RadarChartView';
import { TrendLineChartView } from '@/components/charts/TrendLineChartView';
import { IndustryCompareBarView } from '@/components/charts/IndustryCompareBarView';
import { GaugeChartView } from '@/components/charts/GaugeChartView';
import { DemandDistributionView } from '@/components/charts/DemandDistributionView';
import { EvidenceConfidenceView } from '@/components/charts/EvidenceConfidenceView';

type RadarScores = {
  techInnovation: number;
  growthPotential: number;
  marketSpace: number;
  financialDemand: number;
  riskLevel: number;
};

type TrendData = {
  years: string[];
  revenueGrowth: number[];
  rdInvestment: number[];
  marketShare: number[];
};

type CompareData = {
  scale: number;
  tech: number;
  growth: number;
  risk: number;
};

type DemandItem = {
  type: string;
  amountRange: string;
  urgency: 'high' | 'medium' | 'low';
};

type EvidenceItem = {
  finding: string;
  source: string;
  confidence: 'high' | 'medium' | 'low';
};

type InsightData = {
  enterprise: {
  id: string;
  name: string;
  industry: string;
  region: string;
  scale: string;
  riskLevel: string;
  };
  radarScores: RadarScores;
  trendData: TrendData;
  industryAvg: CompareData;
  enterpriseCompare: CompareData;
  overallScore: number;
  valueLevel: string;
  analyses: Array<{
  type: string;
  evidence: EvidenceItem[];
  demands: DemandItem[];
  }>;
};

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
  <div className="bz-card bz-shadow-soft" style={{ borderRadius: 8 }}>
  <div className="bz-card-head" style={{ padding: '12px 16px' }}>
  <span className="bz-card-title" style={{ fontSize: 14 }}>
  {title}
  </span>
  </div>
  <div className="p-3" style={{ paddingTop: 8 }}>
  {children}
  </div>
  </div>
  );
}

export default function EnterpriseInsightPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const enterpriseId = params.id;

  const [data, setData] = React.useState<InsightData | null>(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
  async function fetchData() {
  try {
  const res = await fetch(`/api/v1/enterprises/${enterpriseId}/insight-data`);
  const json = await res.json();
  if (json.code === 0 && json.data) {
  setData(json.data);
  }
  } catch {
  // ignore
  } finally {
  setLoading(false);
  }
  }
  fetchData();
  }, [enterpriseId]);

  if (loading) {
  return (
  <div className="flex items-center justify-center py-20">
  <Loader2 className="h-6 w-6 animate-spin text-[var(--bz-text-muted)]" />
  </div>
  );
  }

  if (!data) {
  return (
  <div className="flex flex-col items-center justify-center py-20 gap-3">
  <p className="text-[var(--bz-text-muted)]">数据加载失败</p>
  <button className="bz-btn bz-btn-default" onClick={() => router.push(`/centers/enterprise/${enterpriseId}`)}>
  返回企业详情
  </button>
  </div>
  );
  }

  const allDemands = data.analyses
  .filter((a) => a.type === 'financial_demand')
  .flatMap((a) => a.demands);

  const allEvidence = data.analyses.flatMap((a) => a.evidence);

  return (
  <div className="flex flex-col gap-4">
  {/* 顶部：返回按钮 + 企业名称 + 综合评分 */}
  <div className="flex items-center justify-between gap-4 pb-3 border-b border-[var(--bz-line)]">
  <div className="flex items-center gap-3">
  <button
  className="bz-btn bz-btn-ghost"
  onClick={() => router.push(`/centers/enterprise/${enterpriseId}`)}
  >
  <ArrowLeft className="h-4 w-4" />
  返回详情
  </button>
  <div className="flex items-center gap-2">
  <BarChart3 className="h-5 w-5" style={{ color: 'var(--bz-brand)' }} />
  <h1 className="text-[20px] font-semibold text-[var(--bz-text)]">{data.enterprise.name}</h1>
  <span className="text-[13px] text-[var(--bz-text-sub)]">价值洞察可视化</span>
  </div>
  </div>
  <div className="flex items-center gap-3">
  <div
  className="flex items-center gap-2 px-3 py-1.5 rounded"
  style={{
  background:
  data.overallScore >= 80 ? '#edf7f1' :
  data.overallScore >= 60 ? '#fbeeee' :
  data.overallScore >= 40 ? '#fdf4e7' : '#fdf0ef',
  borderRadius: 6,
  }}
  >
  <span className="text-[13px] text-[var(--bz-text-sub)]">综合评分</span>
  <span
  className="text-[18px] font-bold"
  style={{
  color:
  data.overallScore >= 80 ? '#1e7b4f' :
  data.overallScore >= 60 ? '#cc0000' :
  data.overallScore >= 40 ? '#b26a00' : '#b42318',
  }}
  >
  {data.overallScore}
  </span>
  <span className="text-[11px] text-[var(--bz-text-muted)]">/100</span>
  <span
  className="bz-badge"
  style={{
  background:
  data.overallScore >= 80 ? '#edf7f1' :
  data.overallScore >= 60 ? '#fbeeee' :
  data.overallScore >= 40 ? '#fdf4e7' : '#fdf0ef',
  color:
  data.overallScore >= 80 ? '#1e7b4f' :
  data.overallScore >= 60 ? '#cc0000' :
  data.overallScore >= 40 ? '#b26a00' : '#b42318',
  borderColor:
  data.overallScore >= 80 ? '#cfe8da' :
  data.overallScore >= 60 ? '#cfd6dd' :
  data.overallScore >= 40 ? '#f2ddbd' : '#f2cfcc',
  }}
  >
  {data.valueLevel}
  </span>
  </div>
  </div>
  </div>

  {/* 主区域：2x3网格 */}
  <div className="grid grid-cols-3 gap-2">
  {/* 第一行 */}
  <ChartCard title="五维度评分雷达图">
  <RadarChartView scores={data.radarScores} />
  </ChartCard>

  <ChartCard title="综合评分仪表盘">
  <GaugeChartView score={data.overallScore} valueLevel={data.valueLevel} />
  </ChartCard>

  <ChartCard title="发展趋势折线图">
  <TrendLineChartView data={data.trendData} />
  </ChartCard>

  {/* 第二行 */}
  <ChartCard title="行业对比柱状图">
  <IndustryCompareBarView
  enterpriseData={data.enterpriseCompare}
  industryAvg={data.industryAvg}
  />
  </ChartCard>

  <ChartCard title="金融需求分布">
  <DemandDistributionView demands={allDemands} />
  </ChartCard>

  <ChartCard title="证据置信度分布">
  <EvidenceConfidenceView evidence={allEvidence} />
  </ChartCard>
  </div>

  {/* 底部：数据来源说明 */}
  <div
  className="px-4 py-3 rounded text-[12px] text-[var(--bz-text-muted)] leading-relaxed"
  style={{ background: '#fafbfd', borderRadius: 6, border: '1px solid var(--bz-line)' }}
  >
  <span className="font-medium text-[var(--bz-text-sub)]">数据来源说明：</span>
  评分数据基于企业AI分析结果（技术创新分析、成长潜力分析、金融需求识别、价值发现报告），趋势数据从企业画像字段提取估算，行业均值根据企业所属行业和规模进行估算。所有数据仅基于已录入的企业信息，缺失数据标注为"待补充"，不进行编造。
  </div>
  </div>
  );
}