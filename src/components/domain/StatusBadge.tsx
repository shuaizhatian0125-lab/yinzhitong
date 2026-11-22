import * as React from 'react';
import { cn } from '@/lib/utils';

type StatusCategory = 'task' | 'ai_run' | 'risk_alert';

type StatusValue =
  | 'draft'
  | 'pending'
  | 'in_progress'
  | 'completed'
  | 'done'
  | 'cancelled'
  | 'blocked'
  | 'approved'
  | 'rejected'
  | 'warning'
  | 'critical';

const STATUS_MAP: Record<StatusCategory, Record<StatusValue, { label: string; variant: string }>> = {
  task: {
    draft: { label: '草稿', variant: 'gray' },
    pending: { label: '待处理', variant: 'blue' },
    in_progress: { label: '进行中', variant: 'blue' },
    completed: { label: '已完成', variant: 'green' },
    done: { label: '已完成', variant: 'green' },
    cancelled: { label: '已取消', variant: 'red' },
    blocked: { label: '阻塞', variant: 'yellow' },
    approved: { label: '已审批', variant: 'green' },
    rejected: { label: '已驳回', variant: 'red' },
    warning: { label: '预警', variant: 'yellow' },
    critical: { label: '严重', variant: 'red' },
  },
  ai_run: {
    draft: { label: '草稿', variant: 'gray' },
    pending: { label: '排队中', variant: 'blue' },
    in_progress: { label: '运行中', variant: 'blue' },
    completed: { label: '已完成', variant: 'green' },
    done: { label: '已完成', variant: 'green' },
    cancelled: { label: '已取消', variant: 'red' },
    blocked: { label: '阻塞', variant: 'yellow' },
    approved: { label: '已确认', variant: 'green' },
    rejected: { label: '已驳回', variant: 'red' },
    warning: { label: '预警', variant: 'yellow' },
    critical: { label: '严重', variant: 'red' },
  },
  risk_alert: {
    draft: { label: '草稿', variant: 'gray' },
    pending: { label: '待处置', variant: 'blue' },
    in_progress: { label: '处置中', variant: 'blue' },
    completed: { label: '已闭环', variant: 'green' },
    done: { label: '已闭环', variant: 'green' },
    cancelled: { label: '已忽略', variant: 'red' },
    blocked: { label: '阻塞', variant: 'yellow' },
    approved: { label: '已审批', variant: 'green' },
    rejected: { label: '已驳回', variant: 'red' },
    warning: { label: '预警', variant: 'yellow' },
    critical: { label: '严重', variant: 'red' },
  },
};

const VARIANT_CLASS: Record<string, string> = {
  gray: 'bz-badge-gray',
  blue: 'bz-badge-blue',
  green: 'bz-badge-ok',
  red: 'bz-badge-danger',
  yellow: 'bz-badge-warn',
};

type StatusBadgeProps = {
  category: StatusCategory;
  status: StatusValue;
  className?: string;
};

export function StatusBadge({ category, status, className }: StatusBadgeProps) {
  const config = STATUS_MAP[category]?.[status];
  if (!config) return null;

  return (
    <span className={cn('bz-badge', VARIANT_CLASS[config.variant], className)}>
      {config.label}
    </span>
  );
}