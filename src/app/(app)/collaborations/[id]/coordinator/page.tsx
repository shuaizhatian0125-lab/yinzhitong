'use client';

import * as React from 'react';
import { useParams } from 'next/navigation';
import {
  Loader2, Play, Pause, Settings, Activity,
  CheckCircle2, AlertCircle, Clock,
} from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';

type CoordinatorStatus = {
  mode: string;
  status: string;
  lastDecisionAt: string | null;
  pendingConfirmations: { id: string; type: string; description: string; requestedAt: string }[];
  decisionLoop: { step: string; status: string; timestamp: string }[];
};

const MODE_LABEL: Record<string, string> = {
  HUMAN: '人工模式',
  AI_ASSISTED: 'AI辅助模式',
  AI_COORDINATED: 'AI协调模式',
  AUTO: '全自动模式',
};

const STATUS_ICON: Record<string, React.ReactNode> = {
  running: <Activity className="h-4 w-4 animate-spin" style={{ color: 'var(--bz-info)' }} />,
  paused: <Pause className="h-4 w-4" style={{ color: 'var(--bz-text-muted)' }} />,
  idle: <Clock className="h-4 w-4" style={{ color: 'var(--bz-text-muted)' }} />,
  error: <AlertCircle className="h-4 w-4" style={{ color: 'var(--bz-danger)' }} />,
};

export default function CoordinatorPage() {
  const params = useParams();
  const collaborationId = params.id as string;
  const [data, setData] = React.useState<CoordinatorStatus | null>(null);
  const [loading, setLoading] = React.useState(true);

  const fetchCoordinator = React.useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/v1/collaborations/${collaborationId}/coordinator`);
      const json = await res.json();
      if (json.code === 0 && json.data) {
        setData(json.data);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [collaborationId]);

  React.useEffect(() => {
    fetchCoordinator();
  }, [fetchCoordinator]);

  const handleStart = async () => {
    try {
      await fetch(`/api/v1/collaborations/${collaborationId}/coordinator/start`, { method: 'POST' });
      fetchCoordinator();
    } catch {
      // ignore
    }
  };

  const handleStop = async () => {
    try {
      await fetch(`/api/v1/collaborations/${collaborationId}/coordinator/stop`, { method: 'POST' });
      fetchCoordinator();
    } catch {
      // ignore
    }
  };

  const handleRespond = async (confirmationId: string, response: string) => {
    try {
      await fetch(`/api/v1/collaborations/${collaborationId}/coordinator/confirmations/${confirmationId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ response }),
      });
      fetchCoordinator();
    } catch {
      // ignore
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-5 w-5 animate-spin text-[var(--bz-text-muted)]" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="text-center text-[var(--bz-text-muted)] py-12">
        暂无 Coordinator 数据
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Coordinator 面板"
        description="Coordinator 运行状态、决策循环、待确认项"
        actions={
          <div className="flex items-center gap-2">
            {data.status === 'running' ? (
              <button
                onClick={handleStop}
                className="bz-btn bz-btn-ghost"
                style={{ borderRadius: 3, color: 'var(--bz-danger)' }}
              >
                <Pause className="h-4 w-4" />
                停止
              </button>
            ) : (
              <button
                onClick={handleStart}
                className="bz-btn bz-btn-primary"
                style={{ borderRadius: 3 }}
              >
                <Play className="h-4 w-4" />
                启动
              </button>
            )}
          </div>
        }
      />

      <div className="grid grid-cols-3 gap-3">
        <div className="bz-card" style={{ borderRadius: 6, padding: '10px 14px' }}>
          <div className="flex items-center gap-2 mb-1">
            <Settings className="h-4 w-4" style={{ color: 'var(--bz-brand)' }} />
            <span className="text-[12px] text-[var(--bz-text-sub)]">运行模式</span>
          </div>
          <div className="text-[14px] font-medium" style={{ color: 'var(--bz-brand)' }}>
            {MODE_LABEL[data.mode] ?? data.mode}
          </div>
        </div>

        <div className="bz-card" style={{ borderRadius: 6, padding: '10px 14px' }}>
          <div className="flex items-center gap-2 mb-1">
            {STATUS_ICON[data.status] ?? <Clock className="h-4 w-4" />}
            <span className="text-[12px] text-[var(--bz-text-sub)]">运行状态</span>
          </div>
          <div className="text-[14px] font-medium text-[var(--bz-text)]">{data.status}</div>
        </div>

        <div className="bz-card" style={{ borderRadius: 6, padding: '10px 14px' }}>
          <div className="flex items-center gap-2 mb-1">
            <AlertCircle className="h-4 w-4" style={{ color: 'var(--bz-warn)' }} />
            <span className="text-[12px] text-[var(--bz-text-sub)]">待确认</span>
          </div>
          <div className="text-[14px] font-medium" style={{ color: 'var(--bz-warn)' }}>
            {data.pendingConfirmations.length} 项
          </div>
        </div>
      </div>

      {data.pendingConfirmations.length > 0 && (
        <div className="bz-card" style={{ borderRadius: 8 }}>
          <div className="bz-card-head">
            <span className="bz-card-title">待确认项</span>
            <span className="text-[12px] text-[var(--bz-text-muted)]">{data.pendingConfirmations.length} 项</span>
          </div>
          <div className="p-3">
            {data.pendingConfirmations.map((conf) => (
              <div
                key={conf.id}
                className="rounded border px-3 py-2 mb-2"
                style={{ borderColor: 'var(--bz-border)', borderRadius: 2, borderLeft: '3px solid var(--bz-warn)' }}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[13px] font-medium text-[var(--bz-text)]">{conf.type}</span>
                  <span className="text-[11px] text-[var(--bz-text-muted)]">
                    {new Date(conf.requestedAt).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
                <div className="text-[12px] text-[var(--bz-text-sub)] mb-2">{conf.description}</div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleRespond(conf.id, 'approve')}
                    className="bz-btn bz-btn-primary text-[12px]"
                    style={{ borderRadius: 2 }}
                  >
                    <CheckCircle2 className="h-3 w-3" />
                    确认
                  </button>
                  <button
                    onClick={() => handleRespond(conf.id, 'reject')}
                    className="bz-btn bz-btn-ghost text-[12px]"
                    style={{ borderRadius: 2, color: 'var(--bz-danger)' }}
                  >
                    拒绝
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="bz-card" style={{ borderRadius: 8 }}>
        <div className="bz-card-head">
          <span className="bz-card-title">决策循环</span>
        </div>
        <div className="p-3">
          {data.decisionLoop.length === 0 && (
            <div className="text-center text-[12px] text-[var(--bz-text-muted)] py-4">
              暂无决策循环记录
            </div>
          )}
          {data.decisionLoop.map((loop, idx) => (
            <div
              key={idx}
              className="flex items-center gap-3 px-2 py-2"
              style={{ borderBottom: idx < data.decisionLoop.length - 1 ? '1px solid var(--bz-border)' : 'none' }}
            >
              <span
                className="h-2 w-2 rounded-full shrink-0"
                style={{
                  background: loop.status === 'completed' ? 'var(--bz-ok)' : loop.status === 'running' ? 'var(--bz-info)' : 'var(--bz-text-muted)',
                }}
              />
              <span className="text-[13px] text-[var(--bz-text)] flex-1">{loop.step}</span>
              <span className="text-[11px] text-[var(--bz-text-muted)]">
                {new Date(loop.timestamp).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}