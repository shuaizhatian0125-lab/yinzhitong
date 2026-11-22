'use client';

import * as React from 'react';
import { useRouter, useParams } from 'next/navigation';
import {
  Loader2, Users, ListTodo, FileText, AlertCircle,
  CheckCircle2, Shield, Settings, Activity,
} from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';

type CollaborationDetail = {
  id: string;
  code: string;
  title: string;
  type: string;
  description: string | null;
  status: string;
  ownerId: string | null;
  createdAt: string;
  updatedAt: string;
};

type TabKey = 'overview' | 'participants' | 'workstreams' | 'context' | 'decisions' | 'conflicts' | 'deliverables' | 'coordinator' | 'kill-switch';

const TABS: { key: TabKey; label: string; icon: React.ReactNode }[] = [
  { key: 'overview', label: '概览', icon: <Activity className="h-4 w-4" /> },
  { key: 'participants', label: '参与者', icon: <Users className="h-4 w-4" /> },
  { key: 'workstreams', label: '工作线', icon: <ListTodo className="h-4 w-4" /> },
  { key: 'context', label: '共享上下文', icon: <FileText className="h-4 w-4" /> },
  { key: 'decisions', label: '决策中心', icon: <CheckCircle2 className="h-4 w-4" /> },
  { key: 'conflicts', label: '冲突处理', icon: <AlertCircle className="h-4 w-4" /> },
  { key: 'deliverables', label: '成果交付', icon: <FileText className="h-4 w-4" /> },
  { key: 'coordinator', label: 'Coordinator', icon: <Settings className="h-4 w-4" /> },
  { key: 'kill-switch', label: 'Kill Switch', icon: <Shield className="h-4 w-4" /> },
];

const STATUS_LABEL: Record<string, string> = {
  draft: '草稿',
  active: '进行中',
  completed: '已完成',
  archived: '已归档',
  cancelled: '已取消',
};

export default function CollaborationWorkspacePage() {
  const router = useRouter();
  const params = useParams();
  const collaborationId = params.id as string;
  const [detail, setDetail] = React.useState<CollaborationDetail | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [activeTab, setActiveTab] = React.useState<TabKey>('overview');

  React.useEffect(() => {
    const fetchDetail = async () => {
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
    };
    fetchDetail();
  }, [collaborationId]);

  const handleTabClick = (tab: TabKey) => {
    setActiveTab(tab);
    if (tab === 'overview') {
      router.push(`/collaborations/${collaborationId}/overview`);
    } else {
      router.push(`/collaborations/${collaborationId}/${tab}`);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-5 w-5 animate-spin text-[var(--bz-text-muted)]" />
      </div>
    );
  }

  if (!detail) {
    return (
      <div className="text-center text-[var(--bz-text-muted)] py-12">
        协作不存在或无权访问
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={detail.title}
        description={detail.description ?? `${detail.code} · ${STATUS_LABEL[detail.status] ?? detail.status}`}
        actions={
          <div className="flex items-center gap-2">
            <span
              className="bz-badge"
              style={{
                fontSize: 11,
                background: detail.status === 'active' ? 'var(--bz-info-tint)' : 'var(--bz-border)',
                color: detail.status === 'active' ? 'var(--bz-info)' : 'var(--bz-text-sub)',
              }}
            >
              {STATUS_LABEL[detail.status] ?? detail.status}
            </span>
          </div>
        }
      />

      <div className="bz-card" style={{ borderRadius: 8 }}>
        <div className="flex items-center gap-1 p-2 border-b" style={{ borderColor: 'var(--bz-border)' }}>
          {TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => handleTabClick(tab.key)}
              className="flex items-center gap-1.5 px-3 py-2 rounded transition-colors text-[13px]"
              style={{
                borderRadius: 2,
                background: activeTab === tab.key ? 'var(--bz-brand-tint)' : 'transparent',
                color: activeTab === tab.key ? 'var(--bz-brand)' : 'var(--bz-text-sub)',
                fontWeight: activeTab === tab.key ? 600 : 400,
              }}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>

        <div className="p-4">
          <div className="grid grid-cols-3 gap-3 mb-4">
            <div className="rounded px-3 py-2" style={{ background: 'var(--bz-brand-tint)', borderRadius: 2 }}>
              <div className="text-[11px] text-[var(--bz-text-sub)]">协作类型</div>
              <div className="text-[14px] font-medium" style={{ color: 'var(--bz-brand)' }}>{detail.type}</div>
            </div>
            <div className="rounded px-3 py-2" style={{ background: 'var(--bz-info-tint)', borderRadius: 2 }}>
              <div className="text-[11px] text-[var(--bz-text-sub)]">创建时间</div>
              <div className="text-[14px] font-medium" style={{ color: 'var(--bz-info)' }}>
                {new Date(detail.createdAt).toLocaleDateString('zh-CN')}
              </div>
            </div>
            <div className="rounded px-3 py-2" style={{ background: 'var(--bz-gold-tint)', borderRadius: 2 }}>
              <div className="text-[11px] text-[var(--bz-text-sub)]">最近更新</div>
              <div className="text-[14px] font-medium" style={{ color: 'var(--bz-gold)' }}>
                {new Date(detail.updatedAt).toLocaleDateString('zh-CN')}
              </div>
            </div>
          </div>

          <div className="text-[13px] text-[var(--bz-text-sub)] text-center py-4">
            请选择上方 Tab 查看详细内容
          </div>
        </div>
      </div>
    </div>
  );
}