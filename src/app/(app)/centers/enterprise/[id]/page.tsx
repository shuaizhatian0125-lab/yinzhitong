'use client';

import * as React from 'react';
import { useRouter, useParams } from 'next/navigation';
import { ArrowLeft, Cpu, TrendingUp, DollarSign, FileText, Loader2, BarChart3 } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { EnterpriseProfile, type EnterpriseProfileData } from '@/components/domain/EnterpriseProfile';
import { ServiceMatchPanel } from '@/components/domain/ServiceMatchPanel';

type AnalysisResult = {
  id: string;
  type: string;
  summary: string;
  scores: Record<string, unknown>;
  evidence: Array<{
    finding: string;
    source: string;
    confidence: string;
  }>;
  created_at: string;
};

const ANALYSIS_ACTIONS = [
  {
    type: 'tech_innovation',
    label: '技术创新分析',
    icon: Cpu,
    description: '核心技术、专利布局、研发投入、技术壁垒、创新评级',
    color: 'var(--bz-brand)',
  },
  {
    type: 'growth_potential',
    label: '成长潜力分析',
    icon: TrendingUp,
    description: '发展阶段、成长指标、市场空间、扩张能力、融资节奏',
    color: 'var(--bz-info)',
  },
  {
    type: 'financial_demand',
    label: '金融需求识别',
    icon: DollarSign,
    description: '研发融资、扩产融资、结算需求、供应链金融、国际化金融',
    color: 'var(--bz-gold)',
  },
  {
    type: 'value_report',
    label: '价值发现报告',
    icon: FileText,
    description: '11章节完整价值发现报告，一键转文档或转任务',
    color: 'var(--bz-ok)',
  },
] as const;

const ANALYSIS_TYPE_LABEL: Record<string, string> = {
  tech_innovation: '技术创新分析',
  growth_potential: '成长潜力分析',
  financial_demand: '金融需求识别',
  value_report: '价值发现报告',
};

const CONFIDENCE_VARIANT: Record<string, string> = {
  high: 'bz-badge-ok',
  medium: 'bz-badge-blue',
  low: 'bz-badge-gray',
};

const CONFIDENCE_LABEL: Record<string, string> = {
  high: '高置信',
  medium: '中置信',
  low: '低置信',
};

export default function EnterpriseDetailPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const enterpriseId = params.id;

  const [profileData, setProfileData] = React.useState<{
    row: {
      id: string;
      name: string;
      risk_level: string;
      tags: string[];
    };
    profile: EnterpriseProfileData;
  } | null>(null);
  const [analyses, setAnalyses] = React.useState<AnalysisResult[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [analyzing, setAnalyzing] = React.useState<string | null>(null);
  const [activeAnalysis, setActiveAnalysis] = React.useState<AnalysisResult | null>(null);

  const fetchEnterprise = React.useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/v1/enterprises/${enterpriseId}`);
      const json = await res.json();
      if (json.code === 0 && json.data) {
        setProfileData(json.data);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [enterpriseId]);

  const fetchAnalyses = React.useCallback(async () => {
    try {
      const res = await fetch(`/api/v1/enterprises/${enterpriseId}/analyses`);
      const json = await res.json();
      if (json.code === 0 && json.data) {
        setAnalyses(json.data);
      }
    } catch {
      // ignore
    }
  }, [enterpriseId]);

  React.useEffect(() => {
    fetchEnterprise();
    fetchAnalyses();
  }, [fetchEnterprise, fetchAnalyses]);

  const handleAnalyze = async (type: string) => {
    setAnalyzing(type);
    try {
      const res = await fetch(`/api/v1/enterprises/${enterpriseId}/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type }),
      });
      const json = await res.json();
      if (json.code === 0 && json.data) {
        setActiveAnalysis(json.data);
        fetchAnalyses();
      }
    } catch {
      // ignore
    } finally {
      setAnalyzing(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-[var(--bz-text-muted)]" />
      </div>
    );
  }

  if (!profileData) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3">
        <p className="text-[var(--bz-text-muted)]">企业不存在或已被删除</p>
        <button className="bz-btn bz-btn-default" onClick={() => router.push('/centers/enterprise')}>
          返回企业列表
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <button
          className="bz-btn bz-btn-ghost"
          onClick={() => router.push('/centers/enterprise')}
        >
          <ArrowLeft className="h-4 w-4" />
          返回列表
        </button>
      </div>

      <PageHeader
        title={profileData.row.name}
        description="企业全景画像与价值分析"
        actions={
          <button
            className="bz-btn bz-btn-primary"
            onClick={() => router.push(`/centers/enterprise/${enterpriseId}/insight`)}
          >
            <BarChart3 className="h-4 w-4" />
            价值洞察可视化
          </button>
        }
      />

      <div className="flex gap-4">
        {/* 左主区 70% */}
        <div className="flex-1" style={{ flexBasis: '70%' }}>
          <EnterpriseProfile profile={profileData.profile} riskLevel={profileData.row.risk_level} />

          {/* 分析结果展示 */}
          {activeAnalysis && (
            <div className="mt-4 bz-card" style={{ borderRadius: 8 }}>
              <div className="bz-card-head">
                <span className="bz-card-title">
                  {ANALYSIS_TYPE_LABEL[activeAnalysis.type] ?? '分析结果'}
                </span>
                <span className="text-[11px] text-[var(--bz-text-muted)]">
                  {new Date(activeAnalysis.created_at).toLocaleString('zh-CN')}
                </span>
              </div>
              <div className="p-4">
                <p className="text-[14px] text-[var(--bz-text)] leading-relaxed mb-3">
                  {activeAnalysis.summary}
                </p>

                {Object.keys(activeAnalysis.scores).length > 0 && (
                  <div className="mb-3">
                    <span className="text-[12px] font-medium text-[var(--bz-text-sub)] mb-2 block">评分维度</span>
                    <div className="grid grid-cols-2 gap-2">
                      {Object.entries(activeAnalysis.scores).map(([key, value]) => (
                        <div
                          key={key}
                          className="rounded px-3 py-2"
                          style={{ background: 'var(--bz-brand-tint)', borderRadius: 6 }}
                        >
                          <span className="text-[12px] text-[var(--bz-text-sub)]">{key}</span>
                          <p className="text-[13px] text-[var(--bz-text)] mt-0.5">
                            {typeof value === 'string' ? value : JSON.stringify(value)}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {activeAnalysis.evidence && activeAnalysis.evidence.length > 0 && (
                  <div>
                    <span className="text-[12px] font-medium text-[var(--bz-text-sub)] mb-2 block">证据与来源</span>
                    <div className="flex flex-col gap-2">
                      {activeAnalysis.evidence.map((ev, idx) => (
                        <div
                          key={idx}
                          className="rounded px-3 py-2"
                          style={{ background: '#fafbfd', borderRadius: 6 }}
                        >
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-[13px] text-[var(--bz-text)]">{ev.finding}</span>
                            <span className={`bz-badge ${CONFIDENCE_VARIANT[ev.confidence] ?? 'bz-badge-gray'}`} style={{ fontSize: 11 }}>
                              {CONFIDENCE_LABEL[ev.confidence] ?? ev.confidence}
                            </span>
                          </div>
                          <span className="text-[11px] text-[var(--bz-text-muted)]">来源: {ev.source}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* 历史分析列表 */}
          {analyses.length > 0 && (
            <div className="mt-4 bz-card" style={{ borderRadius: 8 }}>
              <div className="bz-card-head">
                <span className="bz-card-title">历史分析记录</span>
                <span className="text-[12px] text-[var(--bz-text-muted)]">{analyses.length} 条</span>
              </div>
              <div className="p-3">
                {analyses.map((analysis) => (
                  <div
                    key={analysis.id}
                    className="flex items-center gap-3 px-3 py-2.5 rounded transition-colors hover:bg-[#fafcfe] cursor-pointer"
                    style={{ borderBottom: '1px solid #eef2f6' }}
                    onClick={() => setActiveAnalysis(analysis)}
                  >
                    <span className="bz-badge bz-badge-blue">
                      {ANALYSIS_TYPE_LABEL[analysis.type] ?? analysis.type}
                    </span>
                    <span className="flex-1 text-[13px] text-[var(--bz-text)] truncate">
                      {analysis.summary.slice(0, 80)}
                    </span>
                    <span className="text-[11px] text-[var(--bz-text-muted)] shrink-0">
                      {new Date(analysis.created_at).toLocaleDateString('zh-CN')}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* 右信息栏 30% */}
        <div style={{ flexBasis: '30%', flexShrink: 0 }} className="flex flex-col gap-4">
          <div className="bz-card" style={{ borderRadius: 8 }}>
            <div className="bz-card-head">
              <span className="bz-card-title">分析操作</span>
            </div>
            <div className="p-3 flex flex-col gap-2">
              {ANALYSIS_ACTIONS.map((action) => {
                const Icon = action.icon;
                const isAnalyzing = analyzing === action.type;
                return (
                  <button
                    key={action.type}
                    className="rounded border px-3 py-3 text-left transition-colors hover:border-[var(--bz-brand)] disabled:opacity-50"
                    style={{ borderColor: 'var(--bz-line)', borderRadius: 6 }}
                    onClick={() => handleAnalyze(action.type)}
                    disabled={analyzing !== null}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      {isAnalyzing ? (
                        <Loader2 className="h-4 w-4 animate-spin" style={{ color: action.color }} />
                      ) : (
                        <Icon className="h-4 w-4" style={{ color: action.color }} />
                      )}
                      <span className="text-[13px] font-medium text-[var(--bz-text)]">
                        {action.label}
                      </span>
                    </div>
                    <p className="text-[12px] text-[var(--bz-text-muted)] leading-relaxed">
                      {action.description}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>

          <ServiceMatchPanel enterpriseId={enterpriseId} />
        </div>
      </div>
    </div>
  );
}