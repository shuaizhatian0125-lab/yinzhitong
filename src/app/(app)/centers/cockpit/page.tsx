'use client';

import * as React from 'react';
import { Loader2, Download } from 'lucide-react';
import { GradientHero } from '@/components/domain/GradientHero';
import { DashboardView } from '@/components/domain/DashboardView';
import type { DashboardData } from '@/server/modules/cockpit/cockpit-service';

export default function CockpitPage() {
  const [data, setData] = React.useState<DashboardData | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const fetchData = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/v1/cockpit/dashboards/cockpit_main');
      const json = await res.json();
      if (json.code === 0 && json.data) {
        setData(json.data);
      } else if (json.code === 40301) {
        setError('无权限访问管理驾驶舱');
      } else {
        setError(json.message ?? '获取数据失败');
      }
    } catch {
      setError('网络错误，请稍后重试');
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleExport = () => {
    window.print();
  };

  return (
    <div className="flex flex-col gap-6">
      <GradientHero
        title="驾驶舱"
        subtitle="全行运营态势、关键指标监控、智能预警"
        actions={
          <button className="bz-btn bz-btn-default bz-no-print" onClick={handleExport}>
            <Download className="h-4 w-4" />
            导出
          </button>
        }
      />

      {loading && (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-[var(--bz-text-muted)]" />
        </div>
      )}

      {error && (
        <div className="bz-card" style={{ borderRadius: 8 }}>
          <div className="p-8 text-center">
            <p className="text-[var(--bz-danger)]">{error}</p>
          </div>
        </div>
      )}

      {!loading && !error && data && <DashboardView data={data} />}
    </div>
  );
}