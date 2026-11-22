'use client';

import * as React from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, GitBranch, MessageSquare } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { StatusBadge } from '@/components/domain/StatusBadge';
import { TaskCard } from '@/components/domain/TaskCard';
import type { Task, TaskEvent } from '@/lib/tasks';
import { TASK_STATUS, STATUS_FLOW } from '@/lib/tasks';

type TaskDetail = {
  task: Task;
  events: TaskEvent[];
};

type SubTask = Task;

type Dependency = {
  id: string;
  dependsOnId: string;
  type: string;
  dependsOnTitle?: string;
  dependsOnStatus?: string;
};

export default function TaskDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const taskId = params.id;

  const [detail, setDetail] = React.useState<TaskDetail | null>(null);
  const [subTasks, setSubTasks] = React.useState<SubTask[]>([]);
  const [dependencies, setDependencies] = React.useState<Dependency[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [transitioning, setTransitioning] = React.useState(false);

  React.useEffect(() => {
    loadDetail();
  }, [taskId]);

  async function loadDetail() {
    setLoading(true);
    try {
      const res = await fetch(`/api/v1/tasks/${taskId}`);
      const json = await res.json();
      if (json.code === 0 && json.data) {
        setDetail(json.data);
      }

      const subRes = await fetch(`/api/v1/tasks?limit=100`);
      const subJson = await subRes.json();
      if (subJson.code === 0 && subJson.data) {
        const allTasks = subJson.data.items as Task[];
        setSubTasks(allTasks.filter((t) => t.parentId === taskId));
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }

  async function handleTransition(to: string) {
    setTransitioning(true);
    try {
      const res = await fetch(`/api/v1/tasks/${taskId}/transitions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to }),
      });
      const json = await res.json();
      if (json.code === 0) {
        loadDetail();
      }
    } catch {
      // ignore
    } finally {
      setTransitioning(false);
    }
  }

  if (loading) {
    return (
      <div className="bz-card p-8 text-center text-[14px] text-[var(--bz-text-muted)]" style={{ borderRadius: 6 }}>
        加载中…
      </div>
    );
  }

  if (!detail) {
    return (
      <div className="bz-card p-8 text-center text-[14px] text-[var(--bz-text-muted)]" style={{ borderRadius: 6 }}>
        任务不存在
      </div>
    );
  }

  const { task, events } = detail;
  const availableTransitions = STATUS_FLOW[task.status] ?? [];

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={task.title}
        description={`${task.code} · ${task.module}`}
        actions={
          <button
            onClick={() => router.push('/work/tasks')}
            className="bz-btn bz-btn-ghost text-[13px] flex items-center gap-1"
          >
            <ArrowLeft className="h-4 w-4" />
            返回列表
          </button>
        }
      />

      <div className="grid grid-cols-3 gap-4">
        {/* 左侧：基本信息 + 流转操作 */}
        <div className="col-span-2 flex flex-col gap-4">
          {/* 基本信息 */}
          <div className="bz-card" style={{ borderRadius: 6 }}>
            <div className="bz-card-head">
              <span className="bz-card-title">基本信息</span>
              <StatusBadge category="task" status={task.status} />
            </div>
            <div className="p-4 grid grid-cols-2 gap-3">
              <div>
                <span className="text-[12px] text-[var(--bz-text-muted)]">优先级</span>
                <p className="text-[14px] text-[var(--bz-text)] mt-0.5">{task.priority}</p>
              </div>
              <div>
                <span className="text-[12px] text-[var(--bz-text-muted)]">责任人</span>
                <p className="text-[14px] text-[var(--bz-text)] mt-0.5">{task.assigneeName ?? '未指派'}</p>
              </div>
              <div>
                <span className="text-[12px] text-[var(--bz-text-muted)]">截止时间</span>
                <p className="text-[14px] text-[var(--bz-text)] mt-0.5">
                  {task.dueAt ? new Date(task.dueAt).toLocaleDateString('zh-CN') : '未设定'}
                </p>
              </div>
              <div>
                <span className="text-[12px] text-[var(--bz-text-muted)]">来源</span>
                <p className="text-[14px] text-[var(--bz-text)] mt-0.5">
                  {task.source === 'ai_imported' ? 'AI导入' : task.source === 'ai' ? 'AI创建' : '手动'}
                </p>
              </div>
              <div>
                <span className="text-[12px] text-[var(--bz-text-muted)]">进度</span>
                <div className="flex items-center gap-2 mt-0.5">
                  <div className="h-1.5 w-24 rounded-full overflow-hidden" style={{ background: 'var(--bz-line)' }}>
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${task.progress}%`,
                        background: task.progress === 100 ? 'var(--bz-ok)' : 'var(--bz-brand)',
                      }}
                    />
                  </div>
                  <span className="text-[12px] text-[var(--bz-text-muted)]">{task.progress}%</span>
                </div>
              </div>
              <div>
                <span className="text-[12px] text-[var(--bz-text-muted)]">标签</span>
                <div className="flex items-center gap-1 mt-0.5 flex-wrap">
                  {task.tags.length > 0 ? task.tags.map((tag) => (
                    <span
                      key={tag}
                      className="text-[10px] px-1.5 py-0.5 rounded"
                      style={{ background: 'var(--bz-brand-tint)', color: 'var(--bz-brand)' }}
                    >
                      {tag}
                    </span>
                  )) : '无标签'}
                </div>
              </div>
            </div>

            {task.description && (
              <div className="px-4 pb-4">
                <span className="text-[12px] text-[var(--bz-text-muted)]">描述</span>
                <p className="text-[14px] text-[var(--bz-text)] leading-relaxed mt-1">{task.description}</p>
              </div>
            )}
          </div>

          {/* 状态流转操作 */}
          <div className="bz-card" style={{ borderRadius: 6 }}>
            <div className="bz-card-head">
              <span className="bz-card-title">状态流转</span>
            </div>
            <div className="p-4 flex items-center gap-2">
              <StatusBadge category="task" status={task.status} />
              <span className="text-[12px] text-[var(--bz-text-muted)]">→</span>
              {availableTransitions.length > 0 ? (
                availableTransitions.map((to) => (
                  <button
                    key={to}
                    onClick={() => handleTransition(to)}
                    disabled={transitioning}
                    className="bz-btn bz-btn-ghost text-[12px]"
                  >
                    {TASK_STATUS[to].label}
                  </button>
                ))
              ) : (
                <span className="text-[12px] text-[var(--bz-text-muted)]">无可流转状态</span>
              )}
            </div>
          </div>

          {/* 子任务 */}
          {subTasks.length > 0 && (
            <div className="bz-card" style={{ borderRadius: 6 }}>
              <div className="bz-card-head">
                <span className="bz-card-title">子任务（{subTasks.length}）</span>
              </div>
              <div className="p-3 grid grid-cols-2 gap-2">
                {subTasks.map((sub) => (
                  <TaskCard
                    key={sub.id}
                    task={sub}
                    onClick={() => router.push(`/work/tasks/${sub.id}`)}
                  />
                ))}
              </div>
            </div>
          )}
        </div>

        {/* 右侧：流转记录 */}
        <div className="col-span-1 flex flex-col gap-4">
          <div className="bz-card" style={{ borderRadius: 6 }}>
            <div className="bz-card-head">
              <span className="bz-card-title flex items-center gap-1.5">
                <MessageSquare className="h-4 w-4" />
                流转记录
              </span>
            </div>
            <div className="p-3">
              {events.length === 0 ? (
                <div className="text-center py-4 text-[12px] text-[var(--bz-text-muted)]">暂无记录</div>
              ) : (
                <div className="flex flex-col gap-0">
                  {events.map((event, idx) => (
                    <div
                      key={event.id}
                      className="py-2.5 px-2"
                      style={{
                        borderBottom: idx < events.length - 1 ? '1px solid var(--bz-line)' : 'none',
                      }}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-[12px] font-medium text-[var(--bz-text)]">
                          {event.action === 'create' ? '创建' :
                           event.action === 'transition' ? '流转' :
                           event.action === 'reopen' ? '重新开启' :
                           event.action === 'assign' ? '指派' : event.action}
                        </span>
                        {event.fromStatus && event.toStatus && (
                          <div className="flex items-center gap-1">
                            <StatusBadge category="task" status={event.fromStatus as never} />
                            <span className="text-[10px] text-[var(--bz-text-muted)]">→</span>
                            <StatusBadge category="task" status={event.toStatus as never} />
                          </div>
                        )}
                      </div>
                      {event.note && (
                        <p className="text-[12px] text-[var(--bz-text-sub)] leading-relaxed">{event.note}</p>
                      )}
                      <div className="flex items-center justify-between mt-1">
                        <span className="text-[11px] text-[var(--bz-text-muted)]">
                          {event.actorName ?? '系统'}
                        </span>
                        <span className="text-[11px] text-[var(--bz-text-muted)]">
                          {new Date(event.createdAt).toLocaleString('zh-CN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* 依赖关系 */}
          <div className="bz-card" style={{ borderRadius: 6 }}>
            <div className="bz-card-head">
              <span className="bz-card-title flex items-center gap-1.5">
                <GitBranch className="h-4 w-4" />
                依赖关系
              </span>
            </div>
            <div className="p-3">
              {dependencies.length === 0 ? (
                <div className="text-center py-4 text-[12px] text-[var(--bz-text-muted)]">暂无依赖</div>
              ) : (
                <div className="flex flex-col gap-2">
                  {dependencies.map((dep) => (
                    <div
                      key={dep.id}
                      className="rounded px-3 py-2"
                      style={{ background: 'var(--bz-bg)', borderRadius: 6, border: '1px solid var(--bz-line)' }}
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-[12px] text-[var(--bz-text)]">
                          {dep.dependsOnTitle ?? dep.dependsOnId}
                        </span>
                        {dep.dependsOnStatus && (
                          <StatusBadge category="task" status={dep.dependsOnStatus as never} />
                        )}
                      </div>
                      <span className="text-[11px] text-[var(--bz-text-muted)]">{dep.type}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}