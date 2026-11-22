'use client';

import * as React from 'react';
import { useRouter, useParams } from 'next/navigation';
import { ArrowLeft, Loader2, UserPlus } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { WorkflowViewer, type WorkflowDefinitionData, type WorkflowNodeData } from '@/components/domain/WorkflowViewer';

type CollaborationDetail = {
  row: {
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
  members: Array<{
    id: string;
    user_id: string;
    role: string;
    joined_at: string;
  }>;
  taskIds: string[];
};

type WorkflowInstanceDetail = {
  instance: {
    id: string;
    def_id: string;
    def_version: number;
    status: string;
    context: Record<string, unknown>;
    started_at: string;
    finished_at: string | null;
  };
  def: {
    id: string;
    code: string;
    name: string;
    version: number;
    definition: Record<string, unknown>;
  } | null;
  nodes: WorkflowNodeData[];
};

const MEMBER_ROLE_LABEL: Record<string, string> = {
  owner: '负责人',
  member: '成员',
  admin: '管理员',
};

export default function CollabDetailPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const collaborationId = params.id;

  const [detail, setDetail] = React.useState<CollaborationDetail | null>(null);
  const [workflowInstance, setWorkflowInstance] = React.useState<WorkflowInstanceDetail | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [showAddMember, setShowAddMember] = React.useState(false);
  const [newMemberId, setNewMemberId] = React.useState('');

  const fetchDetail = React.useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/v1/collaborations/${collaborationId}`);
      const json = await res.json();
      if (json.code === 0 && json.data) {
        setDetail(json.data);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [collaborationId]);

  React.useEffect(() => {
    fetchDetail();
  }, [fetchDetail]);

  const handleAddMember = async () => {
    if (!newMemberId.trim()) return;
    try {
      const res = await fetch(`/api/v1/collaborations/${collaborationId}/members`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: newMemberId }),
      });
      const json = await res.json();
      if (json.code === 0) {
        setShowAddMember(false);
        setNewMemberId('');
        fetchDetail();
      }
    } catch {
      // ignore
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-[var(--bz-text-muted)]" />
      </div>
    );
  }

  if (!detail) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3">
        <p className="text-[var(--bz-text-muted)]">协同事项不存在</p>
        <button className="bz-btn bz-btn-default" onClick={() => router.push('/centers/collab')}>
          返回协同列表
        </button>
      </div>
    );
  }

  const workflowDefinition = workflowInstance?.def?.definition
    ? (workflowInstance.def.definition as unknown as WorkflowDefinitionData)
    : null;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <button
          className="bz-btn bz-btn-ghost"
          onClick={() => router.push('/centers/collab')}
        >
          <ArrowLeft className="h-4 w-4" />
          返回列表
        </button>
      </div>

      <PageHeader title={detail.row.title} description={detail.row.description ?? '协同事项详情'} />

      <div className="flex gap-4">
        <div className="flex-1" style={{ flexBasis: '70%' }}>
          {workflowInstance ? (
            <div className="bz-card" style={{ borderRadius: 8 }}>
              <div className="bz-card-head">
                <span className="bz-card-title">工作流进度</span>
                <span className="text-[12px] text-[var(--bz-text-muted)]">
                  {workflowInstance.def?.name ?? '未命名流程'} v{workflowInstance.def?.version}
                </span>
              </div>
              <div className="p-4">
                <WorkflowViewer
                  definition={workflowDefinition}
                  nodeInstances={workflowInstance.nodes}
                />
              </div>
            </div>
          ) : (
            <div className="bz-card" style={{ borderRadius: 8 }}>
              <div className="bz-card-head">
                <span className="bz-card-title">工作流</span>
              </div>
              <div className="p-4 text-center text-[var(--bz-text-muted)]">
                该协同事项暂无关联的工作流实例
              </div>
            </div>
          )}

          {detail.taskIds.length > 0 && (
            <div className="mt-4 bz-card" style={{ borderRadius: 8 }}>
              <div className="bz-card-head">
                <span className="bz-card-title">关联子任务</span>
                <span className="text-[12px] text-[var(--bz-text-muted)]">{detail.taskIds.length} 个</span>
              </div>
              <div className="p-3">
                {detail.taskIds.map((taskId) => (
                  <div
                    key={taskId}
                    className="flex items-center gap-3 px-3 py-2.5 rounded transition-colors hover:bg-[#fafcfe] cursor-pointer"
                    style={{ borderBottom: '1px solid #eef2f6' }}
                    onClick={() => router.push(`/centers/tasks/${taskId}`)}
                  >
                    <span className="bz-badge bz-badge-blue">任务</span>
                    <span className="flex-1 text-[13px] text-[var(--bz-text)] truncate">{taskId}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div style={{ flexBasis: '30%', flexShrink: 0 }}>
          <div className="bz-card" style={{ borderRadius: 8 }}>
            <div className="bz-card-head">
              <span className="bz-card-title">成员列表</span>
              <button
                className="text-[12px] flex items-center gap-1 text-[var(--bz-brand)]"
                onClick={() => setShowAddMember(true)}
              >
                <UserPlus className="h-3 w-3" />
                添加
              </button>
            </div>
            <div className="p-3">
              {detail.members.map((member) => (
                <div
                  key={member.id}
                  className="flex items-center justify-between px-3 py-2 rounded"
                  style={{ borderBottom: '1px solid #eef2f6' }}
                >
                  <span className="text-[13px] text-[var(--bz-text)]">{member.user_id}</span>
                  <span className="bz-badge bz-badge-blue" style={{ fontSize: 11 }}>
                    {MEMBER_ROLE_LABEL[member.role] ?? member.role}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-4 bz-card" style={{ borderRadius: 8 }}>
            <div className="bz-card-head">
              <span className="bz-card-title">基本信息</span>
            </div>
            <div className="p-3 flex flex-col gap-2">
              <div className="flex items-center justify-between text-[12px]">
                <span className="text-[var(--bz-text-muted)]">编码</span>
                <span className="text-[var(--bz-text)] font-mono">{detail.row.code}</span>
              </div>
              <div className="flex items-center justify-between text-[12px]">
                <span className="text-[var(--bz-text-muted)]">类型</span>
                <span className="text-[var(--bz-text)]">{detail.row.type}</span>
              </div>
              <div className="flex items-center justify-between text-[12px]">
                <span className="text-[var(--bz-text-muted)]">状态</span>
                <span className="text-[var(--bz-text)]">{detail.row.status}</span>
              </div>
              <div className="flex items-center justify-between text-[12px]">
                <span className="text-[var(--bz-text-muted)]">创建时间</span>
                <span className="text-[var(--bz-text)]">
                  {new Date(detail.row.created_at).toLocaleDateString('zh-CN')}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {showAddMember && (
        <div
          className="fixed inset-0 flex items-center justify-center"
          style={{ background: 'rgba(0,0,0,0.3)', zIndex: 50 }}
          onClick={() => setShowAddMember(false)}
        >
          <div
            className="bz-card"
            style={{ borderRadius: 8, padding: 20, width: 360, maxWidth: '90vw' }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-[16px] font-semibold text-[var(--bz-text)] mb-4">添加成员</h3>
            <input
              type="text"
              placeholder="用户ID"
              value={newMemberId}
              onChange={(e) => setNewMemberId(e.target.value)}
              className="text-[14px] px-3 py-2 rounded border w-full"
              style={{ borderColor: 'var(--bz-line)', borderRadius: 6 }}
            />
            <div className="flex items-center justify-end gap-2 mt-4">
              <button
                className="bz-btn bz-btn-ghost"
                style={{ borderRadius: 6 }}
                onClick={() => setShowAddMember(false)}
              >
                取消
              </button>
              <button
                className="bz-btn bz-btn-primary"
                style={{ borderRadius: 6 }}
                onClick={handleAddMember}
                disabled={!newMemberId.trim()}
              >
                添加
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}