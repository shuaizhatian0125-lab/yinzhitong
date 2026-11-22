'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { LayoutGrid, Table as TableIcon, Plus, Search } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { TaskTable } from '@/components/domain/TaskTable';
import { TaskBoard } from '@/components/domain/TaskBoard';
import type { Task } from '@/lib/tasks';
import { TASK_STATUS } from '@/lib/tasks';

type FilterStatus = 'all' | keyof typeof TASK_STATUS;

export default function TasksPage() {
  const router = useRouter();
  const [tasks, setTasks] = React.useState<Task[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [view, setView] = React.useState<'table' | 'board'>('table');
  const [statusFilter, setStatusFilter] = React.useState<FilterStatus>('all');
  const [mineOnly, setMineOnly] = React.useState(false);
  const [keyword, setKeyword] = React.useState('');

  React.useEffect(() => {
    loadTasks();
  }, [statusFilter, mineOnly, keyword]);

  async function loadTasks() {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter !== 'all') params.set('status', statusFilter);
      if (mineOnly) params.set('mine', 'true');
      if (keyword) params.set('keyword', keyword);

      const res = await fetch(`/api/v1/tasks?${params.toString()}`);
      const json = await res.json();
      if (json.code === 0 && json.data) {
        setTasks(json.data.items ?? []);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }

  const filteredTasks = React.useMemo(() => {
    if (statusFilter === 'all') return tasks;
    return tasks.filter((t) => t.status === statusFilter);
  }, [tasks, statusFilter]);

  return (
    <div className="flex flex-col gap-4 md:gap-6">
      <PageHeader
        title="任务中心"
        description="任务全生命周期管理：创建、分派、流转、留痕"
        actions={
          <button
            onClick={() => router.push('/work/tasks/new')}
            className="bz-btn bz-btn-primary text-[13px] flex items-center gap-1"
          >
            <Plus className="h-4 w-4" />
            新建任务
          </button>
        }
      />

      {/* 筛选栏 */}
      <div className="bz-card flex flex-wrap items-center gap-2 md:gap-3 px-3 py-3 md:px-4" style={{ borderRadius: 6 }}>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setView('table')}
            className={`p-2 md:p-1.5 rounded min-h-[44px] min-w-[44px] flex items-center justify-center ${view === 'table' ? 'bg-[var(--bz-brand-tint)]' : ''}`}
            title="表格视图"
          >
            <TableIcon className="h-4 w-4" style={{ color: view === 'table' ? 'var(--bz-brand)' : 'var(--bz-text-muted)' }} />
          </button>
          <button
            onClick={() => setView('board')}
            className={`p-2 md:p-1.5 rounded min-h-[44px] min-w-[44px] flex items-center justify-center ${view === 'board' ? 'bg-[var(--bz-brand-tint)]' : ''}`}
            title="看板视图"
          >
            <LayoutGrid className="h-4 w-4" style={{ color: view === 'board' ? 'var(--bz-brand)' : 'var(--bz-text-muted)' }} />
          </button>
        </div>

        <div className="h-5 w-px" style={{ background: 'var(--bz-line)' }} />

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as FilterStatus)}
          className="text-[13px] px-2 py-1.5 md:py-1 rounded outline-none min-h-[44px]"
          style={{ background: 'var(--bz-bg)', border: '1px solid var(--bz-line)', borderRadius: 6 }}
        >
          <option value="all">全部状态</option>
          <option value="draft">草稿</option>
          <option value="pending">待处理</option>
          <option value="in_progress">进行中</option>
          <option value="blocked">受阻</option>
          <option value="done">已完成</option>
          <option value="cancelled">已取消</option>
        </select>

        <label className="flex items-center gap-1.5 text-[13px] text-[var(--bz-text)] cursor-pointer">
          <input
            type="checkbox"
            checked={mineOnly}
            onChange={(e) => setMineOnly(e.target.checked)}
            className="accent-[var(--bz-brand)]"
          />
          仅我的
        </label>

        <div className="flex items-center gap-1.5 flex-1 min-w-[160px] md:max-w-[240px]">
          <Search className="h-3.5 w-3.5 text-[var(--bz-text-muted)]" />
          <input
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            placeholder="搜索任务标题…"
            className="flex-1 bg-transparent text-[13px] outline-none placeholder:text-[var(--bz-text-muted)]"
          />
        </div>
      </div>

      {/* 内容区 */}
      {loading ? (
        <div className="bz-card p-8 text-center text-[14px] text-[var(--bz-text-muted)]" style={{ borderRadius: 6 }}>
          加载中…
        </div>
      ) : view === 'table' ? (
        <TaskTable
          tasks={filteredTasks}
          onRowClick={(task) => router.push(`/work/tasks/${task.id}`)}
        />
      ) : (
        <TaskBoard
          tasks={filteredTasks}
          onCardClick={(task) => router.push(`/work/tasks/${task.id}`)}
        />
      )}
    </div>
  );
}