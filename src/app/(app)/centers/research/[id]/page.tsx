'use client';

import * as React from 'react';
import { useRouter, useParams } from 'next/navigation';
import { ArrowLeft, Loader2, FileText, Building2, TrendingUp, Shield, Link2, Cpu, AlertTriangle, MapPin } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';

type IndustryDetail = {
  row: {
    id: string;
    name: string;
    code: string | null;
    level: number;
    description: string | null;
  };
  profile: {
    trends: string;
    policy: string;
    scale: string;
    supplyChain: string;
    competition: string;
    technology: string;
    risk: string;
    opportunity: string;
  };
  enterprises: Array<{
    id: string;
    name: string;
    industry: string | null;
    region: string | null;
    level: string | null;
  }>;
};

type KeyFinding = {
  finding: string;
  level: 'verified_fact' | 'source_data' | 'ai_analysis' | 'speculation' | 'suggestion';
  source: string;
};

const FINDING_LEVEL_VARIANT: Record<string, string> = {
  verified_fact: 'bz-badge-ok',
  source_data: 'bz-badge-blue',
  ai_analysis: 'bz-badge-gold',
  speculation: 'bz-badge-warn',
  suggestion: 'bz-badge-gray',
};

const FINDING_LEVEL_LABEL: Record<string, string> = {
  verified_fact: '已验证事实',
  source_data: '来源数据',
  ai_analysis: 'AI分析',
  speculation: '推测',
  suggestion: '建议',
};

const PROFILE_DIMENSIONS = [
  { key: 'trends', label: '行业趋势', icon: TrendingUp },
  { key: 'policy', label: '政策环境', icon: Shield },
  { key: 'scale', label: '行业规模', icon: MapPin },
  { key: 'supplyChain', label: '产业链', icon: Link2 },
  { key: 'competition', label: '竞争格局', icon: Building2 },
  { key: 'technology', label: '技术发展', icon: Cpu },
  { key: 'risk', label: '风险因素', icon: AlertTriangle },
  { key: 'opportunity', label: '机会识别', icon: FileText },
] as const;

function isPending(value: string): boolean {
  return value === '待补充';
}

export default function ResearchDetailPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const industryId = params.id;

  const [detail, setDetail] = React.useState<IndustryDetail | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [generating, setGenerating] = React.useState(false);
  const [report, setReport] = React.useState<{
    title: string;
    content: string;
    keyFindings: KeyFinding[];
  } | null>(null);

  const fetchDetail = React.useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/v1/industries/${industryId}`);
      const json = await res.json();
      if (json.code === 0 && json.data) {
        setDetail(json.data);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [industryId]);

  React.useEffect(() => {
    fetchDetail();
  }, [fetchDetail]);

  const handleGenerateReport = async () => {
    setGenerating(true);
    try {
      const res = await fetch(`/api/v1/industries/${industryId}/research`, {
        method: 'POST',
      });
      const json = await res.json();
      if (json.code === 0 && json.data) {
        setReport({
          title: json.data.title,
          content: json.data.content,
          keyFindings: json.data.keyFindings ?? [],
        });
      }
    } catch {
      // ignore
    } finally {
      setGenerating(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-[var(--bz-text-muted)]" />
      </div>
    );
  }

  if (!detail) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3">
        <p className="text-[var(--bz-text-muted)]">行业不存在</p>
        <button className="bz-btn bz-btn-default" onClick={() => router.push('/centers/research')}>
          返回行业列表
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <button
          className="bz-btn bz-btn-ghost"
          onClick={() => router.push('/centers/research')}
        >
          <ArrowLeft className="h-4 w-4" />
          返回列表
        </button>
      </div>

      <PageHeader title={detail.row.name} description={`行业代码: ${detail.row.code ?? '待补充'} · 层级: L${detail.row.level}`} />

      {/* 行业画像 */}
      <div className="grid grid-cols-2 gap-3">
        {PROFILE_DIMENSIONS.map((dim) => {
          const Icon = dim.icon;
          const value = detail.profile[dim.key];
          const pending = isPending(value);
          return (
            <div key={dim.key} className="bz-card" style={{ borderRadius: 8 }}>
              <div className="flex items-center gap-2 px-4 pt-3 pb-2">
                <Icon className="h-4 w-4 shrink-0" style={{ color: pending ? 'var(--bz-text-muted)' : 'var(--bz-brand)' }} />
                <span className="text-[13px] font-medium text-[var(--bz-text)]">{dim.label}</span>
              </div>
              <div className="px-4 pb-3">
                <p className={`text-[13px] leading-relaxed ${pending ? 'text-[var(--bz-text-muted)] italic' : 'text-[var(--bz-text-sub)]'}`}>
                  {value}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      {/* 研究报告 */}
      <div className="bz-card" style={{ borderRadius: 8 }}>
        <div className="bz-card-head">
          <span className="bz-card-title">行业研究报告</span>
          <button
            className="bz-btn bz-btn-primary text-[12px]"
            onClick={handleGenerateReport}
            disabled={generating}
          >
            {generating ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                生成中…
              </>
            ) : (
              <>
                <FileText className="h-3.5 w-3.5" />
                生成报告
              </>
            )}
          </button>
        </div>
        <div className="p-4">
          {!report && !generating && (
            <p className="text-[var(--bz-text-muted)] text-center py-6">
              点击"生成报告"按钮，AI将基于行业信息生成研究报告
            </p>
          )}
          {generating && (
            <div className="flex items-center justify-center py-6">
              <Loader2 className="h-5 w-5 animate-spin text-[var(--bz-text-muted)]" />
              <span className="ml-2 text-[var(--bz-text-muted)]">正在生成研究报告…</span>
            </div>
          )}
          {report && (
            <div className="flex flex-col gap-4">
              <h3 className="text-[16px] font-semibold text-[var(--bz-text)]">{report.title}</h3>

              {report.keyFindings.length > 0 && (
                <div>
                  <span className="text-[12px] font-medium text-[var(--bz-text-sub)] mb-2 block">关键发现</span>
                  <div className="flex flex-col gap-2">
                    {report.keyFindings.map((finding, idx) => (
                      <div
                        key={idx}
                        className="rounded px-3 py-2"
                        style={{ background: '#fafbfd', borderRadius: 6 }}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-[13px] text-[var(--bz-text)]">{finding.finding}</span>
                          <span className={`bz-badge ${FINDING_LEVEL_VARIANT[finding.level] ?? 'bz-badge-gray'}`} style={{ fontSize: 11 }}>
                            {FINDING_LEVEL_LABEL[finding.level] ?? finding.level}
                          </span>
                        </div>
                        <span className="text-[11px] text-[var(--bz-text-muted)]">来源: {finding.source}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <span className="text-[12px] font-medium text-[var(--bz-text-sub)] mb-2 block">报告正文</span>
                <div className="rounded px-4 py-3" style={{ background: '#fafbfd', borderRadius: 6 }}>
                  <p className="text-[13px] text-[var(--bz-text)] leading-relaxed whitespace-pre-wrap">
                    {report.content}
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 关联企业 */}
      {detail.enterprises && detail.enterprises.length > 0 && (
        <div className="bz-card" style={{ borderRadius: 8 }}>
          <div className="bz-card-head">
            <span className="bz-card-title">产业链关键企业</span>
            <span className="text-[12px] text-[var(--bz-text-muted)]">{detail.enterprises.length} 家</span>
          </div>
          <div className="bz-scroll">
            <table className="bz-table">
              <thead>
                <tr>
                  <th>企业名称</th>
                  <th>所属行业</th>
                  <th>所在区域</th>
                  <th>企业等级</th>
                </tr>
              </thead>
              <tbody>
                {detail.enterprises.map((ent) => (
                  <tr
                    key={ent.id}
                    className="cursor-pointer"
                    onClick={() => router.push(`/centers/enterprise/${ent.id}`)}
                  >
                    <td className="font-medium text-[var(--bz-text)]">{ent.name}</td>
                    <td>{ent.industry ?? '待补充'}</td>
                    <td>{ent.region ?? '待补充'}</td>
                    <td>{ent.level ?? '待补充'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}