'use client';

import * as React from 'react';
import { Check, X, AlertTriangle, ListChecks } from 'lucide-react';

type PlanStep = {
  seq: number;
  description: string;
  stepType?: string;
  toolCode?: string | null;
  riskLevel?: string;
  dependencies?: number[];
};

type PlanConfirmationCardProps = {
  planId: string;
  steps: PlanStep[];
  riskLevel: string;
  requiresConfirmation: boolean;
  onConfirm?: () => void;
  onModify?: () => void;
  onReject?: () => void;
  className?: string;
};

const RISK_LABELS: Record<string, string> = {
  L0: '低风险',
  L1: '中风险',
  L2: '高风险',
  L3: '极高风险',
  L4: '极高风险',
};

const RISK_COLORS: Record<string, string> = {
  L0: 'var(--bz-ok)',
  L1: 'var(--bz-info)',
  L2: 'var(--bz-gold)',
  L3: 'var(--bz-danger)',
  L4: 'var(--bz-danger)',
};

const STEP_TYPE_LABELS: Record<string, string> = {
  RESEARCH: '研究',
  ANALYSIS: '分析',
  TOOL_CALL: '工具调用',
  APPROVAL: '审批',
  OUTPUT: '输出',
  REVIEW: '评审',
};

export function PlanConfirmationCard({
  planId,
  steps,
  riskLevel,
  requiresConfirmation,
  onConfirm,
  onModify,
  onReject,
  className,
}: PlanConfirmationCardProps) {
  const [loading, setLoading] = React.useState(false);

  const handleAction = (action?: () => void) => {
    if (!action) return;
    setLoading(true);
    action();
    setLoading(false);
  };

  return (
    <div className="rounded-[4px] border border-[var(--bz-border)] bg-[var(--bz-card)] p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <ListChecks className="h-4 w-4" style={{ color: 'var(--bz-brand)' }} />
          <span className="text-[14px] font-semibold text-[var(--bz-text)]">执行计划确认</span>
        </div>
        <span
          className="inline-flex items-center rounded-[2px] px-2 py-0.5 text-[12px] font-medium"
          style={{ backgroundColor: RISK_COLORS[riskLevel] ?? 'var(--bz-info)', color: '#fff' }}
        >
          {RISK_LABELS[riskLevel] ?? riskLevel}
        </span>
      </div>

      <div className="space-y-2 mb-4">
        {steps.map((step) => (
          <div
            key={step.seq}
            className="flex items-start gap-2 rounded-[2px] border border-[var(--bz-border-light)] p-2"
          >
            <span className="text-[12px] font-semibold text-[var(--bz-brand)] min-w-[24px]">
              {step.seq}.
            </span>
            <div className="flex-1">
              <div className="text-[13px] text-[var(--bz-text)]">{step.description}</div>
              <div className="flex items-center gap-3 mt-1">
                {step.stepType && (
                  <span className="text-[11px] text-[var(--bz-text-sub)]">
                    {STEP_TYPE_LABELS[step.stepType] ?? step.stepType}
                  </span>
                )}
                {step.toolCode && (
                  <span className="text-[11px] text-[var(--bz-text-sub)]">
                    工具: {step.toolCode}
                  </span>
                )}
                {step.dependencies && step.dependencies.length > 0 && (
                  <span className="text-[11px] text-[var(--bz-text-sub)]">
                    依赖: 步骤 {step.dependencies.join(', ')}
                  </span>
                )}
              </div>
            </div>
            {step.riskLevel && (
              <span
                className="text-[11px] font-medium"
                style={{ color: RISK_COLORS[step.riskLevel] ?? 'var(--bz-text-sub)' }}
              >
                {RISK_LABELS[step.riskLevel] ?? step.riskLevel}
              </span>
            )}
          </div>
        ))}
      </div>

      {requiresConfirmation && (
        <div className="flex items-center gap-2 mb-3 text-[12px]" style={{ color: 'var(--bz-warning)' }}>
          <AlertTriangle className="h-3.5 w-3.5" />
          <span>此计划需要人工确认后方可执行</span>
        </div>
      )}

      <div className="flex items-center gap-2">
        <button
          onClick={() => handleAction(onConfirm)}
          disabled={loading}
          className="inline-flex items-center gap-1 rounded-[2px] px-3 py-1.5 text-[13px] font-medium text-white disabled:opacity-50"
          style={{ backgroundColor: 'var(--bz-ok)' }}
        >
          <Check className="h-3.5 w-3.5" />
          确认执行
        </button>
        <button
          onClick={() => handleAction(onModify)}
          disabled={loading}
          className="inline-flex items-center gap-1 rounded-[2px] px-3 py-1.5 text-[13px] font-medium border border-[var(--bz-border)] text-[var(--bz-text)] disabled:opacity-50"
        >
          修改计划
        </button>
        <button
          onClick={() => handleAction(onReject)}
          disabled={loading}
          className="inline-flex items-center gap-1 rounded-[2px] px-3 py-1.5 text-[13px] font-medium text-white disabled:opacity-50"
          style={{ backgroundColor: 'var(--bz-danger)' }}
        >
          <X className="h-3.5 w-3.5" />
          拒绝
        </button>
      </div>
    </div>
  );
}