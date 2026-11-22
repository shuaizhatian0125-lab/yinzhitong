'use client';

import * as React from 'react';
import { useParams } from 'next/navigation';
import {
  Loader2, Plus, Flag, Circle, CheckCircle2, AlertCircle,
} from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';

type Workstream = {
  id: string;
  name: string;
  phase: string;
  objectives: string[];
  status: string;
  progress: number;
  dependencies: string[];
  milestone: { name: string; checkDate: string | null; checkResult: { passed: boolean } | null } | null;
};

type Phase = {
  id: string;
  name: string;
  sequence: number;
  workstreams: Workstream[];
};

const STATUS_ICON: Record<string, React.ReactNode> = {
  PLANNED: <Circle className="h-4 w-4" style={{ color: 'var(--bz-text-muted)' }} />,
  ACTIVE: <Loader2 className="h-4 w-4 animate-spin" style={{ color: 'var(--bz-info)' }} />,
  PAUSED: <AlertCircle className="h-4 w-4" style={{ color: 'var(--bz-warn)' }} />,
  COMPLETED: <CheckCircle2 className="h-4 w-4" style={{ color: 'var(--bz-ok)' }} />,
  FAILED: <AlertCircle className="h-4 w-4" style={{ color: 'var(--bz-danger)' }} />,
};

const STATUS_LABEL: Record<string, string> = {
  PLANNED: '计划中',
  ACTIVE: '进行中',
  PAUSED: '已暂停',
  COMPLETED: '已完成',
  FAILED: '已失败',
};

export default function WorkstreamsPage() {
  const params = useParams();
  const collaborationId = params.id as string;
  const [phases, setPhases] = React.useState<Phase[]>([]);
  const [workstreams, setWorkstreams] = React.useState<Workstream[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [showCreate, setShowCreate] = React.useState(false);
  const [createForm, setCreateForm] = React.useState({ name: '', phase: '', objectives: '' });

  const fetchWorkstreams = React.useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/v1/collaborations/${collaborationId}/workstreams`);
      const json = await res.json();
      if (json.code === 0 && json.data) {
        setWorkstreams(json.data.workstreams ?? []);
        setPhases(json.data.phases ?? []);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [collaborationId]);

  React.useEffect(() => {
    fetchWorkstreams();
  }, [fetchWorkstreams]);

  const handleCreate = async () => {
    if (!createForm.name.trim() || !createForm.phase.trim()) return;
    try {
      const objectives = createForm.objectives
        .split('\n')
        .map((s) => s.trim())
        .filter((s) => s.length > 0);

      await fetch(`/api/v1/collaborations/${collaborationId}/workstreams`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: createForm.name,
          phase: createForm.phase,
          objectives,
        }),
      });
      setShowCreate(false);
      setCreateForm({ name: '', phase: '', objectives: '' });
      fetchWorkstreams();
    } catch {
      // ignore
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="工作线管理"
        description="工作线阶段、状态与进度跟踪"
        actions={
          <button
            className="bz-btn bz-btn-primary"
            style={{ borderRadius: 3 }}
            onClick={() => setShowCreate(true)}
          >
            <Plus className="h-4 w-4" />
            创建工作线
          </button>
        }
      />

      {loading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-5 w-5 animate-spin text-[var(--bz-text-muted)]" />
        </div>
      )}

      {!loading && workstreams.length === 0 && (
        <div className="text-center text-[var(--bz-text-muted)] py-12">
          暂无工作线数据
        </div>
      )}

      {!loading && phases.length > 0 && phases.map((phase) => (
        <div key={phase.id} className="bz-card" style={{ borderRadius: 8 }}>
          <div className="bz-card-head">
            <span className="bz-card-title">{phase.name}</span>
            <span className="text-[12px] text-[var(--bz-text-muted)]">{phase.workstreams.length} 项</span>
          </div>
          <div className="p-3">
            {phase.workstreams.map((ws, idx) => (
              <div
                key={ws.id}
                className="flex items-center gap-3 px-3 py-2.5"
                style={{ borderBottom: idx < phase.workstreams.length - 1 ? '1px solid var(--bz-border)' : 'none' }}
              >
                {STATUS_ICON[ws.status] ?? <Circle className="h-4 w-4" />}

                <div className="flex-1 min-w-0">
                  <div className="text-[14px] font-medium text-[var(--bz-text)] truncate">{ws.name}</div>
                  <div className="text-[12px] text-[var(--bz-text-muted)]">
                    {STATUS_LABEL[ws.status] ?? ws.status}
                    {ws.objectives.length > 0 && ` · ${ws.objectives.length} 个目标`}
                  </div>
                </div>

                {ws.milestone && (
                  <div className="flex items-center gap-1 shrink-0">
                    <Flag
                      className="h-3 w-3"
                      style={{ color: ws.milestone.checkResult?.passed ? 'var(--bz-ok)' : 'var(--bz-gold)' }}
                    />
                    <span className="text-[11px] text-[var(--bz-text-muted)]">{ws.milestone.name}</span>
                  </div>
                )}

                <div className="w-24 shrink-0">
                  <div className="h-1 rounded-full overflow-hidden" style={{ background: 'var(--bz-border)' }}>
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${ws.progress}%`,
                        background: ws.progress === 100 ? 'var(--bz-ok)' : 'var(--bz-info)',
                      }}
                    />
                  </div>
                  <div className="text-[10px] text-[var(--bz-text-muted)] text-center mt-0.5">{ws.progress}%</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}

      {showCreate && (
        <div
          className="fixed inset-0 flex items-center justify-center"
          style={{ background: 'rgba(0,0,0,0.3)', zIndex: 50 }}
          onClick={() => setShowCreate(false)}
        >
          <div
            className="bz-card"
            style={{ borderRadius: 8, padding: 20, width: 440, maxWidth: '90vw' }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-[16px] font-semibold text-[var(--bz-text)] mb-4">创建工作线</h3>
            <div className="flex flex-col gap-3">
              <input
                type="text"
                placeholder="工作线名称"
                value={createForm.name}
                onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
                className="text-[14px] px-3 py-2 rounded border"
                style={{ borderColor: 'var(--bz-border)', borderRadius: 3 }}
              />
              <input
                type="text"
                placeholder="阶段（如 Phase 1）"
                value={createForm.phase}
                onChange={(e) => setCreateForm({ ...createForm, phase: e.target.value })}
                className="text-[14px] px-3 py-2 rounded border"
                style={{ borderColor: 'var(--bz-border)', borderRadius: 3 }}
              />
              <textarea
                placeholder="目标（每行一个）"
                value={createForm.objectives}
                onChange={(e) => setCreateForm({ ...createForm, objectives: e.target.value })}
                className="text-[14px] px-3 py-2 rounded border"
                style={{ borderColor: 'var(--bz-border)', borderRadius: 3, minHeight: 80 }}
              />
              <div className="flex items-center justify-end gap-2 mt-2">
                <button
                  className="bz-btn bz-btn-ghost"
                  style={{ borderRadius: 3 }}
                  onClick={() => setShowCreate(false)}
                >
                  取消
                </button>
                <button
                  className="bz-btn bz-btn-primary"
                  style={{ borderRadius: 3 }}
                  onClick={handleCreate}
                  disabled={!createForm.name.trim() || !createForm.phase.trim()}
                >
                  创建
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}