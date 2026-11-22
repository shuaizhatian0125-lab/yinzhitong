import * as React from 'react';

type GradientHeroMetric = {
  label: string;
  value: string | number;
  color?: string;
};

export type GradientHeroProps = {
  title: string;
  subtitle?: string;
  metrics?: GradientHeroMetric[];
  actions?: React.ReactNode;
};

export function GradientHero({ title, subtitle, metrics, actions }: GradientHeroProps) {
  return (
    <div
      className="relative overflow-hidden rounded-[8px] px-8 py-7 mb-5"
      style={{
        background: 'linear-gradient(135deg, #cc0000 0%, #e02b2b 100%)',
        boxShadow: '0 4px 24px rgba(204, 0, 0, 0.12)',
      }}
    >
      <div
        className="absolute -right-20 -top-20 w-60 h-60 rounded-full"
        style={{ background: 'radial-gradient(circle, rgba(176,138,74,0.15) 0%, transparent 70%)' }}
      />
      <div
        className="absolute -right-10 bottom-0 w-40 h-40 rounded-full"
        style={{ background: 'radial-gradient(circle, rgba(224, 43, 43,0.3) 0%, transparent 70%)' }}
      />

      <div className="relative flex items-end justify-between gap-4">
        <div className="flex flex-col gap-2">
          <h1 className="text-[22px] font-semibold text-white leading-tight">{title}</h1>
          {subtitle && (
            <p className="text-[14px] text-white/70 leading-relaxed">{subtitle}</p>
          )}
        </div>

        {metrics && metrics.length > 0 && (
          <div className="flex items-center gap-6 shrink-0">
            {metrics.map((metric) => (
              <div key={metric.label} className="flex flex-col items-end gap-1">
                <span className="text-[13px] text-white/50">{metric.label}</span>
                <span
                  className="text-[24px] font-semibold tabular-nums"
                  style={{ color: metric.color ?? '#fff' }}
                >
                  {metric.value}
                </span>
              </div>
            ))}
          </div>
        )}

        {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
      </div>
    </div>
  );
}