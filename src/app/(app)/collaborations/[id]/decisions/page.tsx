'use client';

import * as React from 'react';
import { useParams } from 'next/navigation';
import {
  Loader2, Check, X, Clock, AlertCircle, FileText,
  ArrowUpRight, ArrowDownRight,
} from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';

type DecisionItem = {
  id: string;
  type: string;
  title: string;
  description: string;
  status: string;
  submittedBy: string;
  submittedAt: string;
  approvedBy: string | null;
  approvedAt: string | null;
  requiresApproval: boolean;
  impact: 'low' | 'medium' | 'high';
};

const DECISION_TYPE_LABEL: Record<string, string> = {
  strategic: '战略决策',
  operational: '运营决策',
  financial: '财务决策',
  risk: '风险决策',
  compliance: '合规决策',
  personnel: '人事决策',
  technical: '技术决策',
  process: '流程决策',
  resource: '资源决策',
  emergency: '紧急决策',
};

const STATUS_CONFIG: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
  pending: { label: '待审批', icon: <Clock className="h-4 w-4" />, color: 'var(--bz-warn)' },
  approved: { label: '已批准', icon: <Check className="h-4 w-4" />, color: 'var(--bz-ok)' },
  rejected: { label: '已拒绝', icon: <X className="h-4 w-4" />, color: 'var(--bz-danger)' },
  executed: { label: '已执行', icon: <Check className="h-4 w-4" />, color: 'var(--bz-brand)' },
  revised: { label: '已修订', icon: <AlertCircle className="h-4 w-4" />, color: 'var(--bz-info)' },
  cancelled: { label: '已取消', icon: <X className="h-4 w-4" />, color: 'var(--bz-text-muted)' },
};

const IMPACT_CONFIG: Record<string, { label: string; color: string }> = {
  low: { label: '低影响', color: 'var(--bz-ok)' },
  medium: { label: '中影响', color: 'var(--bz-warn)' },
  high: { label: '高影响', color: 'var(--bz-danger)' },
};

export default function DecisionsPage() {
  const params = useParams();
  const collaborationId = params.id as string;
  const [items, setItems] = React.useState<DecisionItem[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [showCreate, setShowCreate] = React.useState(false);
  const [createForm, setCreateForm] = React.useState({ type: 'operational', title: '', description: '', impact: 'medium' });

  const fetchDecisions = React.useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/v1/collaborations/${collaborationId}/decisions`);
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
    fetchDecisions();
  }, [fetchDecisions]);

  const handleApprove = async (id: string) => {
    try {
      await fetch(`/api/v1/collaborations/${collaborationId}/decisions/${id}/approve`, { method: 'POST' });
      fetchDecisions();
    } catch {
      // ignore
    }
  };

  const handleReject = async (id: string) => {
    try {
      await fetch(`/api/v1/collaborations/${collaborationId}/decisions/${id}/reject`, { method: 'POST' });
      fetchDecisions();
    } catch {
      // ignore
    }
  };

  const handleCreate = async () => {
    if (!createForm.title.trim()) return;
    try {
      await fetch(`/api/v1/collaborations/${collaborationId}/decisions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(createForm),
      });
      setShowCreate(false);
      setCreateForm({ type: 'operational', title: '', description: '', impact: 'medium' });
      fetchDecisions();
    } catch {
      // ignore
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="决策中心"
        description="10种决策类型、决策流程可视化"
        actions={
          <button
            className="bz-btn bz-btn-primary"
            style={{ borderRadius: 3 }}
            onClick={() => setShowCreate(true)}
          >
            <FileText className="h-4 w-4" />
            提交决策
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
          暂无决策记录
        </div>
      )}

      {!loading && items.length > 0 && (
        <div className="space-y-2">
          {items.map((item) => {
            const statusConfig = STATUS_CONFIG[item.status] ?? STATUS_CONFIG.pending;
            const impactConfig = IMPACT_CONFIG[item.impact] ?? IMPACT_CONFIG.medium;

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
                      {DECISION_TYPE_LABEL[item.type] ?? item.type}
                    </span>
                    <span
                      className="text-[11px] px-1.5 py-0.5 rounded"
                      style={{ background: `${statusConfig.color}15`, color: statusConfig.color, borderRadius: 2 }}
                    >
                      {statusConfig.label}
                    </span>
                    <span
                      className="text-[11px] px-1.5 py-0.5 rounded"
                      style={{ background: `${impactConfig.color}15`, color: impactConfig.color, borderRadius: 2 }}
                    >
                      {impactConfig.label}
                    </span>
                  </div>
                  <span className="text-[11px] text-[var(--bz-text-muted)]">
                    {item.submittedBy} · {new Date(item.submittedAt).toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' })}
                  </span>
                </div>

                <div className="text-[14px] font-medium text-[var(--bz-text)] mb-0.5">{item.title}</div>
                <div className="text-[12px] text-[var(--bz-text-sub)] leading-relaxed mb-2">{item.description}</div>

                {item.approvedBy && (
                  <div className="text-[11px] text-[var(--bz-text-muted)] mb-2">
                    审批人: {item.approvedBy}
                    {item.approvedAt && ` · ${new Date(item.approvedAt).toLocaleDateString('zh-CN')}`}
                  </div>
                )}

                {item.status === 'pending' && item.requiresApproval && (
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleApprove(item.id)}
                      className="bz-btn bz-btn-primary text-[12px] flex items-center gap-1"
                      style={{ borderRadius: 2 }}
                    >
                      <Check className="h-3 w-3" />
                      批准
                    </button>
                    <button
                      onClick={() => handleReject(item.id)}
                      className="bz-btn bz-btn-ghost text-[12px] flex items-center gap-1"
                      style={{ borderRadius: 2, color: 'var(--bz-danger)' }}
                    >
                      <X className="h-3 w-3" />
                      拒绝
                    </button>
                  </div>
                )}
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
            style={{ borderRadius: 8, padding: 20, width: 440, maxWidth: '90vw' }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-[16px] font-semibold text-[var(--bz-text)] mb-4">提交决策</h3>
            <div className="flex flex-col gap-3">
              <input
                type="text"
                placeholder="决策标题"
                value={createForm.title}
                onChange={(e) => setCreateForm({ ...createForm, title: e.target.value })}
                className="text-[14px] px-3 py-2 rounded border"
                style={{ borderColor: 'var(--bz-border)', borderRadius: 3 }}
              />
              <textarea
                placeholder="决策描述"
                value={createForm.description}
                onChange={(e) => setCreateForm({ ...createForm, description: e.target.value })}
                className="text-[14px] px-3 py-2 rounded border"
                style={{ borderColor: 'var(--bz-border)', borderRadius: 3, minHeight: 80 }}
              />
              <div className="flex gap-2">
                <select
                  className="text-[14px] px-3 py-2 rounded border flex-1"
                  style={{ borderColor: 'var(--bz-border)', borderRadius: 3 }}
                  value={createForm.type}
                  onChange={(e) => setCreateForm({ ...createForm, type: e.target.value })}
                >
                  {Object.entries(DECISION_TYPE_LABEL).map(([value, label]) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
                <select
                  className="text-[14px] px-3 py-2 rounded border flex-1"
                  style={{ borderColor: 'var(--bz-border)', borderRadius: 3 }}
                  value={createForm.impact}
                  onChange={(e) => setCreateForm({ ...createForm, impact: e.target.value })}
                >
                  <option value="low">低影响</option>
                  <option value="medium">中影响</option>
                  <option value="high">高影响</option>
                </select>
              </div>
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
                  disabled={!createForm.title.trim()}
                >
                  提交
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}