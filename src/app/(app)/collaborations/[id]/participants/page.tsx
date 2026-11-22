'use client';

import * as React from 'react';
import { useParams } from 'next/navigation';
import { Loader2, UserPlus, Trash2, UserCog } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';

type Participant = {
  id: string;
  nativeEntityId: string | null;
  participantType: string;
  role: string;
  status: string;
  joinedAt: string;
};

const PARTICIPANT_TYPE_LABEL: Record<string, string> = {
  HUMAN: '人员',
  AI_AGENT: 'AI Agent',
  DEPARTMENT: '部门',
  EXTERNAL: '外部',
};

const ROLE_LABEL: Record<string, string> = {
  OWNER: '所有者',
  COORDINATOR: '协调者',
  LEADER: '负责人',
  CONTRIBUTOR: '贡献者',
  REVIEWER: '评审者',
  APPROVER: '审批者',
  OBSERVER: '观察者',
  EXECUTOR: '执行者',
  ADVISOR: '顾问',
  STAKEHOLDER: '利益相关方',
  RESEARCHER: '研究员',
  ANALYST: '分析师',
};

const ROLE_OPTIONS = Object.entries(ROLE_LABEL).map(([value, label]) => ({ value, label }));
const TYPE_OPTIONS = Object.entries(PARTICIPANT_TYPE_LABEL).map(([value, label]) => ({ value, label }));

export default function ParticipantsPage() {
  const params = useParams();
  const collaborationId = params.id as string;
  const [participants, setParticipants] = React.useState<Participant[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [showAdd, setShowAdd] = React.useState(false);
  const [addForm, setAddForm] = React.useState({ user_id: '', role: 'CONTRIBUTOR' });

  const fetchParticipants = React.useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/v1/collaborations/${collaborationId}/members`);
      const json = await res.json();
      if (json.code === 0 && json.data) {
        setParticipants(json.data.items ?? []);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [collaborationId]);

  React.useEffect(() => {
    fetchParticipants();
  }, [fetchParticipants]);

  const handleAdd = async () => {
    if (!addForm.user_id.trim()) return;
    try {
      const res = await fetch(`/api/v1/collaborations/${collaborationId}/members`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: addForm.user_id,
          role: addForm.role,
        }),
      });
      const json = await res.json();
      if (json.code === 0) {
        setShowAdd(false);
        setAddForm({ user_id: '', role: 'CONTRIBUTOR' });
        fetchParticipants();
      }
    } catch {
      // ignore
    }
  };

  const handleRemove = async (userId: string) => {
    try {
      await fetch(`/api/v1/collaborations/${collaborationId}/members?user_id=${userId}`, {
        method: 'DELETE',
      });
      setParticipants((prev) => prev.filter((p) => p.nativeEntityId !== userId));
    } catch {
      // ignore
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="参与者管理"
        description="协作参与者类型与角色管理"
        actions={
          <button
            className="bz-btn bz-btn-primary"
            style={{ borderRadius: 3 }}
            onClick={() => setShowAdd(true)}
          >
            <UserPlus className="h-4 w-4" />
            添加参与者
          </button>
        }
      />

      {loading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-5 w-5 animate-spin text-[var(--bz-text-muted)]" />
        </div>
      )}

      {!loading && participants.length === 0 && (
        <div className="text-center text-[var(--bz-text-muted)] py-12">
          暂无参与者
        </div>
      )}

      {!loading && participants.length > 0 && (
        <div className="bz-card" style={{ borderRadius: 8 }}>
          <div className="p-3">
            {participants.map((p, idx) => (
              <div
                key={p.id}
                className="flex items-center gap-3 px-3 py-2.5"
                style={{ borderBottom: idx < participants.length - 1 ? '1px solid var(--bz-border)' : 'none' }}
              >
                <div
                  className="flex h-8 w-8 items-center justify-center rounded shrink-0"
                  style={{
                    borderRadius: 3,
                    background: p.participantType === 'AI_AGENT' ? 'var(--bz-brand-tint)' : 'var(--bz-info-tint)',
                  }}
                >
                  <UserCog
                    className="h-4 w-4"
                    style={{ color: p.participantType === 'AI_AGENT' ? 'var(--bz-brand)' : 'var(--bz-info)' }}
                  />
                </div>

                <div className="flex-1 min-w-0">
                  <div className="text-[14px] font-medium text-[var(--bz-text)] truncate">
                    {p.nativeEntityId ?? '未知'}
                  </div>
                  <div className="text-[12px] text-[var(--bz-text-muted)]">
                    {PARTICIPANT_TYPE_LABEL[p.participantType] ?? p.participantType}
                    {' · '}
                    {ROLE_LABEL[p.role] ?? p.role}
                    {' · '}
                    {p.status === 'active' ? '活跃' : p.status}
                  </div>
                </div>

                <button
                  onClick={() => p.nativeEntityId && handleRemove(p.nativeEntityId)}
                  className="p-1 rounded hover:bg-[var(--bz-border)]"
                  style={{ borderRadius: 2 }}
                >
                  <Trash2 className="h-3.5 w-3.5 text-[var(--bz-danger)]" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {showAdd && (
        <div
          className="fixed inset-0 flex items-center justify-center"
          style={{ background: 'rgba(0,0,0,0.3)', zIndex: 50 }}
          onClick={() => setShowAdd(false)}
        >
          <div
            className="bz-card"
            style={{ borderRadius: 8, padding: 20, width: 400, maxWidth: '90vw' }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-[16px] font-semibold text-[var(--bz-text)] mb-4">添加参与者</h3>
            <div className="flex flex-col gap-3">
              <input
                type="text"
                placeholder="用户ID"
                value={addForm.user_id}
                onChange={(e) => setAddForm({ ...addForm, user_id: e.target.value })}
                className="text-[14px] px-3 py-2 rounded border"
                style={{ borderColor: 'var(--bz-border)', borderRadius: 3 }}
              />
              <select
                className="text-[14px] px-3 py-2 rounded border"
                style={{ borderColor: 'var(--bz-border)', borderRadius: 3 }}
                value={addForm.role}
                onChange={(e) => setAddForm({ ...addForm, role: e.target.value })}
              >
                {ROLE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
              <div className="flex items-center justify-end gap-2 mt-2">
                <button
                  className="bz-btn bz-btn-ghost"
                  style={{ borderRadius: 3 }}
                  onClick={() => setShowAdd(false)}
                >
                  取消
                </button>
                <button
                  className="bz-btn bz-btn-primary"
                  style={{ borderRadius: 3 }}
                  onClick={handleAdd}
                  disabled={!addForm.user_id.trim()}
                >
                  添加
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}