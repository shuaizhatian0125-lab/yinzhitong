'use client';

import * as React from 'react';
import { useParams } from 'next/navigation';
import {
  Loader2, FileText, Check, Clock, Link2,
  Download, Eye, Plus,
} from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';

type Deliverable = {
  id: string;
  title: string;
  type: string;
  content: string;
  status: string;
  sourceWorkstreamId: string | null;
  sourceTaskIds: string[];
  traceability: {
    taskIds: string[];
    agentRunIds: string[];
    knowledgeSources: string[];
    dataSources: string[];
  };
  submittedAt: string | null;
  approvedAt: string | null;
  deliveredAt: string | null;
  createdAt: string;
};

const DELIVERABLE_TYPE_LABEL: Record<string, string> = {
  REPORT: '报告',
  DOCUMENT: '文档',
  DATA: '数据集',
  ANALYSIS: '分析结果',
  DECISION: '决策记录',
  PLAN: '计划',
  OTHER: '其他',
};

const STATUS_CONFIG: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
  DRAFT: { label: '草稿', icon: <FileText className="h-4 w-4" />, color: 'var(--bz-text-muted)' },
  REVIEWING: { label: '审核中', icon: <Clock className="h-4 w-4" />, color: 'var(--bz-info)' },
  APPROVED: { label: '已通过', icon: <Check className="h-4 w-4" />, color: 'var(--bz-ok)' },
  DELIVERED: { label: '已交付', icon: <Check className="h-4 w-4" />, color: 'var(--bz-brand)' },
  REJECTED: { label: '已驳回', icon: <FileText className="h-4 w-4" />, color: 'var(--bz-danger)' },
  REVISED: { label: '已修订', icon: <FileText className="h-4 w-4" />, color: 'var(--bz-warn)' },
};

export default function DeliverablesPage() {
  const params = useParams();
  const collaborationId = params.id as string;
  const [items, setItems] = React.useState<Deliverable[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [showTrace, setShowTrace] = React.useState<string | null>(null);
  const [showCreate, setShowCreate] = React.useState(false);
  const [createForm, setCreateForm] = React.useState({
    title: '',
    type: 'REPORT',
    content: '',
    sourceWorkstreamId: '',
  });

  const fetchDeliverables = React.useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/v1/collaborations/${collaborationId}/deliverables`);
      const json = await res.json();
      if (json.code === 0 && json.data) {
        setItems(json.data.items ?? []);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [collaborationId]);

  React.useEffect(() => {
    fetchDeliverables();
  }, [fetchDeliverables]);

  const handleCreate = async () => {
    if (!createForm.title.trim() || !createForm.content.trim()) return;
    try {
      await fetch(`/api/v1/collaborations/${collaborationId}/deliverables`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: createForm.title,
          type: createForm.type,
          content: createForm.content,
          sourceWorkstreamId: createForm.sourceWorkstreamId || undefined,
        }),
      });
      setShowCreate(false);
      setCreateForm({ title: '', type: 'REPORT', content: '', sourceWorkstreamId: '' });
      fetchDeliverables();
    } catch {
      // ignore
    }
  };

  const handleAction = async (id: string, action: string) => {
    try {
      await fetch(`/api/v1/collaborations/${collaborationId}/deliverables/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      fetchDeliverables();
    } catch {
      // ignore
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="成果交付"
        description="成果整合、溯源链、交付状态"
        actions={
          <button
            className="bz-btn bz-btn-primary"
            style={{ borderRadius: 3 }}
            onClick={() => setShowCreate(true)}
          >
            <Plus className="h-4 w-4" />
            创建成果
          </button>
        }
      />

      {loading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-5 w-5 animate-spin text-[var(--bz-text-muted)]" />
        </div>
      )}

      {!loading && items.length === 0 && (
        <div className="text-center text-[var(--bz-text-muted)] py-12">
          暂无成果交付
        </div>
      )}

      {!loading && items.length > 0 && (
        <div className="space-y-2">
          {items.map((item) => {
            const statusConfig = STATUS_CONFIG[item.status] ?? STATUS_CONFIG.DRAFT;
            const traceCount = item.traceability.taskIds.length + item.traceability.agentRunIds.length + item.traceability.knowledgeSources.length + item.traceability.dataSources.length;

            return (
              <div
                key={item.id}
                className="bz-card"
                style={{ borderRadius: 6, padding: '10px 14px' }}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-2">
                    <span style={{ color: statusConfig.color }}>{statusConfig.icon}</span>
                    <span
                      className="text-[11px] px-1.5 py-0.5 rounded"
                      style={{ background: 'var(--bz-brand-tint)', color: 'var(--bz-brand)', borderRadius: 2 }}
                    >
                      {DELIVERABLE_TYPE_LABEL[item.type] ?? item.type}
                    </span>
                    <span
                      className="text-[11px] px-1.5 py-0.5 rounded"
                      style={{ background: `${statusConfig.color}15`, color: statusConfig.color, borderRadius: 2 }}
                    >
                      {statusConfig.label}
                    </span>
                  </div>
                  <span className="text-[11px] text-[var(--bz-text-muted)]">
                    {new Date(item.createdAt).toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' })}
                  </span>
                </div>

                <div className="text-[14px] font-medium text-[var(--bz-text)] mb-0.5">{item.title}</div>
                <div className="text-[12px] text-[var(--bz-text-sub)] leading-relaxed mb-2 line-clamp-2">{item.content}</div>

                {item.sourceWorkstreamId && (
                  <div className="text-[11px] text-[var(--bz-text-muted)] mb-2">
                    来源工作线: {item.sourceWorkstreamId}
                  </div>
                )}

                {traceCount > 0 && (
                  <div className="mb-2">
                    <button
                      onClick={() => setShowTrace(showTrace === item.id ? null : item.id)}
                      className="text-[12px] flex items-center gap-1"
                      style={{ color: 'var(--bz-brand)' }}
                    >
                      <Link2 className="h-3 w-3" />
                      溯源链 ({traceCount})
                    </button>

                    {showTrace === item.id && (
                      <div className="mt-1 pl-4 space-y-1">
                        {item.traceability.taskIds.map((t, i) => (
                          <div key={`t-${i}`} className="text-[12px] text-[var(--bz-text-sub)] flex items-center gap-1">
                            <span className="h-1.5 w-1.5 rounded-full" style={{ background: 'var(--bz-brand)' }} />
                            任务: {t}
                          </div>
                        ))}
                        {item.traceability.knowledgeSources.map((t, i) => (
                          <div key={`k-${i}`} className="text-[12px] text-[var(--bz-text-sub)] flex items-center gap-1">
                            <span className="h-1.5 w-1.5 rounded-full" style={{ background: 'var(--bz-info)' }} />
                            知识源: {t}
                          </div>
                        ))}
                        {item.traceability.dataSources.map((t, i) => (
                          <div key={`d-${i}`} className="text-[12px] text-[var(--bz-text-sub)] flex items-center gap-1">
                            <span className="h-1.5 w-1.5 rounded-full" style={{ background: 'var(--bz-gold)' }} />
                            数据源: {t}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                <div className="flex items-center gap-2">
                  {item.status === 'DRAFT' && (
                    <button
                      onClick={() => handleAction(item.id, 'SUBMIT')}
                      className="bz-btn bz-btn-primary text-[12px] flex items-center gap-1"
                      style={{ borderRadius: 2 }}
                    >
                      提交审核
                    </button>
                  )}
                  {item.status === 'REVIEWING' && (
                    <>
                      <button
                        onClick={() => handleAction(item.id, 'APPROVE')}
                        className="bz-btn bz-btn-primary text-[12px] flex items-center gap-1"
                        style={{ borderRadius: 2 }}
                      >
                        <Check className="h-3 w-3" />
                        通过
                      </button>
                      <button
                        onClick={() => handleAction(item.id, 'REJECT')}
                        className="bz-btn bz-btn-ghost text-[12px]"
                        style={{ borderRadius: 2, color: 'var(--bz-danger)' }}
                      >
                        驳回
                      </button>
                    </>
                  )}
                  {item.status === 'APPROVED' && (
                    <button
                      onClick={() => handleAction(item.id, 'DELIVER')}
                      className="bz-btn bz-btn-primary text-[12px] flex items-center gap-1"
                      style={{ borderRadius: 2 }}
                    >
                      交付
                    </button>
                  )}
                  {item.status === 'DELIVERED' && (
                    <button
                      className="bz-btn bz-btn-ghost text-[12px] flex items-center gap-1"
                      style={{ borderRadius: 2 }}
                    >
                      <Download className="h-3 w-3" />
                      下载
                    </button>
                  )}
                  <button
                    className="bz-btn bz-btn-ghost text-[12px] flex items-center gap-1"
                    style={{ borderRadius: 2 }}
                  >
                    <Eye className="h-3 w-3" />
                    查看
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {showCreate && (
        <div
          className="fixed inset-0 flex items-center justify-center"
          style={{ background: 'rgba(0,0,0,0.3)', zIndex: 50 }}
          onClick={() => setShowCreate(false)}
        >
          <div
            className="bz-card"
            style={{ borderRadius: 8, padding: 20, width: 480, maxWidth: '90vw' }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-[16px] font-semibold text-[var(--bz-text)] mb-4">创建成果</h3>
            <div className="flex flex-col gap-3">
              <input
                type="text"
                placeholder="成果标题"
                value={createForm.title}
                onChange={(e) => setCreateForm({ ...createForm, title: e.target.value })}
                className="text-[14px] px-3 py-2 rounded border"
                style={{ borderColor: 'var(--bz-border)', borderRadius: 3 }}
              />
              <select
                className="text-[14px] px-3 py-2 rounded border"
                style={{ borderColor: 'var(--bz-border)', borderRadius: 3 }}
                value={createForm.type}
                onChange={(e) => setCreateForm({ ...createForm, type: e.target.value })}
              >
                {Object.entries(DELIVERABLE_TYPE_LABEL).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
              <textarea
                placeholder="成果内容"
                value={createForm.content}
                onChange={(e) => setCreateForm({ ...createForm, content: e.target.value })}
                className="text-[14px] px-3 py-2 rounded border"
                style={{ borderColor: 'var(--bz-border)', borderRadius: 3, minHeight: 100 }}
              />
              <input
                type="text"
                placeholder="来源工作线ID（可选）"
                value={createForm.sourceWorkstreamId}
                onChange={(e) => setCreateForm({ ...createForm, sourceWorkstreamId: e.target.value })}
                className="text-[14px] px-3 py-2 rounded border"
                style={{ borderColor: 'var(--bz-border)', borderRadius: 3 }}
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
                  disabled={!createForm.title.trim() || !createForm.content.trim()}
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