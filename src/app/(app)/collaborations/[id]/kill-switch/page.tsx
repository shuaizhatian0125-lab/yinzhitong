'use client';

import * as React from 'react';
import { useParams } from 'next/navigation';
import {
  Loader2, Shield, AlertTriangle, Power, Pause,
  Ban, Lock, RefreshCw, History,
} from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';

type KillSwitchOperation = {
  type: string;
  label: string;
  description: string;
  icon: React.ReactNode;
  severity: 'low' | 'medium' | 'high' | 'critical';
};

const OPERATIONS: KillSwitchOperation[] = [
  {
    type: 'STOP_ALL_AGENTS',
    label: '停止所有 AI Agent',
    description: '立即停止协作中所有 AI Agent 的执行',
    icon: <Ban className="h-5 w-5" />,
    severity: 'high',
  },
  {
    type: 'PAUSE_COLLABORATION',
    label: '暂停协作',
    description: '暂停整个协作流程，保留当前状态',
    icon: <Pause className="h-5 w-5" />,
    severity: 'medium',
  },
  {
    type: 'STOP_WORKSTREAM',
    label: '停止工作线',
    description: '停止指定工作线的执行',
    icon: <Power className="h-5 w-5" />,
    severity: 'medium',
  },
  {
    type: 'STOP_AGENT',
    label: '停止单个 Agent',
    description: '停止单个 AI Agent 的执行',
    icon: <Power className="h-5 w-5" />,
    severity: 'low',
  },
  {
    type: 'STOP_RUN',
    label: '停止执行',
    description: '停止当前 AI Run',
    icon: <Power className="h-5 w-5" />,
    severity: 'low',
  },
  {
    type: 'REVOKE_AI_PERMISSIONS',
    label: '撤销 AI 权限',
    description: '撤销所有 AI Agent 的工具调用权限',
    icon: <Lock className="h-5 w-5" />,
    severity: 'high',
  },
  {
    type: 'EMERGENCY_HALT',
    label: '紧急停止',
    description: '立即停止一切 AI 活动，封锁所有数据访问',
    icon: <AlertTriangle className="h-5 w-5" />,
    severity: 'critical',
  },
];

const SEVERITY_COLOR: Record<string, string> = {
  low: 'var(--bz-info)',
  medium: 'var(--bz-warn)',
  high: 'var(--bz-danger)',
  critical: 'var(--bz-danger)',
};

type KillSwitchRecord = {
  id: string;
  action: string;
  detail: { reason?: string; scope?: Record<string, string>; recoverable?: boolean };
  created_at: string;
  username: string;
};

export default function KillSwitchPage() {
  const params = useParams();
  const collaborationId = params.id as string;
  const [records, setRecords] = React.useState<KillSwitchRecord[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [confirmOp, setConfirmOp] = React.useState<KillSwitchOperation | null>(null);
  const [executing, setExecuting] = React.useState(false);
  const [reason, setReason] = React.useState('');
  const [scope, setScope] = React.useState({ workstreamId: '', agentCode: '', runId: '' });

  const fetchRecords = React.useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/v1/collaborations/${collaborationId}/kill-switch/records`);
      const json = await res.json();
      if (json.code === 0 && json.data) {
        setRecords(json.data.items ?? []);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [collaborationId]);

  React.useEffect(() => {
    fetchRecords();
  }, [fetchRecords]);

  const handleExecute = async () => {
    if (!confirmOp || !reason.trim()) return;
    setExecuting(true);
    try {
      const body: Record<string, unknown> = {
        action: confirmOp.type,
        reason: reason,
        scope: {},
      };
      if (confirmOp.type === 'STOP_WORKSTREAM' && scope.workstreamId) {
        body.scope = { workstreamId: scope.workstreamId };
      } else if (confirmOp.type === 'STOP_AGENT' && scope.agentCode) {
        body.scope = { agentCode: scope.agentCode };
      } else if (confirmOp.type === 'STOP_RUN' && scope.runId) {
        body.scope = { runId: scope.runId };
      }

      await fetch(`/api/v1/collaborations/${collaborationId}/kill-switch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      setConfirmOp(null);
      setReason('');
      setScope({ workstreamId: '', agentCode: '', runId: '' });
      fetchRecords();
    } catch {
      // ignore
    } finally {
      setExecuting(false);
    }
  };

  const activeActions = new Set(records.filter((r) => !r.detail.recoverable || r.action.includes('EMERGENCY_HALT')).map((r) => r.action.replace('kill_switch:', '')));

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Kill Switch 面板"
        description="7种停止操作、紧急停止"
      />

      {loading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-5 w-5 animate-spin text-[var(--bz-text-muted)]" />
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        {OPERATIONS.map((op) => {
          const color = SEVERITY_COLOR[op.severity];
          const isActive = activeActions.has(op.type);

          return (
            <div
              key={op.type}
              className="bz-card"
              style={{
                borderRadius: 6,
                padding: '12px 14px',
                borderLeft: `3px solid ${color}`,
                opacity: isActive ? 0.5 : 1,
              }}
            >
              <div className="flex items-start gap-3">
                <div
                  className="flex h-10 w-10 items-center justify-center rounded shrink-0"
                  style={{ background: `${color}15`, borderRadius: 3 }}
                >
                  <span style={{ color }}>{op.icon}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[14px] font-medium text-[var(--bz-text)] mb-0.5">{op.label}</div>
                  <div className="text-[12px] text-[var(--bz-text-sub)] leading-relaxed mb-2">{op.description}</div>
                  <button
                    onClick={() => setConfirmOp(op)}
                    disabled={isActive}
                    className="text-[12px] px-3 py-1 rounded"
                    style={{
                      borderRadius: 2,
                      background: color,
                      color: '#fff',
                      opacity: isActive ? 0.5 : 1,
                    }}
                  >
                    {isActive ? '已执行' : '执行'}
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {!loading && records.length > 0 && (
        <div className="bz-card" style={{ borderRadius: 8 }}>
          <div className="bz-card-head">
            <span className="bz-card-title flex items-center gap-2">
              <History className="h-4 w-4" />
              历史操作记录
            </span>
            <span className="text-[12px] text-[var(--bz-text-muted)]">{records.length} 条</span>
          </div>
          <div className="p-3">
            {records.map((r, idx) => {
              const actionName = r.action.replace('kill_switch:', '');
              const opConfig = OPERATIONS.find((o) => o.type === actionName);
              const color = opConfig ? SEVERITY_COLOR[opConfig.severity] : 'var(--bz-text-muted)';

              return (
                <div
                  key={r.id}
                  className="flex items-center gap-3 px-3 py-2.5"
                  style={{ borderBottom: idx < records.length - 1 ? '1px solid var(--bz-border)' : 'none' }}
                >
                  <div
                    className="flex h-7 w-7 items-center justify-center rounded shrink-0"
                    style={{ background: `${color}15`, borderRadius: 3 }}
                  >
                    <span style={{ color }}>{opConfig?.icon ?? <Shield className="h-3.5 w-3.5" />}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[13px] font-medium text-[var(--bz-text)]">
                      {opConfig?.label ?? actionName}
                    </div>
                    <div className="text-[12px] text-[var(--bz-text-muted)]">
                      {r.username} · {r.detail.reason ?? ''}
                    </div>
                  </div>
                  <div className="text-[11px] text-[var(--bz-text-muted)] shrink-0">
                    {new Date(r.created_at).toLocaleString('zh-CN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  </div>
                  {r.detail.recoverable && (
                    <span
                      className="text-[10px] px-1.5 py-0.5 rounded shrink-0"
                      style={{ background: 'var(--bz-ok-tint)', color: 'var(--bz-ok)', borderRadius: 2 }}
                    >
                      可恢复
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {confirmOp && (
        <div
          className="fixed inset-0 flex items-center justify-center"
          style={{ background: 'rgba(0,0,0,0.4)', zIndex: 50 }}
          onClick={() => { setConfirmOp(null); setReason(''); }}
        >
          <div
            className="bz-card"
            style={{ borderRadius: 8, padding: 24, width: 440, maxWidth: '90vw' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-2 mb-3">
              <AlertTriangle className="h-5 w-5" style={{ color: 'var(--bz-danger)' }} />
              <h3 className="text-[16px] font-semibold text-[var(--bz-text)]">确认执行</h3>
            </div>
            <p className="text-[13px] text-[var(--bz-text-sub)] mb-4">
              您即将执行 <strong>{confirmOp.label}</strong> 操作。此操作可能影响协作的正常运行，请确认。
            </p>
            <div className="flex flex-col gap-3 mb-4">
              <textarea
                placeholder="执行原因（必填）"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="text-[14px] px-3 py-2 rounded border"
                style={{ borderColor: 'var(--bz-border)', borderRadius: 3, minHeight: 60 }}
              />
              {confirmOp.type === 'STOP_WORKSTREAM' && (
                <input
                  type="text"
                  placeholder="工作线ID"
                  value={scope.workstreamId}
                  onChange={(e) => setScope({ ...scope, workstreamId: e.target.value })}
                  className="text-[14px] px-3 py-2 rounded border"
                  style={{ borderColor: 'var(--bz-border)', borderRadius: 3 }}
                />
              )}
              {confirmOp.type === 'STOP_AGENT' && (
                <input
                  type="text"
                  placeholder="Agent Code"
                  value={scope.agentCode}
                  onChange={(e) => setScope({ ...scope, agentCode: e.target.value })}
                  className="text-[14px] px-3 py-2 rounded border"
                  style={{ borderColor: 'var(--bz-border)', borderRadius: 3 }}
                />
              )}
              {confirmOp.type === 'STOP_RUN' && (
                <input
                  type="text"
                  placeholder="Run ID"
                  value={scope.runId}
                  onChange={(e) => setScope({ ...scope, runId: e.target.value })}
                  className="text-[14px] px-3 py-2 rounded border"
                  style={{ borderColor: 'var(--bz-border)', borderRadius: 3 }}
                />
              )}
            </div>
            <div className="flex items-center justify-end gap-2">
              <button
                className="bz-btn bz-btn-ghost"
                style={{ borderRadius: 3 }}
                onClick={() => { setConfirmOp(null); setReason(''); }}
              >
                取消
              </button>
              <button
                className="bz-btn bz-btn-primary"
                style={{ borderRadius: 3, background: 'var(--bz-danger)' }}
                onClick={handleExecute}
                disabled={executing || !reason.trim()}
              >
                {executing ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                确认执行
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}