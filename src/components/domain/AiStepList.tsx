'use client';

import * as React from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';

type StepItem = {
  seq: number;
  kind: string;
  description: string;
  toolCode?: string | null;
  status?: string;
};

type AiStepListProps = {
  steps: StepItem[];
  className?: string;
};

const KIND_ICON: Record<string, string> = {
  reasoning: '💭',
  tool_call: '🔧',
  output: '📤',
};

const STATUS_COLOR: Record<string, string> = {
  succeeded: 'var(--bz-ok)',
  failed: 'var(--bz-danger)',
  running: 'var(--bz-info)',
  pending: 'var(--bz-text-muted)',
  skipped: 'var(--bz-text-muted)',
};

export function AiStepList({ steps, className }: AiStepListProps) {
  const [expanded, setExpanded] = React.useState<Set<number>>(new Set());

  const toggle = (seq: number) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(seq)) next.delete(seq);
      else next.add(seq);
      return next;
    });
  };

  if (!steps || steps.length === 0) return null;

  return (
    <div className={className}>
      <div className="flex flex-col gap-1">
        {steps.map((step) => {
          const isExpanded = expanded.has(step.seq);
          const hasDetail = step.toolCode || step.kind === 'tool_call';

          return (
            <div
              key={step.seq}
              className="rounded px-3 py-2"
              style={{
                background: 'var(--bz-bg)',
                borderRadius: 3,
                border: '1px solid var(--bz-line)',
              }}
            >
              <div className="flex items-center gap-2">
                <span
                  className="h-2 w-2 rounded-full shrink-0"
                  style={{ background: STATUS_COLOR[step.status ?? 'pending'] ?? 'var(--bz-text-muted)' }}
                />
                <span className="text-[12px] text-[var(--bz-text-muted)] shrink-0">
                  {KIND_ICON[step.kind] ?? '•'} {step.kind}
                </span>
                <span className="text-[13px] text-[var(--bz-text)] flex-1 truncate">
                  {step.description}
                </span>
                {hasDetail && (
                  <button
                    onClick={() => toggle(step.seq)}
                    className="text-[var(--bz-text-muted)] shrink-0"
                  >
                    {isExpanded ? (
                      <ChevronDown className="h-3 w-3" />
                    ) : (
                      <ChevronRight className="h-3 w-3" />
                    )}
                  </button>
                )}
              </div>

              {isExpanded && hasDetail && (
                <div className="mt-2 pl-5 flex flex-col gap-1">
                  {step.toolCode && (
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] text-[var(--bz-text-muted)]">工具：</span>
                      <span
                        className="text-[11px] px-1.5 py-0.5 rounded"
                        style={{ background: 'var(--bz-brand-tint)', color: 'var(--bz-brand)' }}
                      >
                        {step.toolCode}
                      </span>
                    </div>
                  )}
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] text-[var(--bz-text-muted)]">状态：</span>
                    <span className="text-[11px]" style={{ color: STATUS_COLOR[step.status ?? 'pending'] }}>
                      {step.status ?? 'pending'}
                    </span>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}