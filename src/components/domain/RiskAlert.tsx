'use client';

import * as React from 'react';

export type RiskAlertData = {
  id: string;
  rule_id: string | null;
  resource_type: string;
  resource_id: string;
  severity: string;
  title: string;
  detail: Record<string, unknown>;
  status: string;
  assignee_id: string | null;
  resolved_at: string | null;
  created_at: string;
};

type RiskAlertProps = {
  alert: RiskAlertData;
  onAck?: (alertId: string) => void;
  onResolve?: (alertId: string, resolution: string) => void;
  onMarkFalsePositive?: (alertId: string, reason: string) => void;
  className?: string;
};

const SEVERITY_LABEL: Record<string, string> = {
  low: '低',
  medium: '中',
  high: '高',
  critical: '严重',
};

const SEVERITY_VARIANT: Record<string, string> = {
  low: 'bz-badge-gray',
  medium: 'bz-badge-blue',
  high: 'bz-badge-warn',
  critical: 'bz-badge-danger',
};

const SEVERITY_COLOR: Record<string, string> = {
  low: 'var(--bz-text-muted)',
  medium: 'var(--bz-info)',
  high: 'var(--bz-warn)',
  critical: 'var(--bz-danger)',
};

const TYPE_LABEL: Record<string, string> = {
  task_overdue: '任务逾期',
  work_anomaly: '工作异常',
  enterprise_risk: '企业风险',
  industry_risk: '行业风险',
  info_change: '信息变更',
};

const STATUS_LABEL: Record<string, string> = {
  open: '待处置',
  acknowledged: '已认领',
  resolved: '已闭环',
  false_positive: '误报',
};

const STATUS_VARIANT: Record<string, string> = {
  open: 'bz-badge-warn',
  acknowledged: 'bz-badge-blue',
  resolved: 'bz-badge-ok',
  false_positive: 'bz-badge-gray',
};

export function RiskAlert({ alert, onAck, onResolve, onMarkFalsePositive, className }: RiskAlertProps) {
  const [showActions, setShowActions] = React.useState(false);
  const [resolutionText, setResolutionText] = React.useState('');
  const [falsePositiveReason, setFalsePositiveReason] = React.useState('');
  const [actionMode, setActionMode] = React.useState<'resolve' | 'false_positive' | null>(null);

  const severityColor = SEVERITY_COLOR[alert.severity] ?? 'var(--bz-text-muted)';
  const detail = alert.detail ?? {};
  const suggestion = (detail['suggestion'] as string) ?? '';
  const evidence = (detail['evidence'] as Array<Record<string, unknown>>) ?? [];

  const handleAck = () => {
    onAck?.(alert.id);
    setShowActions(false);
  };

  const handleResolve = () => {
    onResolve?.(alert.id, resolutionText);
    setActionMode(null);
    setResolutionText('');
    setShowActions(false);
  };

  const handleFalsePositive = () => {
    onMarkFalsePositive?.(alert.id, falsePositiveReason);
    setActionMode(null);
    setFalsePositiveReason('');
    setShowActions(false);
  };

  return (
    <div
      className={`bz-card bz-shadow-soft ${className ?? ''}`}
      style={{ borderRadius: 6, padding: '14px 16px', borderLeft: `3px solid ${severityColor}` }}
    >
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className={`bz-badge ${SEVERITY_VARIANT[alert.severity] ?? 'bz-badge-gray'}`} style={{ fontSize: 11 }}>
            {SEVERITY_LABEL[alert.severity] ?? alert.severity}
          </span>
          <span className="bz-badge bz-badge-blue" style={{ fontSize: 11 }}>
            {TYPE_LABEL[alert.resource_type] ?? alert.resource_type}
          </span>
        </div>
        <span className={`bz-badge ${STATUS_VARIANT[alert.status] ?? 'bz-badge-gray'}`}>
          {STATUS_LABEL[alert.status] ?? alert.status}
        </span>
      </div>

      <p className="text-[14px] font-medium text-[var(--bz-text)] leading-snug mb-2">
        {alert.title}
      </p>

      {suggestion && (
        <p className="text-[12px] text-[var(--bz-text-sub)] leading-relaxed mb-2">
          <span className="font-medium">处理建议: </span>{suggestion}
        </p>
      )}

      {evidence.length > 0 && (
        <div className="mb-2">
          <span className="text-[11px] font-medium text-[var(--bz-text-sub)] mb-1 block">证据</span>
          <div className="flex flex-col gap-1">
            {evidence.slice(0, 3).map((ev, idx) => (
              <div
                key={idx}
                className="text-[11px] px-2 py-1 rounded"
                style={{ background: '#fafcfe', borderRadius: 2 }}
              >
                {typeof ev === 'object' && ev !== null
                  ? (ev['description'] as string ?? JSON.stringify(ev))
                  : String(ev)}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex items-center justify-between text-[12px] text-[var(--bz-text-muted)]">
        <span>
          发生于 {new Date(alert.created_at).toLocaleString('zh-CN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
        </span>
        {alert.assignee_id && (
          <span>负责人: {alert.assignee_id}</span>
        )}
      </div>

      {alert.status === 'open' && (onAck || onResolve || onMarkFalsePositive) && (
        <div className="mt-2">
          {!showActions ? (
            <button
              className="bz-btn bz-btn-primary"
              style={{ fontSize: 12, padding: '4px 12px', borderRadius: 3 }}
              onClick={() => setShowActions(true)}
            >
              认领并处置
            </button>
          ) : (
            <div className="flex flex-col gap-2">
              {!actionMode && (
                <div className="flex items-center gap-2">
                  <button
                    className="bz-btn bz-btn-primary"
                    style={{ fontSize: 12, padding: '4px 12px', borderRadius: 3 }}
                    onClick={handleAck}
                  >
                    认领
                  </button>
                  <button
                    className="bz-btn bz-btn-default"
                    style={{ fontSize: 12, padding: '4px 12px', borderRadius: 3 }}
                    onClick={() => setActionMode('resolve')}
                  >
                    处置
                  </button>
                  <button
                    className="bz-btn bz-btn-default"
                    style={{ fontSize: 12, padding: '4px 12px', borderRadius: 3, color: 'var(--bz-text-muted)' }}
                    onClick={() => setActionMode('false_positive')}
                  >
                    误报
                  </button>
                </div>
              )}

              {actionMode === 'resolve' && (
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    placeholder="处置说明..."
                    value={resolutionText}
                    onChange={(e) => setResolutionText(e.target.value)}
                    className="flex-1 text-[12px] px-2 py-1 rounded border"
                    style={{ borderColor: 'var(--bz-line)', borderRadius: 3 }}
                  />
                  <button
                    className="bz-btn bz-btn-primary"
                    style={{ fontSize: 12, padding: '4px 12px', borderRadius: 3 }}
                    onClick={handleResolve}
                  >
                    确认处置
                  </button>
                  <button
                    className="bz-btn bz-btn-ghost"
                    style={{ fontSize: 12, padding: '4px 8px', borderRadius: 3 }}
                    onClick={() => setActionMode(null)}
                  >
                    取消
                  </button>
                </div>
              )}

              {actionMode === 'false_positive' && (
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    placeholder="误报原因..."
                    value={falsePositiveReason}
                    onChange={(e) => setFalsePositiveReason(e.target.value)}
                    className="flex-1 text-[12px] px-2 py-1 rounded border"
                    style={{ borderColor: 'var(--bz-line)', borderRadius: 3 }}
                  />
                  <button
                    className="bz-btn bz-btn-default"
                    style={{ fontSize: 12, padding: '4px 12px', borderRadius: 3, color: 'var(--bz-text-muted)' }}
                    onClick={handleFalsePositive}
                  >
                    确认误报
                  </button>
                  <button
                    className="bz-btn bz-btn-ghost"
                    style={{ fontSize: 12, padding: '4px 8px', borderRadius: 3 }}
                    onClick={() => setActionMode(null)}
                  >
                    取消
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}