'use client';

import * as React from 'react';
import { StatusBadge } from './StatusBadge';
import type { Task } from '@/lib/tasks';

type TaskCardProps = {
  task: Task;
  onClick?: (task: Task) => void;
  className?: string;
};

const PRIORITY_LABEL: Record<string, string> = {
  P0: '紧急',
  P1: '高',
  P2: '中',
  P3: '低',
};

const PRIORITY_COLOR: Record<string, string> = {
  P0: 'var(--bz-danger)',
  P1: 'var(--bz-warn)',
  P2: 'var(--bz-text-muted)',
  P3: 'var(--bz-text-muted)',
};

export function TaskCard({ task, onClick, className }: TaskCardProps) {
  return (
    <div
      onClick={() => onClick?.(task)}
      className={`bz-card bz-shadow-soft bz-hover-lift cursor-pointer ${className ?? ''}`}
      style={{ borderRadius: 6, padding: '14px 16px' }}
    >
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="text-[11px] text-[var(--bz-text-muted)] font-mono">{task.code}</span>
          <StatusBadge category="task" status={task.status} />
        </div>
        <span
          className="text-[11px] font-medium"
          style={{ color: PRIORITY_COLOR[task.priority] ?? 'var(--bz-text-muted)' }}
        >
          {PRIORITY_LABEL[task.priority] ?? task.priority}
        </span>
      </div>

      <p className="text-[14px] font-medium text-[var(--bz-text)] leading-snug mb-2">
        {task.title}
      </p>

      {task.description && (
        <p className="text-[12px] text-[var(--bz-text-sub)] leading-relaxed line-clamp-2 mb-2">
          {task.description}
        </p>
      )}

      <div className="flex items-center justify-between text-[12px]">
        <span className="text-[var(--bz-text-muted)]">
          {task.assigneeName ?? '未指派'}
        </span>
        {task.dueAt && (
          <span className="text-[var(--bz-text-muted)]">
            截止 {new Date(task.dueAt).toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' })}
          </span>
        )}
      </div>

      {task.tags.length > 0 && (
        <div className="flex items-center gap-1 mt-2 flex-wrap">
          {task.tags.map((tag) => (
            <span
              key={tag}
              className="text-[10px] px-1.5 py-0.5 rounded"
              style={{ background: 'var(--bz-brand-tint)', color: 'var(--bz-brand)' }}
            >
              {tag}
            </span>
          ))}
        </div>
      )}

      {task.progress > 0 && (
        <div className="flex items-center gap-2 mt-2">
          <div
            className="h-1.5 flex-1 rounded-full overflow-hidden"
            style={{ background: 'var(--bz-line)' }}
          >
            <div
              className="h-full rounded-full"
              style={{
                width: `${task.progress}%`,
                background: task.progress === 100 ? 'var(--bz-ok)' : 'var(--bz-brand)',
              }}
            />
          </div>
          <span className="text-[11px] text-[var(--bz-text-muted)]">{task.progress}%</span>
        </div>
      )}
    </div>
  );
}