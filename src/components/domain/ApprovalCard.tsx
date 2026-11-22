'use client';

import * as React from 'react';

export type Approval = {
  id: string;
  instance_id: string | null;
  node_key: string | null;
  business_type: string;
  business_id: string;
  approver_id: string;
  decision: string;
  comment: string | null;
  decided_at: string | null;
  created_at: string;
};

type ApprovalCardProps = {
  approval: Approval;
  onDecide?: (approvalId: string, decision: 'approved' | 'rejected') => void;
  className?: string;
};

const DECISION_LABEL: Record<string, string> = {
  pending: '待审批',
  approved: '已同意',
  rejected: '已驳回',
};

const DECISION_VARIANT: Record<string, string> = {
  pending: 'bz-badge-warn',
  approved: 'bz-badge-ok',
  rejected: 'bz-badge-danger',
};

const BUSINESS_TYPE_LABEL: Record<string, string> = {
  workflow: '流程审批',
  document: '文档审批',
  task: '任务审批',
};

export function ApprovalCard({ approval, onDecide, className }: ApprovalCardProps) {
  const [comment, setComment] = React.useState('');
  const [submitting, setSubmitting] = React.useState(false);

  const handleDecide = (decision: 'approved' | 'rejected') => {
    setSubmitting(true);
    onDecide?.(approval.id, decision);
    setSubmitting(false);
  };

  return (
    <div
      className={`bz-card bz-shadow-soft ${className ?? ''}`}
      style={{ borderRadius: 6, padding: '14px 16px' }}
    >
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="bz-badge bz-badge-blue" style={{ fontSize: 11 }}>
            {BUSINESS_TYPE_LABEL[approval.business_type] ?? approval.business_type}
          </span>
          {approval.node_key && (
            <span className="text-[11px] text-[var(--bz-text-muted)] font-mono">
              {approval.node_key}
            </span>
          )}
        </div>
        <span className={`bz-badge ${DECISION_VARIANT[approval.decision] ?? 'bz-badge-gray'}`}>
          {DECISION_LABEL[approval.decision] ?? approval.decision}
        </span>
      </div>

      <div className="flex items-center justify-between text-[12px] text-[var(--bz-text-muted)] mb-2">
        <span>
          提交于 {new Date(approval.created_at).toLocaleString('zh-CN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
        </span>
        {approval.decided_at && (
          <span>
            处理于 {new Date(approval.decided_at).toLocaleString('zh-CN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
          </span>
        )}
      </div>

      {approval.comment && (
        <p className="text-[12px] text-[var(--bz-text-sub)] leading-relaxed mb-2 px-2 py-1 rounded" style={{ background: '#fafcfe' }}>
          {approval.comment}
        </p>
      )}

      {approval.decision === 'pending' && onDecide && (
        <div className="flex items-center gap-2 mt-2">
          <input
            type="text"
            placeholder="审批意见..."
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            className="flex-1 text-[12px] px-2 py-1 rounded border"
            style={{ borderColor: 'var(--bz-line)', borderRadius: 3 }}
          />
          <button
            className="bz-btn bz-btn-primary"
            style={{ fontSize: 12, padding: '4px 12px', borderRadius: 3 }}
            onClick={() => handleDecide('approved')}
            disabled={submitting}
          >
            同意
          </button>
          <button
            className="bz-btn bz-btn-default"
            style={{ fontSize: 12, padding: '4px 12px', borderRadius: 3, color: 'var(--bz-danger)' }}
            onClick={() => handleDecide('rejected')}
            disabled={submitting}
          >
            驳回
          </button>
        </div>
      )}
    </div>
  );
}