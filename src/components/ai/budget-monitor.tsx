'use client';

import * as React from 'react';
import { Coins, Wrench, ListChecks, Clock, AlertTriangle } from 'lucide-react';

type BudgetMonitorProps = {
  tokenUsed: number;
  tokenBudget: number;
  toolCallsUsed: number;
  toolCallsBudget: number;
  stepsUsed: number;
  stepsBudget: number;
  timeElapsedMs: number;
  timeBudgetMs: number;
  className?: string;
};

function formatToken(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return `${n}`;
}

function formatTime(ms: number): string {
  if (ms >= 60000) return `${Math.round(ms / 60000)}min`;
  if (ms >= 1000) return `${(ms / 1000).toFixed(0)}s`;
  return `${ms}ms`;
}

function getUsagePercent(used: number, budget: number): number {
  if (budget <= 0) return 0;
  return Math.min(100, Math.round((used / budget) * 100));
}

function getUsageColor(percent: number): string {
  if (percent >= 90) return 'var(--bz-danger)';
  if (percent >= 70) return 'var(--bz-warn)';
  return 'var(--bz-ok)';
}

type BudgetItem = {
  icon: React.ReactNode;
  label: string;
  used: number;
  budget: number;
  formatFn: (n: number) => string;
};

export function BudgetMonitor({
  tokenUsed,
  tokenBudget,
  toolCallsUsed,
  toolCallsBudget,
  stepsUsed,
  stepsBudget,
  timeElapsedMs,
  timeBudgetMs,
  className,
}: BudgetMonitorProps) {
  const items: BudgetItem[] = [
    { icon: <Coins className="h-3.5 w-3.5" />, label: 'Token', used: tokenUsed, budget: tokenBudget, formatFn: formatToken },
    { icon: <Wrench className="h-3.5 w-3.5" />, label: '工具', used: toolCallsUsed, budget: toolCallsBudget, formatFn: (n) => `${n}` },
    { icon: <ListChecks className="h-3.5 w-3.5" />, label: '步骤', used: stepsUsed, budget: stepsBudget, formatFn: (n) => `${n}` },
    { icon: <Clock className="h-3.5 w-3.5" />, label: '时间', used: timeElapsedMs, budget: timeBudgetMs, formatFn: formatTime },
  ];

  const overBudget = items.some((item) => item.used >= item.budget && item.budget > 0);

  return (
    <div
      className={`rounded-[4px] border px-3 py-2 ${className ?? ''}`}
      style={{
        borderColor: overBudget ? 'var(--bz-danger)' : 'var(--bz-border)',
        background: overBudget ? '#fef2f2' : 'var(--bz-card)',
      }}
    >
      {overBudget && (
        <div className="flex items-center gap-1 mb-2 text-[12px]" style={{ color: 'var(--bz-danger)' }}>
          <AlertTriangle className="h-3.5 w-3.5" />
          预算超限，建议暂停执行
        </div>
      )}

      <div className="grid grid-cols-4 gap-2">
        {items.map((item) => {
          const percent = getUsagePercent(item.used, item.budget);
          const color = getUsageColor(percent);

          return (
            <div key={item.label}>
              <div className="flex items-center gap-1 mb-1">
                <span style={{ color: 'var(--bz-text-sub)' }}>{item.icon}</span>
                <span className="text-[11px] text-[var(--bz-text-sub)]">{item.label}</span>
              </div>
              <div className="text-[12px] font-medium text-[var(--bz-text)] mb-1">
                {item.formatFn(item.used)} / {item.formatFn(item.budget)}
              </div>
              <div className="h-1 rounded-full overflow-hidden" style={{ background: 'var(--bz-border)' }}>
                <div
                  className="h-full rounded-full transition-all"
                  style={{ width: `${percent}%`, background: color }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}