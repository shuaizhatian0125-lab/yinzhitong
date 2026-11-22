type StatsSummaryItem = {
  label: string;
  value: string | number;
  color?: string;
};

export type StatsSummaryBarProps = {
  stats: StatsSummaryItem[];
};

export function StatsSummaryBar({ stats }: StatsSummaryBarProps) {
  if (!stats || stats.length === 0) return null;

  return (
    <div className="flex gap-3 mb-5">
      {stats.map((stat) => (
        <div
          key={stat.label}
          className="bz-card flex-1 rounded-[6px] px-4 py-3"
          style={{ boxShadow: '0 1px 4px rgba(0, 0, 0, 0.03)' }}
        >
          <div className="text-[13px] text-[var(--bz-text-muted)]">{stat.label}</div>
          <div
            className="text-[20px] font-semibold tabular-nums mt-1"
            style={{ color: stat.color ?? 'var(--bz-text)' }}
          >
            {stat.value}
          </div>
        </div>
      ))}
    </div>
  );
}