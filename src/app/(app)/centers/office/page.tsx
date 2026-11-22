'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { FileText, Plus, Search, Clock } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { StatsSummaryBar } from '@/components/domain/StatsSummaryBar';

type DocumentItem = {
  id: string;
  title: string;
  docType: string;
  status: string;
  updatedAt: string;
  tags: string[];
};

const DOC_TYPE_LABELS: Record<string, string> = {
  report: '报告',
  analysis: '分析',
  research: '研究',
  minutes: '纪要',
  plan: '方案',
  weekly_report: '周报',
  monthly_report: '月报',
};

export default function OfficeListPage() {
  const router = useRouter();
  const [docs, setDocs] = React.useState<DocumentItem[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [searchQuery, setSearchQuery] = React.useState('');
  const [showCreate, setShowCreate] = React.useState(false);
  const [newTitle, setNewTitle] = React.useState('');
  const [newType, setNewType] = React.useState('report');
  const [templates, setTemplates] = React.useState<
    Array<{ id: string; name: string; docType: string }>
  >([]);
  const [selectedTemplate, setSelectedTemplate] = React.useState<string | undefined>();

  const fetchDocs = React.useCallback(async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('access_token') ?? '';
      const res = await fetch('/api/v1/documents', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json();
      if (json.code === 0 && json.data) {
        setDocs(json.data as DocumentItem[]);
      }
    } catch {
      // 忽略错误
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchTemplates = React.useCallback(async () => {
    try {
      const token = localStorage.getItem('access_token') ?? '';
      const res = await fetch('/api/v1/document-templates', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json();
      if (json.code === 0 && json.data) {
        setTemplates(
          (json.data as Array<{ id: string; name: string; docType: string }>).map((t) => ({
            id: t.id,
            name: t.name,
            docType: t.docType,
          })),
        );
      }
    } catch {
      // 忽略错误
    }
  }, []);

  React.useEffect(() => {
    fetchDocs();
    fetchTemplates();
  }, [fetchDocs, fetchTemplates]);

  const handleCreate = async () => {
    if (!newTitle.trim()) return;
    try {
      const res = await fetch('/api/v1/documents', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('access_token') ?? ''}`,
        },
        body: JSON.stringify({
          title: newTitle,
          docType: newType,
          templateId: selectedTemplate,
        }),
      });
      const json = await res.json();
      if (json.code === 0 && json.data) {
        setShowCreate(false);
        setNewTitle('');
        setSelectedTemplate(undefined);
        router.push(`/centers/office/${json.data.document.id}`);
      }
    } catch {
      // 忽略错误
    }
  };

  const filtered = docs.filter(
    (d) =>
      d.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      DOC_TYPE_LABELS[d.docType]?.includes(searchQuery),
  );

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="文档办公中心" description="行内格式模板驱动的公文、报告、方案生成与版本管理" />

      <StatsSummaryBar stats={[{label:'文档总数', value:2400}, {label:'待审批', value:18}, {label:'本月新增', value:120}]} />

      <div className="flex items-center gap-3">
        <div
          className="flex h-9 flex-1 items-center gap-2 rounded border px-3"
          style={{ background: 'var(--bz-bg)', borderColor: 'var(--bz-line-strong)' }}
        >
          <Search className="h-4 w-4 shrink-0" style={{ color: 'var(--bz-text-muted)' }} />
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="搜索文档…"
            className="flex-1 bg-transparent text-[13px] outline-none placeholder:text-[var(--bz-text-muted)]"
          />
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="bz-btn bz-btn-primary flex items-center gap-1.5 text-[13px]"
          style={{ borderRadius: 4 }}
        >
          <Plus className="h-4 w-4" />
          新建文档
        </button>
      </div>

      {showCreate && (
        <div className="bz-card p-4" style={{ borderRadius: 4 }}>
          <div className="mb-3 flex items-center gap-2">
            <FileText className="h-4 w-4" style={{ color: 'var(--bz-brand)' }} />
            <span className="text-[14px] font-medium">创建文档</span>
          </div>
          <div className="flex flex-col gap-3">
            <input
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              placeholder="文档标题"
              className="h-9 rounded border px-3 text-[13px] outline-none"
              style={{ borderColor: 'var(--bz-line-strong)', background: 'var(--bz-bg)' }}
            />
            <select
              value={newType}
              onChange={(e) => setNewType(e.target.value)}
              className="h-9 rounded border px-3 text-[13px] outline-none"
              style={{ borderColor: 'var(--bz-line-strong)', background: 'var(--bz-bg)' }}
            >
              <option value="report">报告</option>
              <option value="analysis">分析</option>
              <option value="research">研究</option>
              <option value="minutes">纪要</option>
              <option value="plan">方案</option>
            </select>
            {templates.length > 0 && (
              <select
                value={selectedTemplate ?? ''}
                onChange={(e) => setSelectedTemplate(e.target.value || undefined)}
                className="h-9 rounded border px-3 text-[13px] outline-none"
                style={{ borderColor: 'var(--bz-line-strong)', background: 'var(--bz-bg)' }}
              >
                <option value="">不使用模板</option>
                {templates.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            )}
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
          <FileText className="mx-auto mb-3 h-10 w-10" style={{ color: 'var(--bz-text-muted)' }} />
          <span className="text-[14px] text-[var(--bz-text-muted)]">
            {searchQuery ? '未找到匹配的文档' : '暂无文档，点击"新建文档"开始'}
          </span>
        </div>
      ) : (
        <div className="bz-card" style={{ borderRadius: 4 }}>
          <div className="p-3">
            {filtered.map((doc, idx) => (
              <button
                key={doc.id}
                onClick={() => router.push(`/centers/office/${doc.id}`)}
                className="flex items-center gap-3 w-full px-3 py-2.5 rounded text-left transition-colors hover:bg-[#fafcfe]"
                style={{
                  borderBottom: idx < filtered.length - 1 ? '1px solid #eef2f6' : 'none',
                }}
              >
                <div
                  className="flex h-8 w-8 items-center justify-center rounded shrink-0"
                  style={{ background: 'var(--bz-brand-tint)' }}
                >
                  <FileText className="h-4 w-4" style={{ color: 'var(--bz-brand)' }} />
                </div>
                <div className="flex-1 min-w-0">
                  <span className="text-[13px] font-medium text-[var(--bz-text)] truncate block">
                    {doc.title}
                  </span>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="bz-badge bz-badge-blue" style={{ fontSize: 10 }}>
                      {DOC_TYPE_LABELS[doc.docType] ?? doc.docType}
                    </span>
                    <span className="text-[11px] text-[var(--bz-text-muted)]">
                      {doc.status === 'draft' ? '草稿' : doc.status === 'published' ? '已发布' : doc.status}
                    </span>
                  </div>
                </div>
                <span className="text-[11px] text-[var(--bz-text-muted)] shrink-0 flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {new Date(doc.updatedAt).toLocaleDateString('zh-CN')}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}