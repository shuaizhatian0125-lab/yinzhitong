'use client';

import * as React from 'react';
import {
  CheckCircle2, XCircle, Loader2, Circle, Clock,
  Wrench, Brain, FileOutput, ChevronDown, ChevronRight,
} from 'lucide-react';

type TimelineStep = {
  stepId: string;
  seq: number;
  kind: string;
  name: string;
  status: string;
  startedAt: string | null;
  finishedAt: string | null;
  durationMs: number | null;
  toolName: string | null;
  hasError: boolean;
  error: string | null;
};

type ExecutionTimelineProps = {
  runId: string;
  steps: TimelineStep[];
  liveUpdate?: boolean;
  className?: string;
};

const STATUS_ICON: Record<string, React.ReactNode> = {
  succeeded: <CheckCircle2 className="h-4 w-4" style={{ color: 'var(--bz-ok)' }} />,
  failed: <XCircle className="h-4 w-4" style={{ color: 'var(--bz-danger)' }} />,
  running: <Loader2 className="h-4 w-4 animate-spin" style={{ color: 'var(--bz-info)' }} />,
  pending: <Circle className="h-4 w-4" style={{ color: 'var(--bz-text-muted)' }} />,
  skipped: <Circle className="h-4 w-4 opacity-30" />,
};

const KIND_ICON: Record<string, React.ReactNode> = {
  reasoning: <Brain className="h-3.5 w-3.5" style={{ color: 'var(--bz-brand)' }} />,
  tool_call: <Wrench className="h-3.5 w-3.5" style={{ color: 'var(--bz-info)' }} />,
  output: <FileOutput className="h-3.5 w-3.5" style={{ color: 'var(--bz-gold)' }} />,
};

const KIND_LABEL: Record<string, string> = {
  reasoning: '推理',
  tool_call: '工具调用',
  output: '输出',
};

function formatDuration(ms: number | null): string {
  if (ms === null) return '-';
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

export function ExecutionTimeline({
  runId,
  steps,
  liveUpdate = false,
  className,
}: ExecutionTimelineProps) {
  const [expandedSteps, setExpandedSteps] = React.useState<Set<number>>(new Set());

  const toggleStep = (seq: number) => {
    setExpandedSteps((prev) => {
      const next = new Set(prev);
      if (next.has(seq)) next.delete(seq);
      else next.add(seq);
      return next;
    });
  };

  return (
    <div className="rounded-[4px] border border-[var(--bz-border)] bg-[var(--bz-card)] p-4">
      <div className="flex items-center justify-between mb-3">
        <span className="text-[14px] font-semibold text-[var(--bz-text)]">执行 Timeline</span>
        {liveUpdate && (
          <span className="text-[11px] text-[var(--bz-info)] flex items-center gap-1">
            <span className="h-1.5 w-1.5 rounded-full bg-[var(--bz-info)] animate-pulse" />
            实时更新
          </span>
        )}
      </div>

      <div className="space-y-1">
        {steps.map((step) => {
          const expanded = expandedSteps.has(step.seq);
          const hasDetail = step.hasError || step.toolName;

          return (
            <div key={step.stepId} className="rounded-[2px] border border-[var(--bz-border-light)]">
              <div
                className="flex items-center gap-2 p-2 cursor-pointer"
                onClick={() => hasDetail && toggleStep(step.seq)}
              >
                {hasDetail ? (
                  expanded ? <ChevronDown className="h-3 w-3 text-[var(--bz-text-sub)]" />
                    : <ChevronRight className="h-3 w-3 text-[var(--bz-text-sub)]" />
                ) : (
                  <span className="w-3" />
                )}

                {STATUS_ICON[step.status] ?? <Circle className="h-4 w-4" />}

                {KIND_ICON[step.kind]}

                <span className="text-[12px] font-medium text-[var(--bz-text-sub)] min-w-[28px]">
                  #{step.seq}
                </span>

                <span className="text-[13px] text-[var(--bz-text)] flex-1 truncate">
                  {step.name}
                </span>

                {step.durationMs !== null && (
                  <span className="text-[11px] text-[var(--bz-text-sub)] flex items-center gap-0.5">
                    <Clock className="h-3 w-3" />
                    {formatDuration(step.durationMs)}
                  </span>
                )}
              </div>

              {expanded && hasDetail && (
                <div className="px-4 pb-2 text-[12px] text-[var(--bz-text-sub)]">
                  {step.toolName && (
                    <div className="mb-1">
                      <span className="text-[var(--bz-text-sub)]">工具: </span>
                      <span className="text-[var(--bz-text)]">{step.toolName}</span>
                    </div>
                  )}
                  {step.error && (
                    <div style={{ color: 'var(--bz-danger)' }}>
                      <span>错误: </span>
                      <span>{step.error}</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {steps.length === 0 && (
        <div className="text-center text-[13px] text-[var(--bz-text-sub)] py-4">
          暂无执行步骤
        </div>
      )}
    </div>
  );
}