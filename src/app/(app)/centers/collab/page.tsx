'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Loader2 } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { StatsSummaryBar } from '@/components/domain/StatsSummaryBar';
import { CollaborationCard, type Collaboration } from '@/components/domain/CollaborationCard';

const STATUS_OPTIONS = [
  { value: '', label: '全部状态' },
  { value: 'active', label: '进行中' },
  { value: 'completed', label: '已完成' },
  { value: 'archived', label: '已归档' },
];

const TYPE_OPTIONS = [
  { value: '', label: '全部类型' },
  { value: 'project', label: '项目' },
  { value: 'task', label: '任务' },
  { value: 'meeting', label: '会议' },
  { value: 'review', label: '评审' },
];

export default function CollabListPage() {
  const router = useRouter();
  const [items, setItems] = React.useState<Collaboration[]>([]);
  const [total, setTotal] = React.useState(0);
  const [loading, setLoading] = React.useState(true);
  const [status, setStatus] = React.useState('');
  const [type, setType] = React.useState('');
  const [keyword, setKeyword] = React.useState('');
  const [showCreate, setShowCreate] = React.useState(false);
  const [createForm, setCreateForm] = React.useState({ title: '', description: '', type: 'project' });
  const [creating, setCreating] = React.useState(false);

  const fetchCollaborations = React.useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (status) params.set('status', status);
      if (type) params.set('type', type);
      if (keyword) params.set('keyword', keyword);

      const res = await fetch(`/api/v1/collaborations?${params.toString()}`);
      const json = await res.json();
      if (json.code === 0 && json.data) {
        setItems(json.data.items ?? []);
        setTotal(json.data.total ?? 0);
      } else {
        setItems([]);
        setTotal(0);
      }
    } catch {
      setItems([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [status, type, keyword]);

  React.useEffect(() => {
    fetchCollaborations();
  }, [fetchCollaborations]);

  const handleCreate = async () => {
    if (!createForm.title.trim()) return;
    setCreating(true);
    try {
      const res = await fetch('/api/v1/collaborations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: createForm.title,
          description: createForm.description,
          type: createForm.type,
        }),
      });
      const json = await res.json();
      if (json.code === 0 && json.data) {
        setShowCreate(false);
        setCreateForm({ title: '', description: '', type: 'project' });
        fetchCollaborations();
      }
    } catch {
      // ignore
    } finally {
      setCreating(false);
    }
  };

  const handleCardClick = (collaboration: Collaboration) => {
    router.push(`/centers/collab/${collaboration.id}`);
  };

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="流程协同中心"
        description="协同事项、工作流引擎、审批管理"
        actions={
          <button
            className="bz-btn bz-btn-primary"
            style={{ borderRadius: 6 }}
            onClick={() => setShowCreate(true)}
          >
            <Plus className="h-4 w-4" />
            新建协同
          </button>
        }
      />

      <StatsSummaryBar stats={[{label:'进行中', value:12}, {label:'已完成', value:34}, {label:'总计', value:46}]} />

      <div className="flex items-center gap-3 flex-wrap">
        <select
          className="text-[13px] px-3 py-1.5 rounded border"
          style={{ borderColor: 'var(--bz-line)', borderRadius: 3 }}
          value={status}
          onChange={(e) => setStatus(e.target.value)}
        >
          {STATUS_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>

        <select
          className="text-[13px] px-3 py-1.5 rounded border"
          style={{ borderColor: 'var(--bz-line)', borderRadius: 3 }}
          value={type}
          onChange={(e) => setType(e.target.value)}
        >
          {TYPE_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>

        <input
          type="text"
          placeholder="搜索协同事项..."
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          className="text-[13px] px-3 py-1.5 rounded border flex-1"
          style={{ borderColor: 'var(--bz-line)', borderRadius: 3, minWidth: 200 }}
        />
      </div>

      {loading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-5 w-5 animate-spin text-[var(--bz-text-muted)]" />
        </div>
      )}

      {!loading && items.length === 0 && (
        <div className="text-center text-[var(--bz-text-muted)] py-12">
          暂无协同事项
        </div>
      )}

      {!loading && items.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {items.map((item) => (
            <CollaborationCard
              key={item.id}
              collaboration={item}
              onClick={handleCardClick}
            />
          ))}
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
            style={{ borderRadius: 4, padding: 20, width: 400, maxWidth: '90vw' }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-[16px] font-semibold text-[var(--bz-text)] mb-4">新建协同事项</h3>
            <div className="flex flex-col gap-3">
              <input
                type="text"
                placeholder="标题"
                value={createForm.title}
                onChange={(e) => setCreateForm({ ...createForm, title: e.target.value })}
                className="text-[14px] px-3 py-2 rounded border"
                style={{ borderColor: 'var(--bz-line)', borderRadius: 3 }}
              />
              <textarea
                placeholder="描述"
                value={createForm.description}
                onChange={(e) => setCreateForm({ ...createForm, description: e.target.value })}
                className="text-[14px] px-3 py-2 rounded border"
                style={{ borderColor: 'var(--bz-line)', borderRadius: 3, minHeight: 80 }}
              />
              <select
                className="text-[14px] px-3 py-2 rounded border"
                style={{ borderColor: 'var(--bz-line)', borderRadius: 3 }}
                value={createForm.type}
                onChange={(e) => setCreateForm({ ...createForm, type: e.target.value })}
              >
                <option value="project">项目</option>
                <option value="task">任务</option>
                <option value="meeting">会议</option>
                <option value="review">评审</option>
              </select>
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
                  disabled={creating || !createForm.title.trim()}
                >
                  {creating ? '创建中...' : '创建'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}