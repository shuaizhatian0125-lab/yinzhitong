'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import {
  Loader2, CheckCircle2, XCircle, PauseCircle,
  AlertCircle, Play, StopCircle, ChevronRight,
} from 'lucide-react';

type RunStatus = 'running' | 'waiting_confirm' | 'partial_completed' | 'paused' | 'failed';

type RunItem = {
  runId: string;
  title: string;
  status: RunStatus;
  startedAt: string;
  updatedAt: string;
  stepCount: number;
  completedSteps: number;
  collaborationId: string | null;
};

const STATUS_CONFIG: Record<RunStatus, { label: string; icon: React.ReactNode; color: string }> = {
  running: { label: '执行中', icon: <Loader2 className="h-4 w-4 animate-spin" />, color: 'var(--bz-info)' },
  waiting_confirm: { label: '等待确认', icon: <AlertCircle className="h-4 w-4" />, color: 'var(--bz-warn)' },
  partial_completed: { label: '部分完成', icon: <CheckCircle2 className="h-4 w-4" />, color: 'var(--bz-gold)' },
  paused: { label: '已暂停', icon: <PauseCircle className="h-4 w-4" />, color: 'var(--bz-text-muted)' },
  failed: { label: '失败', icon: <XCircle className="h-4 w-4" />, color: 'var(--bz-danger)' },
};

export function RunStatusPanel() {
  const router = useRouter();
  const [runs, setRuns] = React.useState<RunItem[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [filter, setFilter] = React.useState<RunStatus | ''>('');

  const fetchRuns = React.useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/v1/ai/runs');
      const json = await res.json();
      if (json.code === 0 && json.data) {
        setRuns(json.data.items ?? []);
      } else {
        setRuns([]);
      }
    } catch {
      setRuns([]);
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    fetchRuns();
  }, [fetchRuns]);

  const handleResume = async (runId: string) => {
    try {
      await fetch(`/api/v1/ai/runs/${runId}/resume`, { method: 'POST' });
      fetchRuns();
    } catch {
      // ignore
    }
  };

  const handleStop = async (runId: string) => {
    try {
      await fetch(`/api/v1/ai/runs/${runId}/stop`, { method: 'POST' });
      fetchRuns();
    } catch {
      // ignore
    }
  };

  const filteredRuns = filter ? runs.filter((r) => r.status === filter) : runs;

  return (
    <div className="bz-card" style={{ borderRadius: 4 }}>
      <div className="bz-card-head">
        <span className="bz-card-title">执行状态面板</span>
        <div className="flex items-center gap-1">
          {(['', 'running', 'waiting_confirm', 'partial_completed', 'paused', 'failed'] as const).map((s) => (
            <button
              key={s}
              onClick={() => setFilter(s)}
              className="text-[12px] px-2 py-1 rounded transition-colors"
              style={{
                borderRadius: 3,
                background: filter === s ? 'var(--bz-brand)' : 'transparent',
                color: filter === s ? '#fff' : 'var(--bz-text-sub)',
              }}
            >
              {s === '' ? '全部' : STATUS_CONFIG[s].label}
            </button>
          ))}
        </div>
      </div>

      <div className="p-3">
        {loading && (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-[var(--bz-text-muted)]" />
          </div>
        )}

        {!loading && filteredRuns.length === 0 && (
          <div className="text-center text-[13px] text-[var(--bz-text-muted)] py-8">
            暂无执行记录
          </div>
        )}

        {!loading && filteredRuns.length > 0 && (
          <div className="space-y-2">
            {filteredRuns.map((run) => {
              const config = STATUS_CONFIG[run.status];
              const progress = run.stepCount > 0 ? Math.round((run.completedSteps / run.stepCount) * 100) : 0;

              return (
                <div
                  key={run.runId}
                  className="rounded border px-3 py-2.5 transition-colors hover:border-[var(--bz-brand)]"
                  style={{ borderColor: 'var(--bz-border)', borderRadius: 3 }}
                >
                  <div className="flex items-center gap-2 mb-1.5">
                    <span style={{ color: config.color }}>{config.icon}</span>
                    <span className="text-[13px] font-medium text-[var(--bz-text)] flex-1 truncate">
                      {run.title}
                    </span>
                    <span
                      className="text-[11px] px-1.5 py-0.5 rounded"
                      style={{ background: `${config.color}15`, color: config.color, borderRadius: 2 }}
                    >
                      {config.label}
                    </span>
                  </div>

                  <div className="flex items-center gap-3 text-[12px] text-[var(--bz-text-muted)] mb-2">
                    <span>{run.completedSteps}/{run.stepCount} 步</span>
                    <span>{progress}%</span>
                    <span>{new Date(run.updatedAt).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}</span>
                  </div>

                  <div className="h-1 rounded-full overflow-hidden mb-2" style={{ background: 'var(--bz-border)' }}>
                    <div
                      className="h-full rounded-full transition-all"
                      style={{ width: `${progress}%`, background: config.color }}
                    />
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => router.push(`/workbench?runId=${run.runId}`)}
                      className="text-[12px] flex items-center gap-1 text-[var(--bz-brand)] hover:underline"
                    >
                      查看详情
                      <ChevronRight className="h-3 w-3" />
                    </button>

                    {run.status === 'paused' && (
                      <button
                        onClick={() => handleResume(run.runId)}
                        className="text-[12px] flex items-center gap-1 text-[var(--bz-ok)] hover:underline"
                      >
                        <Play className="h-3 w-3" />
                        恢复
                      </button>
                    )}

                    {(run.status === 'running' || run.status === 'waiting_confirm') && (
                      <button
                        onClick={() => handleStop(run.runId)}
                        className="text-[12px] flex items-center gap-1 text-[var(--bz-danger)] hover:underline"
                      >
                        <StopCircle className="h-3 w-3" />
                        停止
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}