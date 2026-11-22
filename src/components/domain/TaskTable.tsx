'use client';

import * as React from 'react';
import { StatusBadge } from './StatusBadge';
import type { Task } from '@/lib/tasks';

type TaskTableProps = {
  tasks: Task[];
  onRowClick?: (task: Task) => void;
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

export function TaskTable({ tasks, onRowClick, className }: TaskTableProps) {
  if (tasks.length === 0) {
    return (
      <div className="bz-card" style={{ borderRadius: 6 }}>
        <div className="p-8 text-center text-[var(--bz-text-muted)] text-[14px]">
          暂无任务
        </div>
      </div>
    );
  }

  return (
    <div className={`bz-card overflow-hidden ${className ?? ''}`} style={{ borderRadius: 6 }}>
      <table className="w-full text-left">
        <thead>
          <tr style={{ borderBottom: '1px solid var(--bz-line)' }}>
            <th className="px-3 py-2.5 text-[12px] font-medium text-[var(--bz-text-muted)]">编号</th>
            <th className="px-3 py-2.5 text-[12px] font-medium text-[var(--bz-text-muted)]">标题</th>
            <th className="px-3 py-2.5 text-[12px] font-medium text-[var(--bz-text-muted)]">状态</th>
            <th className="px-3 py-2.5 text-[12px] font-medium text-[var(--bz-text-muted)]">优先级</th>
            <th className="px-3 py-2.5 text-[12px] font-medium text-[var(--bz-text-muted)]">责任人</th>
            <th className="px-3 py-2.5 text-[12px] font-medium text-[var(--bz-text-muted)]">截止</th>
            <th className="px-3 py-2.5 text-[12px] font-medium text-[var(--bz-text-muted)]">进度</th>
          </tr>
        </thead>
        <tbody>
          {tasks.map((task) => (
            <tr
              key={task.id}
              onClick={() => onRowClick?.(task)}
              className="cursor-pointer transition-colors hover:bg-[#fafcfe]"
              style={{ borderBottom: '1px solid var(--bz-line)' }}
            >
              <td className="px-3 py-2.5 text-[12px] text-[var(--bz-text-muted)] font-mono">
                {task.code}
              </td>
              <td className="px-3 py-2.5 text-[13px] text-[var(--bz-text)] max-w-[280px] truncate">
                {task.title}
              </td>
              <td className="px-3 py-2.5">
                <StatusBadge category="task" status={task.status as never} />
              </td>
              <td className="px-3 py-2.5">
                <span
                  className="text-[12px] font-medium"
                  style={{ color: PRIORITY_COLOR[task.priority] ?? 'var(--bz-text-muted)' }}
                >
                  {PRIORITY_LABEL[task.priority] ?? task.priority}
                </span>
              </td>
              <td className="px-3 py-2.5 text-[12px] text-[var(--bz-text-sub)]">
                {task.assigneeName ?? '未指派'}
              </td>
              <td className="px-3 py-2.5 text-[12px] text-[var(--bz-text-muted)]">
                {task.dueAt ? new Date(task.dueAt).toLocaleDateString('zh-CN') : '—'}
              </td>
              <td className="px-3 py-2.5">
                <div className="flex items-center gap-2">
                  <div
                    className="h-1.5 w-16 rounded-full overflow-hidden"
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
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}