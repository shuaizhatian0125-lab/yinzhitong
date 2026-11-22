'use client';

import * as React from 'react';
import { ChevronDown, ChevronRight, CheckCircle2, XCircle, Loader2, Circle } from 'lucide-react';

type StepItem = {
  seq: number;
  kind: string;
  description: string;
  toolCode?: string | null;
  status?: string;
};

type AiRunTimelineProps = {
  steps: StepItem[];
  className?: string;
};

const STATUS_ICON: Record<string, React.ReactNode> = {
  succeeded: <CheckCircle2 className="h-4 w-4" style={{ color: 'var(--bz-ok)' }} />,
  failed: <XCircle className="h-4 w-4" style={{ color: 'var(--bz-danger)' }} />,
  running: <Loader2 className="h-4 w-4 animate-spin" style={{ color: 'var(--bz-info)' }} />,
  pending: <Circle className="h-4 w-4" style={{ color: 'var(--bz-text-muted)' }} />,
  skipped: <Circle className="h-4 w-4 opacity-30" />,
};

const KIND_LABEL: Record<string, string> = {
  reasoning: '推理',
  tool_call: '工具调用',
  output: '输出',
};

export function AiRunTimeline({ steps, className }: AiRunTimelineProps) {
  const [expanded, setExpanded] = React.useState(true);

  if (!steps || steps.length === 0) return null;

  return (
    <div className={className} style={{ borderRadius: 4 }}>
      <button
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-center gap-2 px-3 py-2 text-left"
      >
        {expanded ? (
          <ChevronDown className="h-4 w-4 text-[var(--bz-text-muted)]" />
        ) : (
          <ChevronRight className="h-4 w-4 text-[var(--bz-text-muted)]" />
        )}
        <span className="text-[13px] font-medium text-[var(--bz-text)]">
          执行步骤（{steps.length}）
        </span>
      </button>

      {expanded && (
        <div className="px-3 pb-3">
          <div className="flex flex-col gap-0">
            {steps.map((step, idx) => (
              <div
                key={step.seq}
                className="flex items-start gap-3 py-2"
                style={{
                  borderLeft: idx < steps.length - 1 ? '2px solid var(--bz-line)' : '2px solid transparent',
                  marginLeft: '7px',
                  paddingLeft: '14px',
                }}
              >
                <div className="shrink-0 -ml-[21px] mt-0.5">
                  {STATUS_ICON[step.status ?? 'pending'] ?? STATUS_ICON.pending}
                </div>
                <div className="flex flex-col gap-0.5 flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-[12px] text-[var(--bz-text-muted)] shrink-0">
                      {KIND_LABEL[step.kind] ?? step.kind}
                    </span>
                    {step.toolCode && (
                      <span
                        className="text-[11px] px-1.5 py-0.5 rounded shrink-0"
                        style={{ background: 'var(--bz-brand-tint)', color: 'var(--bz-brand)' }}
                      >
                        {step.toolCode}
                      </span>
                    )}
                  </div>
                  <span className="text-[13px] text-[var(--bz-text)] leading-relaxed">
                    {step.description}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}