'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { BookOpen, Plus, Search, FileText, ChevronRight } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { StatsSummaryBar } from '@/components/domain/StatsSummaryBar';

type KnowledgeBase = {
  id: string;
  name: string;
  description: string | null;
  visibility: string;
  status: string;
  createdAt: string;
};

export default function KnowledgeListPage() {
  const router = useRouter();
  const [bases, setBases] = React.useState<KnowledgeBase[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [showCreate, setShowCreate] = React.useState(false);
  const [newName, setNewName] = React.useState('');
  const [newDesc, setNewDesc] = React.useState('');
  const [searchQuery, setSearchQuery] = React.useState('');

  const fetchBases = React.useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/v1/knowledge/bases', {
        headers: { Authorization: `Bearer ${localStorage.getItem('access_token') ?? ''}` },
      });
      const json = await res.json();
      if (json.code === 0 && json.data) {
        setBases(json.data as KnowledgeBase[]);
      }
    } catch {
      // 忽略错误
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    fetchBases();
  }, [fetchBases]);

  const handleCreate = async () => {
    if (!newName.trim()) return;
    try {
      const res = await fetch('/api/v1/knowledge/bases', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('access_token') ?? ''}`,
        },
        body: JSON.stringify({ name: newName, description: newDesc }),
      });
      const json = await res.json();
      if (json.code === 0) {
        setShowCreate(false);
        setNewName('');
        setNewDesc('');
        fetchBases();
      }
    } catch {
      // 忽略错误
    }
  };

  const filtered = bases.filter(
    (b) =>
      b.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (b.description ?? '').toLowerCase().includes(searchQuery.toLowerCase()),
  );

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="知识中心" description="制度、产品、案例知识库，检索增强问答" />

      <StatsSummaryBar stats={[{label:'知识条目', value:3200}, {label:'本月更新', value:156}, {label:'问答次数', value:890}]} />

      <div className="flex items-center gap-3">
        <div
          className="flex h-9 flex-1 items-center gap-2 rounded border px-3"
          style={{ background: 'var(--bz-bg)', borderColor: 'var(--bz-line-strong)' }}
        >
          <Search className="h-4 w-4 shrink-0" style={{ color: 'var(--bz-text-muted)' }} />
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="搜索知识库…"
            className="flex-1 bg-transparent text-[13px] outline-none placeholder:text-[var(--bz-text-muted)]"
          />
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="bz-btn bz-btn-primary flex items-center gap-1.5 text-[13px]"
          style={{ borderRadius: 4 }}
        >
          <Plus className="h-4 w-4" />
          新建知识库
        </button>
      </div>

      {showCreate && (
        <div className="bz-card p-4" style={{ borderRadius: 4 }}>
          <div className="mb-3 flex items-center gap-2">
            <BookOpen className="h-4 w-4" style={{ color: 'var(--bz-brand)' }} />
            <span className="text-[14px] font-medium">创建知识库</span>
          </div>
          <div className="flex flex-col gap-3">
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="知识库名称"
              className="h-9 rounded border px-3 text-[13px] outline-none"
              style={{ borderColor: 'var(--bz-line-strong)', background: 'var(--bz-bg)' }}
            />
            <textarea
              value={newDesc}
              onChange={(e) => setNewDesc(e.target.value)}
              placeholder="知识库描述（可选）"
              rows={2}
              className="rounded border px-3 py-2 text-[13px] outline-none"
              style={{ borderColor: 'var(--bz-line-strong)', background: 'var(--bz-bg)' }}
            />
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowCreate(false)}
                className="bz-btn bz-btn-ghost text-[13px]"
                style={{ borderRadius: 4 }}
              >
                取消
              </button>
              <button
                onClick={handleCreate}
                className="bz-btn bz-btn-primary text-[13px]"
                style={{ borderRadius: 4 }}
              >
                创建
              </button>
            </div>
          </div>
        </div>
      )}

      {loading ? (
        <div className="bz-card p-8 text-center" style={{ borderRadius: 4 }}>
          <span className="text-[14px] text-[var(--bz-text-muted)]">加载中…</span>
        </div>
      ) : filtered.length === 0 ? (
        <div className="bz-card p-8 text-center" style={{ borderRadius: 4 }}>
          <BookOpen className="mx-auto mb-3 h-10 w-10" style={{ color: 'var(--bz-text-muted)' }} />
          <span className="text-[14px] text-[var(--bz-text-muted)]">
            {searchQuery ? '未找到匹配的知识库' : '暂无知识库，点击"新建知识库"开始'}
          </span>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          {filtered.map((kb) => (
            <button
              key={kb.id}
              onClick={() => router.push(`/centers/knowledge/${kb.id}`)}
              className="bz-card flex flex-col gap-2 p-4 text-left transition-colors hover:border-[var(--bz-brand)]"
              style={{ borderRadius: 4 }}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div
                    className="flex h-8 w-8 items-center justify-center rounded"
                    style={{ background: 'var(--bz-brand-tint)' }}
                  >
                    <BookOpen className="h-4 w-4" style={{ color: 'var(--bz-brand)' }} />
                  </div>
                  <span className="text-[14px] font-medium text-[var(--bz-text)]">{kb.name}</span>
                </div>
                <ChevronRight className="h-4 w-4" style={{ color: 'var(--bz-text-muted)' }} />
              </div>
              {kb.description && (
                <span className="text-[12px] text-[var(--bz-text-muted)] line-clamp-2">
                  {kb.description}
                </span>
              )}
              <div className="flex items-center gap-2 mt-1">
                <span className="bz-badge bz-badge-blue" style={{ fontSize: 11 }}>
                  {kb.visibility === 'org' ? '部门可见' : '公开'}
                </span>
                <span className="text-[11px] text-[var(--bz-text-muted)]">
                  {new Date(kb.createdAt).toLocaleDateString('zh-CN')}
                </span>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}