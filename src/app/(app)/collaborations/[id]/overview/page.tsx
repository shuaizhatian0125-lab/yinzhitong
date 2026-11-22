'use client';

import * as React from 'react';
import { useParams } from 'next/navigation';
import {
  Loader2, Target, Users, ListTodo, AlertCircle,
  TrendingUp, Clock, FileText, Gavel,
} from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';

type CollaborationInfo = {
  id: string;
  name: string;
  type: string;
  status: string;
  description: string | null;
  ownerId: string;
  successCriteria: string;
};

type WorkstreamData = {
  workstreams: {
    id: string;
    name: string;
    phase: string;
    status: string;
    progress: number;
  }[];
  phases: { id: string; name: string; sequence: number }[];
};

type DeliverableData = {
  id: string;
  title: string;
  type: string;
  status: string;
}[];

type DecisionData = {
  id: string;
  type: string;
  title: string;
  status: string;
}[];

type ActivityItem = {
  timestamp: string;
  description: string;
  actor: string;
};

const STATUS_LABEL: Record<string, string> = {
  draft: '草稿',
  active: '进行中',
  paused: '已暂停',
  completed: '已完成',
  cancelled: '已取消',
  failed: '已失败',
};

const TYPE_LABEL: Record<string, string> = {
  RESEARCH: '研究协作',
  PROJECT: '项目协作',
  CROSS_DEPT_PROJECT: '跨部门协作',
  COMPLIANCE_REVIEW: '合规审查',
  STRATEGIC_PLANNING: '战略规划',
  RISK_ASSESSMENT: '风险评估',
  KNOWLEDGE_BUILDING: '知识建设',
  INNOVATION: '创新协作',
};

export default function CollaborationOverviewPage() {
  const params = useParams();
  const collaborationId = params.id as string;
  const [collab, setCollab] = React.useState<CollaborationInfo | null>(null);
  const [workstreamData, setWorkstreamData] = React.useState<WorkstreamData | null>(null);
  const [deliverables, setDeliverables] = React.useState<DeliverableData>([]);
  const [decisions, setDecisions] = React.useState<DecisionData>([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    const fetchAll = async () => {
      try {
        const [collabRes, wsRes, delRes, decRes] = await Promise.all([
          fetch(`/api/v1/collaborations/${collaborationId}`),
          fetch(`/api/v1/collaborations/${collaborationId}/workstreams`),
          fetch(`/api/v1/collaborations/${collaborationId}/deliverables`),
          fetch(`/api/v1/collaborations/${collaborationId}/decisions`),
        ]);

        const collabJson = await collabRes.json();
        if (collabJson.code === 0 && collabJson.data) {
          setCollab(collabJson.data);
        }

        const wsJson = await wsRes.json();
        if (wsJson.code === 0 && wsJson.data) {
          setWorkstreamData(wsJson.data);
        }

        const delJson = await delRes.json();
        if (delJson.code === 0 && delJson.data) {
          setDeliverables(delJson.data.items ?? []);
        }

        const decJson = await decRes.json();
        if (decJson.code === 0 && decJson.data) {
          setDecisions(decJson.data.items ?? []);
        }
      } catch {
        // ignore
      } finally {
        setLoading(false);
      }
    };
    fetchAll();
  }, [collaborationId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-5 w-5 animate-spin text-[var(--bz-text-muted)]" />
      </div>
    );
  }

  if (!collab) {
    return (
      <div className="text-center text-[var(--bz-text-muted)] py-12">
        暂无概览数据
      </div>
    );
  }

  const wsList = workstreamData?.workstreams ?? [];
  const completedWs = wsList.filter((w) => w.status === 'COMPLETED' || w.progress >= 100).length;
  const overallProgress = wsList.length > 0
    ? Math.round(wsList.reduce((sum, w) => sum + w.progress, 0) / wsList.length)
    : 0;

  const recentActivities: ActivityItem[] = [];
  for (const ws of wsList.slice(0, 3)) {
    recentActivities.push({
      timestamp: new Date().toISOString(),
      description: `工作线「${ws.name}」状态: ${ws.status}, 进度 ${ws.progress}%`,
      actor: '系统',
    });
  }
  for (const dec of decisions.slice(0, 2)) {
    recentActivities.push({
      timestamp: new Date().toISOString(),
      description: `决策「${dec.title}」状态: ${dec.status}`,
      actor: '系统',
    });
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="协作概览" description="协作全貌、实时状态更新" />

      <div className="bz-card" style={{ borderRadius: 8, padding: '14px 16px' }}>
        <div className="flex items-center gap-3 mb-2">
          <Target className="h-4 w-4" style={{ color: 'var(--bz-brand)' }} />
          <span className="text-[14px] font-semibold text-[var(--bz-text)]">{collab.name}</span>
          <span
            className="text-[11px] px-2 py-0.5 rounded"
            style={{
              background: collab.status === 'active' ? 'var(--bz-ok-tint)' : 'var(--bz-brand-tint)',
              color: collab.status === 'active' ? 'var(--bz-ok)' : 'var(--bz-brand)',
              borderRadius: 2,
            }}
          >
            {STATUS_LABEL[collab.status] ?? collab.status}
          </span>
          <span
            className="text-[11px] px-2 py-0.5 rounded"
            style={{ background: 'var(--bz-info-tint)', color: 'var(--bz-info)', borderRadius: 2 }}
          >
            {TYPE_LABEL[collab.type] ?? collab.type}
          </span>
        </div>
        {collab.description && (
          <div className="text-[13px] text-[var(--bz-text-sub)] leading-relaxed">{collab.description}</div>
        )}
      </div>

      <div className="grid grid-cols-4 gap-3">
        <div className="bz-card" style={{ borderRadius: 6, padding: '10px 14px' }}>
          <div className="flex items-center gap-2 mb-1">
            <TrendingUp className="h-4 w-4" style={{ color: 'var(--bz-ok)' }} />
            <span className="text-[12px] text-[var(--bz-text-sub)]">整体进度</span>
          </div>
          <div className="text-[20px] font-semibold" style={{ color: 'var(--bz-ok)' }}>{overallProgress}%</div>
          <div className="h-1 rounded-full overflow-hidden mt-1" style={{ background: 'var(--bz-border)' }}>
            <div className="h-full rounded-full" style={{ width: `${overallProgress}%`, background: 'var(--bz-ok)' }} />
          </div>
        </div>

        <div className="bz-card" style={{ borderRadius: 6, padding: '10px 14px' }}>
          <div className="flex items-center gap-2 mb-1">
            <ListTodo className="h-4 w-4" style={{ color: 'var(--bz-gold)' }} />
            <span className="text-[12px] text-[var(--bz-text-sub)]">工作线</span>
          </div>
          <div className="text-[20px] font-semibold" style={{ color: 'var(--bz-gold)' }}>
            {completedWs}/{wsList.length}
          </div>
        </div>

        <div className="bz-card" style={{ borderRadius: 6, padding: '10px 14px' }}>
          <div className="flex items-center gap-2 mb-1">
            <FileText className="h-4 w-4" style={{ color: 'var(--bz-info)' }} />
            <span className="text-[12px] text-[var(--bz-text-sub)]">成果数</span>
          </div>
          <div className="text-[20px] font-semibold" style={{ color: 'var(--bz-info)' }}>{deliverables.length}</div>
        </div>

        <div className="bz-card" style={{ borderRadius: 6, padding: '10px 14px' }}>
          <div className="flex items-center gap-2 mb-1">
            <Gavel className="h-4 w-4" style={{ color: 'var(--bz-brand)' }} />
            <span className="text-[12px] text-[var(--bz-text-sub)]">决策数</span>
          </div>
          <div className="text-[20px] font-semibold" style={{ color: 'var(--bz-brand)' }}>{decisions.length}</div>
        </div>
      </div>

      <div className="bz-card" style={{ borderRadius: 8 }}>
        <div className="bz-card-head">
          <span className="bz-card-title">最近动态</span>
        </div>
        <div className="p-3">
          {recentActivities.length === 0 && (
            <div className="text-center text-[12px] text-[var(--bz-text-muted)] py-4">暂无动态</div>
          )}
          {recentActivities.slice(0, 5).map((a, idx) => (
            <div
              key={idx}
              className="px-2 py-2"
              style={{ borderBottom: idx < Math.min(recentActivities.length, 5) - 1 ? '1px solid var(--bz-border)' : 'none' }}
            >
              <div className="text-[13px] text-[var(--bz-text)]">{a.description}</div>
              <div className="text-[11px] text-[var(--bz-text-muted)] mt-0.5">
                {a.actor} · {new Date(a.timestamp).toLocaleString('zh-CN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
              </div>
            </div>
          ))}
        </div>
      </div>

      {wsList.some((w) => w.status === 'FAILED') && (
        <div
          className="rounded-[8px] border px-4 py-3"
          style={{ borderColor: 'var(--bz-danger)', background: '#fef2f2' }}
        >
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4" style={{ color: 'var(--bz-danger)' }} />
            <span className="text-[14px] font-medium" style={{ color: 'var(--bz-danger)' }}>
              当前有失败的工作线需要关注
            </span>
          </div>
        </div>
      )}
    </div>
  );
}