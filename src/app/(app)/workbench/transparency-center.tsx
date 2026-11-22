'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import {
  Loader2, Eye, EyeOff, ChevronDown, ChevronRight,
  Activity, Clock, CheckCircle2, XCircle, PauseCircle,
  AlertCircle, Shield,
} from 'lucide-react';

type TimelineEvent = {
  timestamp: string;
  type: string;
  description: string;
  visible: boolean;
  detail?: string;
};

type RunDetail = {
  runId: string;
  title: string;
  status: string;
  startedAt: string;
  finishedAt: string | null;
  totalSteps: number;
  completedSteps: number;
  tokenUsage: number;
  toolCalls: number;
  timeline: TimelineEvent[];
};

const STATUS_ICON: Record<string, React.ReactNode> = {
  succeeded: <CheckCircle2 className="h-4 w-4" style={{ color: 'var(--bz-ok)' }} />,
  failed: <XCircle className="h-4 w-4" style={{ color: 'var(--bz-danger)' }} />,
  running: <Loader2 className="h-4 w-4 animate-spin" style={{ color: 'var(--bz-info)' }} />,
  paused: <PauseCircle className="h-4 w-4" style={{ color: 'var(--bz-text-muted)' }} />,
  partial_completed: <AlertCircle className="h-4 w-4" style={{ color: 'var(--bz-gold)' }} />,
};

const TYPE_ICON: Record<string, React.ReactNode> = {
  plan: <Activity className="h-3.5 w-3.5" style={{ color: 'var(--bz-brand)' }} />,
  tool: <Shield className="h-3.5 w-3.5" style={{ color: 'var(--bz-info)' }} />,
  reasoning: <Activity className="h-3.5 w-3.5" style={{ color: 'var(--bz-gold)' }} />,
  output: <CheckCircle2 className="h-3.5 w-3.5" style={{ color: 'var(--bz-ok)' }} />,
};

export function TransparencyCenter() {
  const router = useRouter();
  const [runs, setRuns] = React.useState<RunDetail[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [selectedRun, setSelectedRun] = React.useState<string | null>(null);
  const [expandedEvents, setExpandedEvents] = React.useState<Set<number>>(new Set());
  const [showHidden, setShowHidden] = React.useState(false);

  const fetchRuns = React.useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/v1/ai/runs?detail=true');
      const json = await res.json();
      if (json.code === 0 && json.data) {
        setRuns(json.data.items ?? []);
        if (json.data.items?.length > 0 && !selectedRun) {
          setSelectedRun(json.data.items[0].runId);
        }
      } else {
        setRuns([]);
      }
    } catch {
      setRuns([]);
    } finally {
      setLoading(false);
    }
  }, [selectedRun]);

  React.useEffect(() => {
    fetchRuns();
  }, [fetchRuns]);

  const toggleEvent = (idx: number) => {
    setExpandedEvents((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  };

  const currentRun = runs.find((r) => r.runId === selectedRun);
  const visibleTimeline = currentRun?.timeline.filter((e) => showHidden || e.visible) ?? [];

  return (
    <div className="flex flex-col gap-4">
      <div className="bz-card" style={{ borderRadius: 4 }}>
        <div className="bz-card-head">
          <span className="bz-card-title">透明度中心</span>
          <button
            onClick={() => setShowHidden((v) => !v)}
            className="text-[12px] flex items-center gap-1 px-2 py-1 rounded"
            style={{ borderRadius: 2, background: showHidden ? 'var(--bz-brand)' : 'transparent', color: showHidden ? '#fff' : 'var(--bz-text-sub)' }}
          >
            {showHidden ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
            {showHidden ? '隐藏不可见项' : '显示全部'}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-[280px_1fr] gap-4">
        <div className="bz-card" style={{ borderRadius: 4 }}>
          <div className="bz-card-head">
            <span className="bz-card-title">执行列表</span>
          </div>
          <div className="p-2">
            {loading && (
              <div className="flex items-center justify-center py-4">
                <Loader2 className="h-4 w-4 animate-spin text-[var(--bz-text-muted)]" />
              </div>
            )}
            {!loading && runs.length === 0 && (
              <div className="text-center text-[12px] text-[var(--bz-text-muted)] py-4">
                暂无执行记录
              </div>
            )}
            {!loading && runs.map((run) => (
              <button
                key={run.runId}
                onClick={() => setSelectedRun(run.runId)}
                className="w-full text-left px-3 py-2 rounded transition-colors"
                style={{
                  borderRadius: 2,
                  background: selectedRun === run.runId ? 'var(--bz-brand-tint)' : 'transparent',
                }}
              >
                <div className="flex items-center gap-2 mb-0.5">
                  {STATUS_ICON[run.status] ?? <Activity className="h-4 w-4" />}
                  <span className="text-[13px] font-medium text-[var(--bz-text)] truncate flex-1">
                    {run.title}
                  </span>
                </div>
                <div className="text-[11px] text-[var(--bz-text-muted)]">
                  {run.completedSteps}/{run.totalSteps} 步 · {new Date(run.startedAt).toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' })}
                </div>
              </button>
            ))}
          </div>
        </div>

        <div className="bz-card" style={{ borderRadius: 4 }}>
          {currentRun ? (
            <>
              <div className="bz-card-head">
                <span className="bz-card-title">{currentRun.title}</span>
                <span
                  className="text-[11px] px-1.5 py-0.5 rounded"
                  style={{ borderRadius: 2, background: 'var(--bz-brand-tint)', color: 'var(--bz-brand)' }}
                >
                  {currentRun.status}
                </span>
              </div>

              <div className="p-3">
                <div className="grid grid-cols-4 gap-2 mb-4">
                  <div className="rounded px-2 py-1.5 text-center" style={{ background: 'var(--bz-brand-tint)', borderRadius: 2 }}>
                    <div className="text-[11px] text-[var(--bz-text-sub)]">Token</div>
                    <div className="text-[14px] font-semibold" style={{ color: 'var(--bz-brand)' }}>{currentRun.tokenUsage.toLocaleString()}</div>
                  </div>
                  <div className="rounded px-2 py-1.5 text-center" style={{ background: 'var(--bz-info-tint)', borderRadius: 2 }}>
                    <div className="text-[11px] text-[var(--bz-text-sub)]">工具调用</div>
                    <div className="text-[14px] font-semibold" style={{ color: 'var(--bz-info)' }}>{currentRun.toolCalls}</div>
                  </div>
                  <div className="rounded px-2 py-1.5 text-center" style={{ background: 'var(--bz-gold-tint)', borderRadius: 2 }}>
                    <div className="text-[11px] text-[var(--bz-text-sub)]">步骤</div>
                    <div className="text-[14px] font-semibold" style={{ color: 'var(--bz-gold)' }}>{currentRun.completedSteps}/{currentRun.totalSteps}</div>
                  </div>
                  <div className="rounded px-2 py-1.5 text-center" style={{ background: 'var(--bz-ok-tint)', borderRadius: 2 }}>
                    <div className="text-[11px] text-[var(--bz-text-sub)]">耗时</div>
                    <div className="text-[14px] font-semibold" style={{ color: 'var(--bz-ok)' }}>
                      {currentRun.finishedAt
                        ? `${Math.round((new Date(currentRun.finishedAt).getTime() - new Date(currentRun.startedAt).getTime()) / 1000)}s`
                        : '-'}
                    </div>
                  </div>
                </div>

                <div className="text-[13px] font-medium text-[var(--bz-text)] mb-2">执行 Timeline</div>
                <div className="space-y-1">
                  {visibleTimeline.map((event, idx) => {
                    const expanded = expandedEvents.has(idx);
                    const hasDetail = !!event.detail;

                    return (
                      <div
                        key={idx}
                        className="rounded border px-2 py-1.5"
                        style={{
                          borderColor: event.visible ? 'var(--bz-border)' : 'var(--bz-border-light)',
                          borderRadius: 2,
                          opacity: event.visible ? 1 : 0.6,
                        }}
                      >
                        <div
                          className="flex items-center gap-2"
                          onClick={() => hasDetail && toggleEvent(idx)}
                          style={{ cursor: hasDetail ? 'pointer' : 'default' }}
                        >
                          {hasDetail ? (
                            expanded ? <ChevronDown className="h-3 w-3 text-[var(--bz-text-sub)]" />
                              : <ChevronRight className="h-3 w-3 text-[var(--bz-text-sub)]" />
                          ) : (
                            <span className="w-3" />
                          )}
                          {TYPE_ICON[event.type] ?? <Activity className="h-3.5 w-3.5" />}
                          <span className="text-[12px] text-[var(--bz-text)] flex-1 truncate">{event.description}</span>
                          {!event.visible && (
                            <EyeOff className="h-3 w-3 text-[var(--bz-text-muted)]" />
                          )}
                          <span className="text-[11px] text-[var(--bz-text-muted)] flex items-center gap-0.5">
                            <Clock className="h-2.5 w-2.5" />
                            {new Date(event.timestamp).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>

                        {expanded && hasDetail && (
                          <div className="mt-1 pl-6 text-[12px] text-[var(--bz-text-sub)] leading-relaxed">
                            {event.detail}
                          </div>
                        )}
                      </div>
                    );
                  })}

                  {visibleTimeline.length === 0 && (
                    <div className="text-center text-[12px] text-[var(--bz-text-muted)] py-4">
                      暂无 Timeline 事件
                    </div>
                  )}
                </div>
              </div>
            </>
          ) : (
            <div className="text-center text-[13px] text-[var(--bz-text-muted)] py-12">
              请从左侧选择执行记录
            </div>
          )}
        </div>
      </div>
    </div>
  );
}