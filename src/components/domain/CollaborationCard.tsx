'use client';

import * as React from 'react';
import { StatusBadge } from './StatusBadge';

export type Collaboration = {
  id: string;
  code: string;
  title: string;
  type: string;
  description: string | null;
  owner_id: string | null;
  status: string;
  created_at: string;
  updated_at: string;
};

type CollaborationCardProps = {
  collaboration: Collaboration;
  onClick?: (collaboration: Collaboration) => void;
  className?: string;
};

const TYPE_LABEL: Record<string, string> = {
  project: '项目',
  task: '任务',
  meeting: '会议',
  review: '评审',
};

const COLLAB_STATUS_MAP: Record<string, { label: string; variant: string }> = {
  active: { label: '进行中', variant: 'blue' },
  completed: { label: '已完成', variant: 'green' },
  archived: { label: '已归档', variant: 'gray' },
  cancelled: { label: '已取消', variant: 'red' },
};

export function CollaborationCard({ collaboration, onClick, className }: CollaborationCardProps) {
  const statusConfig = COLLAB_STATUS_MAP[collaboration.status] ?? { label: collaboration.status, variant: 'gray' };

  return (
    <div
      onClick={() => onClick?.(collaboration)}
      className={`bz-card bz-shadow-soft bz-hover-lift cursor-pointer ${className ?? ''}`}
      style={{ borderRadius: 6, padding: '14px 16px' }}
    >
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="text-[11px] text-[var(--bz-text-muted)] font-mono">{collaboration.code}</span>
          <span className="bz-badge bz-badge-blue" style={{ fontSize: 11 }}>
            {TYPE_LABEL[collaboration.type] ?? collaboration.type}
          </span>
        </div>
        <span className={`bz-badge ${statusConfig.variant === 'blue' ? 'bz-badge-blue' : statusConfig.variant === 'green' ? 'bz-badge-ok' : statusConfig.variant === 'red' ? 'bz-badge-danger' : 'bz-badge-gray'}`}>
          {statusConfig.label}
        </span>
      </div>

      <p className="text-[14px] font-medium text-[var(--bz-text)] leading-snug mb-2">
        {collaboration.title}
      </p>

      {collaboration.description && (
        <p className="text-[12px] text-[var(--bz-text-sub)] leading-relaxed line-clamp-2 mb-2">
          {collaboration.description}
        </p>
      )}

      <div className="flex items-center justify-between text-[12px] text-[var(--bz-text-muted)]">
        <span>
          创建于 {new Date(collaboration.created_at).toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' })}
        </span>
        <span>
          更新于 {new Date(collaboration.updated_at).toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' })}
        </span>
      </div>
    </div>
  );
}