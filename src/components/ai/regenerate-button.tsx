'use client';

import * as React from 'react';
import { RefreshCw, RotateCcw, ChevronDown, Loader2 } from 'lucide-react';

type RegenerateButtonProps = {
  runId: string;
  failedStepId?: string;
  onRegenerate?: (mode: 'from_failed' | 'full', newRunId: string) => void;
  className?: string;
};

export function RegenerateButton({
  runId,
  failedStepId,
  onRegenerate,
  className,
}: RegenerateButtonProps) {
  const [showMenu, setShowMenu] = React.useState(false);
  const [loading, setLoading] = React.useState(false);

  const handleRegenerate = async (mode: 'from_failed' | 'full') => {
    setLoading(true);
    try {
      const res = await fetch(`/api/v1/ai/runs/${runId}/regenerate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode,
          fromStepId: mode === 'from_failed' ? failedStepId : undefined,
        }),
      });
      const json = await res.json();
      if (json.code === 0 && json.data?.newRunId) {
        onRegenerate?.(mode, json.data.newRunId);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
      setShowMenu(false);
    }
  };

  return (
    <div className={`relative ${className ?? ''}`}>
      <button
        onClick={() => setShowMenu((v) => !v)}
        disabled={loading}
        className="bz-btn bz-btn-ghost text-[12px] flex items-center gap-1"
        style={{ borderRadius: 2 }}
      >
        {loading ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <RefreshCw className="h-3.5 w-3.5" />
        )}
        重新生成
        <ChevronDown className="h-3 w-3" />
      </button>

      {showMenu && !loading && (
        <div
          className="absolute right-0 top-full mt-1 z-10 rounded border shadow-sm"
          style={{ borderColor: 'var(--bz-border)', borderRadius: 3, background: 'var(--bz-card)', minWidth: 180 }}
        >
          {failedStepId && (
            <button
              onClick={() => handleRegenerate('from_failed')}
              className="w-full text-left px-3 py-2 text-[13px] text-[var(--bz-text)] hover:bg-[var(--bz-brand-tint)] transition-colors"
              style={{ borderRadius: 2 }}
            >
              <div className="flex items-center gap-2">
                <RotateCcw className="h-3.5 w-3.5" style={{ color: 'var(--bz-brand)' }} />
                从失败处继续
              </div>
              <div className="text-[11px] text-[var(--bz-text-muted)] mt-0.5 pl-5">
                保留已完成步骤，从失败处重新执行
              </div>
            </button>
          )}
          <button
            onClick={() => handleRegenerate('full')}
            className="w-full text-left px-3 py-2 text-[13px] text-[var(--bz-text)] hover:bg-[var(--bz-brand-tint)] transition-colors"
            style={{ borderRadius: 2 }}
          >
            <div className="flex items-center gap-2">
              <RefreshCw className="h-3.5 w-3.5" style={{ color: 'var(--bz-info)' }} />
              完全重新生成
            </div>
            <div className="text-[11px] text-[var(--bz-text-muted)] mt-0.5 pl-5">
              创建全新 Run，原 Run 保留
            </div>
          </button>
        </div>
      )}
    </div>
  );
}