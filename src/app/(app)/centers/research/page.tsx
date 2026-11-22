'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { StatsSummaryBar } from '@/components/domain/StatsSummaryBar';
import { IndustryCard, type IndustryCardData } from '@/components/domain/IndustryCard';

export default function ResearchListPage() {
  const router = useRouter();
  const [industries, setIndustries] = React.useState<IndustryCardData[]>([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    const fetchIndustries = async () => {
      setLoading(true);
      try {
        const res = await fetch('/api/v1/industries');
        const json = await res.json();
        if (json.code === 0 && json.data) {
          setIndustries(json.data);
        }
      } catch {
        // ignore
      } finally {
        setLoading(false);
      }
    };
    fetchIndustries();
  }, []);

  const handleClick = (id: string) => {
    router.push(`/centers/research/${id}`);
  };

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="行业研究中心" description="行业画像、政策跟踪、同业对比与产业链机会识别" />

      <StatsSummaryBar stats={[{label:'研究报告', value:86}, {label:'进行中', value:12}, {label:'已完成', value:74}]} />

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-[var(--bz-text-muted)]" />
        </div>
      ) : industries.length === 0 ? (
        <div className="bz-card" style={{ borderRadius: 4 }}>
          <div className="p-8 text-center">
            <p className="text-[var(--bz-text-muted)]">暂无行业数据</p>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-3">
          {industries.map((industry) => (
            <IndustryCard
              key={industry.id}
              industry={industry}
              onClick={handleClick}
            />
          ))}
        </div>
      )}
    </div>
  );
}