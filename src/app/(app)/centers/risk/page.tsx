'use client';

import * as React from 'react';
import { Loader2 } from 'lucide-react';
import { GradientHero } from '@/components/domain/GradientHero';
import { RiskAlert, type RiskAlertData } from '@/components/domain/RiskAlert';

const SEVERITY_OPTIONS = [
  { value: '', label: '全部严重度' },
  { value: 'low', label: '低' },
  { value: 'medium', label: '中' },
  { value: 'high', label: '高' },
  { value: 'critical', label: '严重' },
];

const STATUS_OPTIONS = [
  { value: '', label: '全部状态' },
  { value: 'open', label: '待处置' },
  { value: 'acknowledged', label: '已认领' },
  { value: 'resolved', label: '已闭环' },
  { value: 'false_positive', label: '误报' },
];

const TYPE_OPTIONS = [
  { value: '', label: '全部类型' },
  { value: 'task_overdue', label: '任务逾期' },
  { value: 'work_anomaly', label: '工作异常' },
  { value: 'enterprise_risk', label: '企业风险' },
  { value: 'industry_risk', label: '行业风险' },
  { value: 'info_change', label: '信息变更' },
];

export default function RiskListPage() {
  const [items, setItems] = React.useState<RiskAlertData[]>([]);
  const [total, setTotal] = React.useState(0);
  const [loading, setLoading] = React.useState(true);
  const [severity, setSeverity] = React.useState('');
  const [status, setStatus] = React.useState('');
  const [type, setType] = React.useState('');

  const fetchAlerts = React.useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (severity) params.set('severity', severity);
      if (status) params.set('status', status);
      if (type) params.set('type', type);

      const res = await fetch(`/api/v1/risk/alerts?${params.toString()}`);
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
  }, [severity, status, type]);

  React.useEffect(() => {
    fetchAlerts();
  }, [fetchAlerts]);

  const handleAck = async (alertId: string) => {
    try {
      const res = await fetch(`/api/v1/risk/alerts/${alertId}/ack`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'ack' }),
      });
      const json = await res.json();
      if (json.code === 0) {
        fetchAlerts();
      }
    } catch {
      // ignore
    }
  };

  const handleResolve = async (alertId: string, resolution: string) => {
    try {
      const res = await fetch(`/api/v1/risk/alerts/${alertId}/ack`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'resolve', resolution }),
      });
      const json = await res.json();
      if (json.code === 0) {
        fetchAlerts();
      }
    } catch {
      // ignore
    }
  };

  const handleMarkFalsePositive = async (alertId: string, reason: string) => {
    try {
      const res = await fetch(`/api/v1/risk/alerts/${alertId}/ack`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'false_positive', reason }),
      });
      const json = await res.json();
      if (json.code === 0) {
        fetchAlerts();
      }
    } catch {
      // ignore
    }
  };

  const openCount = items.filter((i) => i.status === 'open').length;
  const criticalCount = items.filter((i) => i.severity === 'critical').length;

  return (
    <div className="flex flex-col gap-4 md:gap-6">
      <GradientHero title="风险预警中心" subtitle="任务逾期、工作异常、企业风险、行业风险、信息变更预警" />

      <div className="flex gap-2 md:gap-3">
        <div className="bz-card flex-1" style={{ borderRadius: 6, padding: '10px 14px' }}>
          <span className="text-[12px] text-[var(--bz-text-muted)]">待处置</span>
          <p className="text-[18px] md:text-[20px] font-semibold text-[var(--bz-warn)]">{openCount}</p>
        </div>
        <div className="bz-card flex-1" style={{ borderRadius: 6, padding: '10px 14px' }}>
          <span className="text-[12px] text-[var(--bz-text-muted)]">严重预警</span>
          <p className="text-[18px] md:text-[20px] font-semibold text-[var(--bz-danger)]">{criticalCount}</p>
        </div>
        <div className="bz-card flex-1" style={{ borderRadius: 6, padding: '10px 14px' }}>
          <span className="text-[12px] text-[var(--bz-text-muted)]">总计</span>
          <p className="text-[18px] md:text-[20px] font-semibold text-[var(--bz-text)]">{total}</p>
        </div>
      </div>

      <div className="flex flex-col gap-2 md:flex-row md:items-center md:gap-3 md:flex-wrap">
        <select
          className="text-[13px] px-3 py-2 md:py-1.5 rounded border min-h-[44px]"
          style={{ borderColor: 'var(--bz-line)', borderRadius: 6 }}
          value={severity}
          onChange={(e) => setSeverity(e.target.value)}
        >
          {SEVERITY_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>

        <select
          className="text-[13px] px-3 py-2 md:py-1.5 rounded border min-h-[44px]"
          style={{ borderColor: 'var(--bz-line)', borderRadius: 6 }}
          value={status}
          onChange={(e) => setStatus(e.target.value)}
        >
          {STATUS_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>

        <select
          className="text-[13px] px-3 py-2 md:py-1.5 rounded border min-h-[44px]"
          style={{ borderColor: 'var(--bz-line)', borderRadius: 6 }}
          value={type}
          onChange={(e) => setType(e.target.value)}
        >
          {TYPE_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      </div>

      {loading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-5 w-5 animate-spin text-[var(--bz-text-muted)]" />
        </div>
      )}

      {!loading && items.length === 0 && (
        <div className="text-center text-[var(--bz-text-muted)] py-12">
          暂无风险预警
        </div>
      )}

      {!loading && items.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {items.map((alert) => (
            <RiskAlert
              key={alert.id}
              alert={alert}
              onAck={handleAck}
              onResolve={handleResolve}
              onMarkFalsePositive={handleMarkFalsePositive}
            />
          ))}
        </div>
      )}
    </div>
  );
}