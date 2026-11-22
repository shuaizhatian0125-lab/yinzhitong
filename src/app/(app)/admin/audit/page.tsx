'use client';

import * as React from 'react';
import { PageHeader } from '@/components/layout/PageHeader';
import { Search, FileText } from 'lucide-react';

type AuditItem = {
  id: number;
  userId: string | null;
  username: string | null;
  action: string;
  resourceType: string;
  resourceId: string | null;
  result: string;
  createdAt: string;
  detail: Record<string, unknown> | null;
};

export default function AuditPage() {
  const [items, setItems] = React.useState<AuditItem[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [keyword, setKeyword] = React.useState('');
  const [resultFilter, setResultFilter] = React.useState('all');

  React.useEffect(() => {
    loadData();
  }, [resultFilter]);

  async function loadData() {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (resultFilter !== 'all') params.set('result', resultFilter);
      const res = await fetch(`/api/v1/admin/audit?${params.toString()}`);
      const json = await res.json();
      if (json.code === 0 && json.data) {
        setItems(json.data.items ?? []);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }

  const filtered = React.useMemo(() => {
    if (!keyword) return items;
    const kw = keyword.toLowerCase();
    return items.filter(
      (i) =>
        (i.username ?? '').toLowerCase().includes(kw) ||
        i.action.toLowerCase().includes(kw) ||
        i.resourceType.toLowerCase().includes(kw),
    );
  }, [items, keyword]);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="审计日志"
        description="系统操作审计记录，不可篡改的操作留痕"
      />

      <div className="bz-card flex items-center gap-3 px-4 py-3" style={{ borderRadius: 6 }}>
        <select
          value={resultFilter}
          onChange={(e) => setResultFilter(e.target.value)}
          className="text-[13px] px-2 py-1 rounded-[6px] outline-none"
          style={{ background: 'var(--bz-bg)', border: '1px solid var(--bz-line)', borderRadius: 6 }}
        >
          <option value="all">全部结果</option>
          <option value="success">成功</option>
          <option value="failed">失败</option>
        </select>

        <div className="flex items-center gap-1.5 flex-1 max-w-[240px]">
          <Search className="h-3.5 w-3.5 text-[var(--bz-text-muted)]" />
          <input
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            placeholder="搜索用户、操作或资源…"
            className="flex-1 bg-transparent text-[13px] outline-none placeholder:text-[var(--bz-text-muted)]"
          />
        </div>
      </div>

      {loading ? (
        <div className="bz-card p-8 text-center text-[14px] text-[var(--bz-text-muted)]" style={{ borderRadius: 6 }}>
          加载中…
        </div>
      ) : (
        <div className="bz-card overflow-hidden" style={{ borderRadius: 6 }}>
          <table className="w-full text-[13px]">
            <thead>
              <tr style={{ background: 'var(--bz-brand-tint)', borderBottom: '1px solid var(--bz-line)' }}>
                <th className="text-left px-4 py-2.5 font-medium text-[var(--bz-text)]">时间</th>
                <th className="text-left px-4 py-2.5 font-medium text-[var(--bz-text)]">用户</th>
                <th className="text-left px-4 py-2.5 font-medium text-[var(--bz-text)]">操作</th>
                <th className="text-left px-4 py-2.5 font-medium text-[var(--bz-text)]">资源类型</th>
                <th className="text-left px-4 py-2.5 font-medium text-[var(--bz-text)]">资源ID</th>
                <th className="text-left px-4 py-2.5 font-medium text-[var(--bz-text)]">结果</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((i) => (
                <tr key={i.id} style={{ borderBottom: '1px solid var(--bz-line)' }}>
                  <td className="px-4 py-2.5 text-[var(--bz-text-muted)]">
                    {new Date(i.createdAt).toLocaleString('zh-CN')}
                  </td>
                  <td className="px-4 py-2.5 text-[var(--bz-text)]">{i.username ?? '-'}</td>
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-1">
                      <FileText className="h-3 w-3" style={{ color: 'var(--bz-text-muted)' }} />
                      <span className="text-[var(--bz-text)]">{i.action}</span>
                    </div>
                  </td>
                  <td className="px-4 py-2.5 text-[var(--bz-text-sub)]">{i.resourceType}</td>
                  <td className="px-4 py-2.5 text-[var(--bz-text-muted)]">{i.resourceId ?? '-'}</td>
                  <td className="px-4 py-2.5">
                    <span
                      className="px-2 py-0.5 text-[12px]"
                      style={{
                        background: i.result === 'success' ? 'rgba(30,123,79,0.1)' : 'rgba(180,35,24,0.1)',
                        color: i.result === 'success' ? 'var(--bz-ok)' : 'var(--bz-danger)',
                        borderRadius: 6,
                      }}
                    >
                      {i.result === 'success' ? '成功' : '失败'}
                    </span>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-[var(--bz-text-muted)]">
                    暂无审计日志
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}