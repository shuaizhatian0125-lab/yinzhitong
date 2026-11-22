'use client';

import * as React from 'react';
import { AlertTriangle, Check, X } from 'lucide-react';

type AiConfirmCardProps = {
  runId: string;
  riskLevel?: string;
  message?: string;
  onConfirm?: () => void;
  onCancel?: () => void;
  className?: string;
};

const RISK_LABEL: Record<string, string> = {
  L0: '低风险',
  L1: '中风险',
  L2: '高风险',
  L3: '极高风险',
};

export function AiConfirmCard({
  runId,
  riskLevel = 'L1',
  message,
  onConfirm,
  onCancel,
  className,
}: AiConfirmCardProps) {
  const [loading, setLoading] = React.useState(false);

  const handleConfirm = async () => {
    setLoading(true);
    try {
      onConfirm?.();
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = async () => {
    setLoading(true);
    try {
      onCancel?.();
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className={`bz-shadow-soft ${className ?? ''}`}
      style={{
        borderRadius: 6,
        borderLeft: '3px solid var(--bz-warn)',
        background: '#fdf4e7',
        padding: '14px 18px',
      }}
    >
      <div className="flex items-start gap-3">
        <AlertTriangle className="h-5 w-5 shrink-0 mt-0.5" style={{ color: 'var(--bz-warn)' }} />
        <div className="flex flex-col gap-2 flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-[14px] font-medium text-[var(--bz-text)]">需要您的确认</span>
            <span
              className="text-[11px] px-1.5 py-0.5 rounded"
              style={{
                background: riskLevel === 'L2' || riskLevel === 'L3' ? 'var(--bz-danger)' : 'var(--bz-warn)',
                color: '#fff',
              }}
            >
              {RISK_LABEL[riskLevel] ?? riskLevel}
            </span>
          </div>

          {message && (
            <p className="text-[13px] text-[var(--bz-text-sub)] leading-relaxed">{message}</p>
          )}

          <div className="flex items-center gap-2 pt-1">
            <button
              onClick={handleConfirm}
              disabled={loading}
              className="bz-btn bz-btn-primary text-[12px] flex items-center gap-1"
            >
              <Check className="h-3 w-3" />
              确认执行
            </button>
            <button
              onClick={handleCancel}
              disabled={loading}
              className="bz-btn bz-btn-ghost text-[12px] flex items-center gap-1"
            >
              <X className="h-3 w-3" />
              取消
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}