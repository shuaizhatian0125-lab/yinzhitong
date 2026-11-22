'use client';

import * as React from 'react';
import { StatusBadge } from './StatusBadge';
import type { Task, TaskStatus } from '@/lib/tasks';
import { TASK_STATUS } from '@/lib/tasks';

type TaskBoardProps = {
  tasks: Task[];
  onCardClick?: (task: Task) => void;
  className?: string;
};

const COLUMN_ORDER: TaskStatus[] = ['draft', 'pending', 'in_progress', 'blocked', 'done', 'cancelled'];

export function TaskBoard({ tasks, onCardClick, className }: TaskBoardProps) {
  const columns = React.useMemo(() => {
    const map: Record<TaskStatus, Task[]> = {
      draft: [],
      pending: [],
      in_progress: [],
      blocked: [],
      done: [],
      cancelled: [],
    };
    for (const task of tasks) {
      if (map[task.status]) map[task.status].push(task);
    }
    return map;
  }, [tasks]);

  return (
    <div className={`grid grid-cols-6 gap-3 ${className ?? ''}`}>
      {COLUMN_ORDER.map((status) => (
        <div
          key={status}
          className="flex flex-col gap-2 rounded-[8px]"
          style={{ minHeight: 200 }}
        >
          <div className="flex items-center justify-between px-2 py-1.5">
            <span className="text-[13px] font-medium text-[var(--bz-text)]">
              {TASK_STATUS[status].label}
            </span>
            <span className="text-[12px] text-[var(--bz-text-muted)]">
              {columns[status].length}
            </span>
          </div>

          <div className="flex flex-col gap-2">
            {columns[status].map((task) => (
              <div
                key={task.id}
                onClick={() => onCardClick?.(task)}
                className="bz-card bz-shadow-soft cursor-pointer transition-colors hover:border-[var(--bz-brand)]"
                style={{ borderRadius: 6, padding: '10px 12px' }}
              >
                <div className="flex items-center gap-1.5 mb-1">
                  <span className="text-[11px] text-[var(--bz-text-muted)] font-mono">{task.code}</span>
                  <StatusBadge category="task" status={task.status} />
                </div>
                <p className="text-[13px] text-[var(--bz-text)] leading-snug line-clamp-2 mb-1">
                  {task.title}
                </p>
                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-[var(--bz-text-muted)]">
                    {task.assigneeName ?? '未指派'}
                  </span>
                  {task.dueAt && (
                    <span className="text-[11px] text-[var(--bz-text-muted)]">
                      {new Date(task.dueAt).toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' })}
                    </span>
                  )}
                </div>
                {task.progress > 0 && task.progress < 100 && (
                  <div
                    className="h-1 w-full rounded-full overflow-hidden mt-1.5"
                    style={{ background: 'var(--bz-line)' }}
                  >
                    <div
                      className="h-full rounded-full"
                      style={{ width: `${task.progress}%`, background: 'var(--bz-brand)' }}
                    />
                  </div>
                )}
              </div>
            ))}

            {columns[status].length === 0 && (
              <div
                className="rounded text-center py-4 text-[12px] text-[var(--bz-text-muted)]"
                style={{ background: 'var(--bz-bg)', borderRadius: 3 }}
              >
                无任务
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}