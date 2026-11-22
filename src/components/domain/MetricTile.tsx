import * as React from 'react';

export type MetricTileProps = {
  label: string;
  value: number | string;
  unit?: string;
  trend?: number;
  trendLabel?: string;
  isMock?: boolean;
  variant?: 'default' | 'ok' | 'warn' | 'danger';
};

const VARIANT_ACCENT: Record<string, string> = {
  default: 'var(--bz-brand)',
  ok: 'var(--bz-ok)',
  warn: 'var(--bz-warn)',
  danger: 'var(--bz-danger)',
};

export function MetricTile({
  label,
  value,
  unit,
  trend,
  trendLabel,
  isMock = false,
  variant = 'default',
}: MetricTileProps) {
  const accentColor = VARIANT_ACCENT[variant] ?? VARIANT_ACCENT['default'];
  const trendColor = trend !== undefined && trend > 0 ? 'var(--bz-ok)' : trend !== undefined && trend < 0 ? 'var(--bz-danger)' : 'var(--bz-text-muted)';

  return (
    <div className="bz-kpi bz-shadow-soft" style={{ borderRadius: 6, position: 'relative' }}>
      <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 3, background: accentColor }} />
      {isMock && (
        <span
          className="bz-badge bz-badge-gold"
          style={{ position: 'absolute', right: 8, top: 8, fontSize: 10, height: 18, padding: '0 6px' }}
        >
          模拟数据
        </span>
      )}
      <div className="bz-kpi-label">{label}</div>
      <div className="bz-kpi-value">
        {typeof value === 'number' ? value.toLocaleString('zh-CN') : value}
        {unit && <span className="text-[14px] font-normal text-[var(--bz-text-muted)] ml-1">{unit}</span>}
      </div>
      {trend !== undefined && trendLabel && (
        <div className="bz-kpi-sub flex items-center gap-1">
          <span style={{ color: trendColor }}>
            {trend > 0 ? '↑' : trend < 0 ? '↓' : '—'} {Math.abs(trend)}%
          </span>
          <span>{trendLabel}</span>
        </div>
      )}
    </div>
  );
}