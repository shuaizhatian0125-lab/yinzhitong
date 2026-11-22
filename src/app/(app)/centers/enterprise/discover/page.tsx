'use client';

import * as React from 'react';
import { PageHeader } from '@/components/layout/PageHeader';
import { StatsSummaryBar } from '@/components/domain/StatsSummaryBar';
import {
  EnterpriseDiscoveryBar,
  type DiscoveryFilter,
} from '@/components/domain/EnterpriseDiscoveryBar';
import {
  EnterpriseMatchCard,
  type EnterpriseMatchCardData,
} from '@/components/domain/EnterpriseMatchCard';

export default function EnterpriseDiscoverPage() {
  const [items, setItems] = React.useState<EnterpriseMatchCardData[]>([]);
  const [total, setTotal] = React.useState(0);
  const [loading, setLoading] = React.useState(false);
  const [hasSearched, setHasSearched] = React.useState(false);

  const handleDiscover = async (filter: DiscoveryFilter) => {
    setLoading(true);
    setHasSearched(true);
    try {
      const res = await fetch('/api/v1/enterprises/discover', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          industry: filter.industry || undefined,
          region: filter.region || undefined,
          techField: filter.techField || undefined,
          scale: filter.scale || undefined,
          page: 1,
          pageSize: 20,
        }),
      });
      const json = await res.json();
      if (json.code === 0 && json.data) {
        setItems(json.data.items ?? []);
        setTotal(json.data.total ?? 0);
      } else {
        setItems([]);
        setTotal(0);
      }
    } catch {
      setItems([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setItems([]);
    setTotal(0);
    setHasSearched(false);
  };

  return (
    <div className="flex flex-col gap-4 md:gap-6">
      <PageHeader title="企业发现" description="基于行业、区域、技术领域等条件，智能发现匹配的目标企业" />

      <StatsSummaryBar
        stats={[
          { label: '发现结果', value: total },
          { label: '高度匹配', value: items.filter((i) => i.matchScore >= 80).length },
          { label: '较好匹配', value: items.filter((i) => i.matchScore >= 60 && i.matchScore < 80).length },
        ]}
      />

      <EnterpriseDiscoveryBar onDiscover={handleDiscover} onReset={handleReset} loading={loading} />

      {/* 推荐结果列表 */}
      {hasSearched && (
        <div className="bz-card" style={{ borderRadius: 4 }}>
          <div className="bz-card-head">
            <span className="bz-card-title">推荐结果</span>
            <span className="text-[12px] text-[var(--bz-text-muted)]">共 {total} 家匹配企业</span>
          </div>
          <div className="p-4">
            {loading && (
              <div className="text-center text-[var(--bz-text-muted)] py-8">发现中…</div>
            )}
            {!loading && items.length === 0 && (
              <div className="text-center text-[var(--bz-text-muted)] py-8">
                暂无匹配的企业数据，请调整筛选条件后重试
              </div>
            )}
            {!loading && items.length > 0 && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {items.map((item) => (
                  <EnterpriseMatchCard key={item.id} data={item} />
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}