'use client';

import * as React from 'react';
import { GradientHero } from '@/components/domain/GradientHero';
import { Loader2, Users, Megaphone, BarChart3 } from 'lucide-react';

type SegmentItem = {
  id: string;
  name: string;
  definition: Record<string, unknown>;
  size_estimate: number | null;
  created_at: string;
};

type CampaignItem = {
  id: string;
  name: string;
  segment_id: string | null;
  objective: string | null;
  channel: string | null;
  start_at: string | null;
  end_at: string | null;
  status: string;
  budget: number | null;
};

type SegmentAnalysisData = {
  segmentId: string;
  segmentName: string;
  sizeEstimate: number | null;
  characteristics: string[];
  financialNeeds: string[];
  riskProfile: string;
  recommendedProducts: string[];
  recommendedChannels: string[];
  engagementStrategy: string;
};

type CampaignEffectData = {
  campaignId: string;
  campaignName: string;
  status: string;
  metrics: Array<{ metric: string; value: number; captured_at: string }>;
  summary: string;
  reachAnalysis: string;
  conversionAnalysis: string;
  roiAnalysis: string;
  recommendations: string[];
};

const CAMPAIGN_STATUS_VARIANT: Record<string, string> = {
  draft: 'bz-badge-gray',
  active: 'bz-badge-ok',
  completed: 'bz-badge-blue',
  paused: 'bz-badge-warn',
};

const CAMPAIGN_STATUS_LABEL: Record<string, string> = {
  draft: '草稿',
  active: '进行中',
  completed: '已完成',
  paused: '已暂停',
};

const TABS = [
  { key: 'segments', label: '客群分析', icon: Users },
  { key: 'campaigns', label: '营销活动', icon: Megaphone },
] as const;

type TabKey = (typeof TABS)[number]['key'];

export default function MarketingPage() {
  const [activeTab, setActiveTab] = React.useState<TabKey>('segments');
  const [segments, setSegments] = React.useState<SegmentItem[]>([]);
  const [campaigns, setCampaigns] = React.useState<CampaignItem[]>([]);
  const [loadingSegments, setLoadingSegments] = React.useState(true);
  const [loadingCampaigns, setLoadingCampaigns] = React.useState(true);
  const [segmentAnalysis, setSegmentAnalysis] = React.useState<SegmentAnalysisData | null>(null);
  const [analyzingSegment, setAnalyzingSegment] = React.useState<string | null>(null);
  const [campaignEffect, setCampaignEffect] = React.useState<CampaignEffectData | null>(null);
  const [analyzingCampaign, setAnalyzingCampaign] = React.useState<string | null>(null);

  const fetchSegments = React.useCallback(async () => {
    setLoadingSegments(true);
    try {
      const res = await fetch('/api/v1/marketing/segments');
      const json = await res.json();
      if (json.code === 0 && json.data) {
        setSegments(json.data.items ?? []);
      }
    } catch {
      setSegments([]);
    } finally {
      setLoadingSegments(false);
    }
  }, []);

  const fetchCampaigns = React.useCallback(async () => {
    setLoadingCampaigns(true);
    try {
      const res = await fetch('/api/v1/marketing/campaigns');
      const json = await res.json();
      if (json.code === 0 && json.data) {
        setCampaigns(json.data.items ?? []);
      }
    } catch {
      setCampaigns([]);
    } finally {
      setLoadingCampaigns(false);
    }
  }, []);

  React.useEffect(() => {
    fetchSegments();
    fetchCampaigns();
  }, [fetchSegments, fetchCampaigns]);

  const handleAnalyzeSegment = async (segmentId: string) => {
    setAnalyzingSegment(segmentId);
    setSegmentAnalysis(null);
    try {
      const res = await fetch(`/api/v1/marketing/segments/${segmentId}/analyze`, {
        method: 'POST',
      });
      const json = await res.json();
      if (json.code === 0 && json.data) {
        setSegmentAnalysis(json.data);
      }
    } catch {
      // ignore
    } finally {
      setAnalyzingSegment(null);
    }
  };

  const handleAnalyzeCampaign = async (campaignId: string) => {
    setAnalyzingCampaign(campaignId);
    setCampaignEffect(null);
    try {
      const res = await fetch(`/api/v1/marketing/campaigns/${campaignId}/effect`, {
        method: 'POST',
      });
      const json = await res.json();
      if (json.code === 0 && json.data) {
        setCampaignEffect(json.data);
      }
    } catch {
      // ignore
    } finally {
      setAnalyzingCampaign(null);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <GradientHero title="营销中心" subtitle="客户洞察、精准营销、活动管理、效果分析" />

      {/* Tab 切换 */}
      <div className="flex gap-1">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              className={`rounded px-4 py-2 text-[13px] font-medium transition-colors flex items-center gap-2 ${
                isActive ? 'text-[var(--bz-brand)]' : 'text-[var(--bz-text-sub)]'
              }`}
              style={{
                background: isActive ? 'var(--bz-brand-tint)' : 'transparent',
                borderRadius: 6,
              }}
              onClick={() => setActiveTab(tab.key)}
            >
              <Icon className="h-4 w-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {activeTab === 'segments' && (
        <div className="flex gap-4">
          {/* 左侧客群列表 */}
          <div style={{ flexBasis: '35%', flexShrink: 0 }}>
            <div className="bz-card" style={{ borderRadius: 6 }}>
              <div className="bz-card-head">
                <span className="bz-card-title">客群列表</span>
                <span className="text-[12px] text-[var(--bz-text-muted)]">{segments.length} 个客群</span>
              </div>
              <div className="p-3">
                {loadingSegments && (
                  <div className="text-center py-8">
                    <Loader2 className="h-5 w-5 animate-spin text-[var(--bz-text-muted)] mx-auto" />
                  </div>
                )}
                {!loadingSegments && segments.length === 0 && (
                  <p className="text-center text-[var(--bz-text-muted)] py-8">暂无客群数据</p>
                )}
                {!loadingSegments && segments.map((segment) => (
                  <div
                    key={segment.id}
                    className="flex items-center gap-3 px-3 py-2.5 rounded transition-colors hover:bg-[#fafcfe] cursor-pointer"
                    style={{ borderBottom: '1px solid #eef2f6' }}
                    onClick={() => handleAnalyzeSegment(segment.id)}
                  >
                    <div className="flex-1">
                      <span className="text-[14px] font-medium text-[var(--bz-text)]">{segment.name}</span>
                      {segment.size_estimate !== null && (
                        <span className="text-[12px] text-[var(--bz-text-muted)] ml-2">
                          约 {segment.size_estimate} 人
                        </span>
                      )}
                    </div>
                    {analyzingSegment === segment.id ? (
                      <Loader2 className="h-4 w-4 animate-spin text-[var(--bz-brand)]" />
                    ) : (
                      <span className="bz-badge bz-badge-blue" style={{ fontSize: 11 }}>分析</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* 右侧分析结果 */}
          <div className="flex-1" style={{ flexBasis: '65%' }}>
            {!segmentAnalysis ? (
              <div className="bz-card" style={{ borderRadius: 6 }}>
                <div className="p-8 text-center">
                  <Users className="h-8 w-8 text-[var(--bz-text-muted)] mx-auto mb-3" />
                  <p className="text-[var(--bz-text-muted)]">选择左侧客群进行深度分析</p>
                </div>
              </div>
            ) : (
              <div className="bz-card" style={{ borderRadius: 6 }}>
                <div className="bz-card-head">
                  <span className="bz-card-title">{segmentAnalysis.segmentName} - 客群分析</span>
                  {segmentAnalysis.sizeEstimate !== null && (
                    <span className="text-[12px] text-[var(--bz-text-muted)]">
                      约 {segmentAnalysis.sizeEstimate} 人
                    </span>
                  )}
                </div>
                <div className="p-4 flex flex-col gap-4">
                  <div>
                    <span className="text-[13px] font-medium text-[var(--bz-text)] block mb-2">客群特征</span>
                    <div className="flex flex-wrap gap-1">
                      {segmentAnalysis.characteristics.map((c, idx) => (
                        <span key={idx} className="bz-badge bz-badge-blue">{c}</span>
                      ))}
                    </div>
                  </div>
                  <div>
                    <span className="text-[13px] font-medium text-[var(--bz-text)] block mb-2">金融需求</span>
                    <ul className="flex flex-col gap-1">
                      {segmentAnalysis.financialNeeds.map((need, idx) => (
                        <li key={idx} className="text-[13px] text-[var(--bz-text-sub)] flex items-start gap-2">
                          <span className="text-[var(--bz-brand)] mt-0.5">•</span>
                          {need}
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <span className="text-[13px] font-medium text-[var(--bz-text)] block mb-2">风险画像</span>
                    <p className="text-[13px] text-[var(--bz-text-sub)]">{segmentAnalysis.riskProfile}</p>
                  </div>
                  <div>
                    <span className="text-[13px] font-medium text-[var(--bz-text)] block mb-2">推荐产品</span>
                    <div className="flex flex-wrap gap-1">
                      {segmentAnalysis.recommendedProducts.map((p, idx) => (
                        <span key={idx} className="bz-badge bz-badge-blue">{p}</span>
                      ))}
                    </div>
                  </div>
                  <div>
                    <span className="text-[13px] font-medium text-[var(--bz-text)] block mb-2">推荐渠道</span>
                    <div className="flex flex-wrap gap-1">
                      {segmentAnalysis.recommendedChannels.map((ch, idx) => (
                        <span key={idx} className="bz-badge bz-badge-gray">{ch}</span>
                      ))}
                    </div>
                  </div>
                  <div>
                    <span className="text-[13px] font-medium text-[var(--bz-text)] block mb-2">经营策略</span>
                    <p className="text-[13px] text-[var(--bz-text-sub)]">{segmentAnalysis.engagementStrategy}</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'campaigns' && (
        <div className="flex gap-4">
          {/* 左侧活动列表 */}
          <div style={{ flexBasis: '35%', flexShrink: 0 }}>
            <div className="bz-card" style={{ borderRadius: 6 }}>
              <div className="bz-card-head">
                <span className="bz-card-title">营销活动</span>
                <span className="text-[12px] text-[var(--bz-text-muted)]">{campaigns.length} 个活动</span>
              </div>
              <div className="p-3">
                {loadingCampaigns && (
                  <div className="text-center py-8">
                    <Loader2 className="h-5 w-5 animate-spin text-[var(--bz-text-muted)] mx-auto" />
                  </div>
                )}
                {!loadingCampaigns && campaigns.length === 0 && (
                  <p className="text-center text-[var(--bz-text-muted)] py-8">暂无营销活动</p>
                )}
                {!loadingCampaigns && campaigns.map((campaign) => (
                  <div
                    key={campaign.id}
                    className="flex items-center gap-3 px-3 py-2.5 rounded transition-colors hover:bg-[#fafcfe] cursor-pointer"
                    style={{ borderBottom: '1px solid #eef2f6' }}
                    onClick={() => handleAnalyzeCampaign(campaign.id)}
                  >
                    <div className="flex-1">
                      <span className="text-[14px] font-medium text-[var(--bz-text)]">{campaign.name}</span>
                      <span className={`bz-badge ${CAMPAIGN_STATUS_VARIANT[campaign.status] ?? 'bz-badge-gray'} ml-2`} style={{ fontSize: 11 }}>
                        {CAMPAIGN_STATUS_LABEL[campaign.status] ?? campaign.status}
                      </span>
                    </div>
                    {analyzingCampaign === campaign.id ? (
                      <Loader2 className="h-4 w-4 animate-spin text-[var(--bz-brand)]" />
                    ) : (
                      <BarChart3 className="h-4 w-4 text-[var(--bz-text-muted)]" />
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* 右侧效果分析 */}
          <div className="flex-1" style={{ flexBasis: '65%' }}>
            {!campaignEffect ? (
              <div className="bz-card" style={{ borderRadius: 6 }}>
                <div className="p-8 text-center">
                  <Megaphone className="h-8 w-8 text-[var(--bz-text-muted)] mx-auto mb-3" />
                  <p className="text-[var(--bz-text-muted)]">选择左侧活动查看效果分析</p>
                </div>
              </div>
            ) : (
              <div className="bz-card" style={{ borderRadius: 6 }}>
                <div className="bz-card-head">
                  <span className="bz-card-title">{campaignEffect.campaignName} - 效果分析</span>
                  <span className={`bz-badge ${CAMPAIGN_STATUS_VARIANT[campaignEffect.status] ?? 'bz-badge-gray'}`}>
                    {CAMPAIGN_STATUS_LABEL[campaignEffect.status] ?? campaignEffect.status}
                  </span>
                </div>
                <div className="p-4 flex flex-col gap-4">
                  <div>
                    <span className="text-[13px] font-medium text-[var(--bz-text)] block mb-2">总体概述</span>
                    <p className="text-[13px] text-[var(--bz-text-sub)]">{campaignEffect.summary}</p>
                  </div>

                  {campaignEffect.metrics.length > 0 && (
                    <div>
                      <span className="text-[13px] font-medium text-[var(--bz-text)] block mb-2">指标数据</span>
                      <div className="grid grid-cols-3 gap-2">
                        {campaignEffect.metrics.map((m, idx) => (
                          <div
                            key={idx}
                            className="rounded px-3 py-2"
                            style={{ background: 'var(--bz-brand-tint)', borderRadius: 6 }}
                          >
                            <span className="text-[12px] text-[var(--bz-text-sub)]">{m.metric}</span>
                            <p className="text-[14px] text-[var(--bz-text)] mt-0.5">{m.value}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div>
                    <span className="text-[13px] font-medium text-[var(--bz-text)] block mb-2">触达分析</span>
                    <p className="text-[13px] text-[var(--bz-text-sub)]">{campaignEffect.reachAnalysis}</p>
                  </div>
                  <div>
                    <span className="text-[13px] font-medium text-[var(--bz-text)] block mb-2">转化分析</span>
                    <p className="text-[13px] text-[var(--bz-text-sub)]">{campaignEffect.conversionAnalysis}</p>
                  </div>
                  <div>
                    <span className="text-[13px] font-medium text-[var(--bz-text)] block mb-2">ROI分析</span>
                    <p className="text-[13px] text-[var(--bz-text-sub)]">{campaignEffect.roiAnalysis}</p>
                  </div>
                  <div>
                    <span className="text-[13px] font-medium text-[var(--bz-text)] block mb-2">优化建议</span>
                    <ul className="flex flex-col gap-1">
                      {campaignEffect.recommendations.map((rec, idx) => (
                        <li key={idx} className="text-[13px] text-[var(--bz-text-sub)] flex items-start gap-2">
                          <span className="text-[var(--bz-ok)] mt-0.5">✓</span>
                          {rec}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}