'use client';

import * as React from 'react';
import { useParams } from 'next/navigation';
import {
  Loader2, AlertTriangle, Check, ArrowUp, Zap,
} from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';

type ConflictItem = {
  id: string;
  type: string;
  description: string;
  status: string;
  severity: 'low' | 'medium' | 'high';
  detectedAt: string;
  resolvedAt: string | null;
  resolution: string | null;
  aiSuggestion: string | null;
  escalatedTo: string | null;
};

const CONFLICT_TYPE_LABEL: Record<string, string> = {
  data_conflict: '数据冲突',
  resource_conflict: '资源冲突',
  schedule_conflict: '日程冲突',
  priority_conflict: '优先级冲突',
  opinion_conflict: '意见冲突',
  process_conflict: '流程冲突',
  authority_conflict: '权限冲突',
  goal_conflict: '目标冲突',
  quality_conflict: '质量冲突',
  budget_conflict: '预算冲突',
};

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  detected: { label: '已检测', color: 'var(--bz-warn)' },
  analyzing: { label: '分析中', color: 'var(--bz-info)' },
  suggested: { label: '已建议', color: 'var(--bz-gold)' },
  escalated: { label: '已升级', color: 'var(--bz-danger)' },
  resolved: { label: '已解决', color: 'var(--bz-ok)' },
  ignored: { label: '已忽略', color: 'var(--bz-text-muted)' },
};

const SEVERITY_CONFIG: Record<string, { label: string; color: string }> = {
  low: { label: '低', color: 'var(--bz-ok)' },
  medium: { label: '中', color: 'var(--bz-warn)' },
  high: { label: '高', color: 'var(--bz-danger)' },
};

export default function ConflictsPage() {
  const params = useParams();
  const collaborationId = params.id as string;
  const [items, setItems] = React.useState<ConflictItem[]>([]);
  const [loading, setLoading] = React.useState(true);

  const fetchConflicts = React.useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/v1/collaborations/${collaborationId}/conflicts`);
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
    fetchConflicts();
  }, [fetchConflicts]);

  const handleResolve = async (id: string) => {
    try {
      await fetch(`/api/v1/collaborations/${collaborationId}/conflicts/${id}/resolve`, { method: 'POST' });
      fetchConflicts();
    } catch {
      // ignore
    }
  };

  const handleEscalate = async (id: string) => {
    try {
      await fetch(`/api/v1/collaborations/${collaborationId}/conflicts/${id}/escalate`, { method: 'POST' });
      fetchConflicts();
    } catch {
      // ignore
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="冲突处理" description="冲突列表、AI 建议、人工升级" />

      {loading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-5 w-5 animate-spin text-[var(--bz-text-muted)]" />
        </div>
      )}

      {!loading && items.length === 0 && (
        <div className="text-center text-[var(--bz-text-muted)] py-12">
          暂无冲突记录
        </div>
      )}

      {!loading && items.length > 0 && (
        <div className="space-y-2">
          {items.map((item) => {
            const statusConfig = STATUS_CONFIG[item.status] ?? STATUS_CONFIG.detected;
            const severityConfig = SEVERITY_CONFIG[item.severity] ?? SEVERITY_CONFIG.medium;

            return (
              <div
                key={item.id}
                className="bz-card"
                style={{
                  borderRadius: 6,
                  padding: '10px 14px',
                  borderLeft: item.severity === 'high' ? '3px solid var(--bz-danger)' : '3px solid transparent',
                }}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4" style={{ color: severityConfig.color }} />
                    <span
                      className="text-[11px] px-1.5 py-0.5 rounded"
                      style={{ background: 'var(--bz-brand-tint)', color: 'var(--bz-brand)', borderRadius: 2 }}
                    >
                      {CONFLICT_TYPE_LABEL[item.type] ?? item.type}
                    </span>
                    <span
                      className="text-[11px] px-1.5 py-0.5 rounded"
                      style={{ background: `${statusConfig.color}15`, color: statusConfig.color, borderRadius: 2 }}
                    >
                      {statusConfig.label}
                    </span>
                    <span
                      className="text-[11px] px-1.5 py-0.5 rounded"
                      style={{ background: `${severityConfig.color}15`, color: severityConfig.color, borderRadius: 2 }}
                    >
                      {severityConfig.label}
                    </span>
                  </div>
                  <span className="text-[11px] text-[var(--bz-text-muted)]">
                    {new Date(item.detectedAt).toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' })}
                  </span>
                </div>

                <div className="text-[13px] text-[var(--bz-text)] mb-2">{item.description}</div>

                {item.aiSuggestion && (
                  <div
                    className="rounded px-3 py-2 mb-2"
                    style={{ background: 'var(--bz-brand-tint)', borderRadius: 2 }}
                  >
                    <div className="flex items-center gap-1 mb-0.5">
                      <Zap className="h-3 w-3" style={{ color: 'var(--bz-brand)' }} />
                      <span className="text-[12px] font-medium" style={{ color: 'var(--bz-brand)' }}>AI 建议</span>
                    </div>
                    <div className="text-[12px] text-[var(--bz-text-sub)]">{item.aiSuggestion}</div>
                  </div>
                )}

                {item.resolution && (
                  <div
                    className="rounded px-3 py-2 mb-2"
                    style={{ background: 'var(--bz-ok-tint)', borderRadius: 2 }}
                  >
                    <div className="flex items-center gap-1 mb-0.5">
                      <Check className="h-3 w-3" style={{ color: 'var(--bz-ok)' }} />
                      <span className="text-[12px] font-medium" style={{ color: 'var(--bz-ok)' }}>解决方案</span>
                    </div>
                    <div className="text-[12px] text-[var(--bz-text-sub)]">{item.resolution}</div>
                  </div>
                )}

                {item.escalatedTo && (
                  <div className="text-[11px] text-[var(--bz-danger)] mb-2">
                    已升级至: {item.escalatedTo}
                  </div>
                )}

                {(item.status === 'detected' || item.status === 'suggested') && (
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleResolve(item.id)}
                      className="bz-btn bz-btn-primary text-[12px] flex items-center gap-1"
                      style={{ borderRadius: 2 }}
                    >
                      <Check className="h-3 w-3" />
                      解决
                    </button>
                    <button
                      onClick={() => handleEscalate(item.id)}
                      className="bz-btn bz-btn-ghost text-[12px] flex items-center gap-1"
                      style={{ borderRadius: 2, color: 'var(--bz-danger)' }}
                    >
                      <ArrowUp className="h-3 w-3" />
                      升级
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}