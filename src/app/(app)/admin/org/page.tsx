'use client';

import * as React from 'react';
import { PageHeader } from '@/components/layout/PageHeader';
import { Plus, Building2 } from 'lucide-react';

type OrgItem = {
  id: string;
  name: string;
  code: string;
  parentId: string | null;
  type: string;
  level: number;
  path: string;
  sort: number;
  status: string;
};

export default function OrgPage() {
  const [orgs, setOrgs] = React.useState<OrgItem[]>([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    try {
      const res = await fetch('/api/v1/admin/org');
      const json = await res.json();
      if (json.code === 0 && json.data) {
        setOrgs(json.data.items ?? []);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }

  const tree = React.useMemo(() => {
    const byParent = new Map<string | null, OrgItem[]>();
    for (const o of orgs) {
      const arr = byParent.get(o.parentId) ?? [];
      arr.push(o);
      byParent.set(o.parentId, arr);
    }
    for (const arr of byParent.values()) {
      arr.sort((a, b) => a.sort - b.sort);
    }
    return byParent;
  }, [orgs]);

  function renderTree(parentId: string | null, depth: number): React.ReactNode {
    const items = tree.get(parentId) ?? [];
    return items.map((o) => (
      <React.Fragment key={o.id}>
        <tr style={{ borderBottom: '1px solid var(--bz-line)' }}>
          <td className="px-4 py-2.5 text-[var(--bz-text)]" style={{ paddingLeft: `${depth * 20 + 16}px` }}>
            <div className="flex items-center gap-1.5">
              <Building2 className="h-3.5 w-3.5" style={{ color: 'var(--bz-brand)' }} />
              {o.name}
            </div>
          </td>
          <td className="px-4 py-2.5 text-[var(--bz-text-sub)]">{o.code}</td>
          <td className="px-4 py-2.5 text-[var(--bz-text-sub)]">
            {o.type === 'department' ? '部门' : o.type === 'division' ? '处室' : o.type}
          </td>
          <td className="px-4 py-2.5 text-[var(--bz-text-muted)]">L{o.level}</td>
          <td className="px-4 py-2.5">
            <span
              className="px-2 py-0.5 text-[12px]"
              style={{
                background: o.status === 'active' ? 'rgba(30,123,79,0.1)' : 'rgba(180,35,24,0.1)',
                color: o.status === 'active' ? 'var(--bz-ok)' : 'var(--bz-danger)',
                borderRadius: 6,
              }}
            >
              {o.status === 'active' ? '活跃' : '已停用'}
            </span>
          </td>
        </tr>
        {renderTree(o.id, depth + 1)}
      </React.Fragment>
    ));
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="组织管理"
        description="管理组织架构：部门、处室的层级关系与编码"
        actions={
          <button className="bz-btn bz-btn-primary text-[13px] flex items-center gap-1">
            <Plus className="h-4 w-4" />
            新建组织
          </button>
        }
      />

      {loading ? (
        <div className="bz-card p-8 text-center text-[14px] text-[var(--bz-text-muted)]" style={{ borderRadius: 6 }}>
          加载中…
        </div>
      ) : (
        <div className="bz-card overflow-hidden" style={{ borderRadius: 6 }}>
          <table className="w-full text-[13px]">
            <thead>
              <tr style={{ background: 'var(--bz-brand-tint)', borderBottom: '1px solid var(--bz-line)' }}>
                <th className="text-left px-4 py-2.5 font-medium text-[var(--bz-text)]">名称</th>
                <th className="text-left px-4 py-2.5 font-medium text-[var(--bz-text)]">编码</th>
                <th className="text-left px-4 py-2.5 font-medium text-[var(--bz-text)]">类型</th>
                <th className="text-left px-4 py-2.5 font-medium text-[var(--bz-text)]">层级</th>
                <th className="text-left px-4 py-2.5 font-medium text-[var(--bz-text)]">状态</th>
              </tr>
            </thead>
            <tbody>{renderTree(null, 0)}</tbody>
          </table>
        </div>
      )}
    </div>
  );
}