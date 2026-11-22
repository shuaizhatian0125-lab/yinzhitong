'use client';

import * as React from 'react';
import { PageHeader } from '@/components/layout/PageHeader';
import { Plus, Shield, Lock } from 'lucide-react';

type RoleItem = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  isSystem: boolean;
  dataScope: string;
  permissions: string[];
};

const DATA_SCOPE_LABELS: Record<string, string> = {
  self: '仅本人',
  org: '本部门',
  org_and_below: '本部门及下属',
  all: '全部',
};

export default function RolesPage() {
  const [roles, setRoles] = React.useState<RoleItem[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [selectedRole, setSelectedRole] = React.useState<string | null>(null);

  React.useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    try {
      const res = await fetch('/api/v1/admin/roles');
      const json = await res.json();
      if (json.code === 0 && json.data) {
        setRoles(json.data.items ?? []);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }

  const currentRole = roles.find((r) => r.id === selectedRole);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="角色权限"
        description="管理角色定义、数据范围与权限分配"
        actions={
          <button className="bz-btn bz-btn-primary text-[13px] flex items-center gap-1">
            <Plus className="h-4 w-4" />
            新建角色
          </button>
        }
      />

      {loading ? (
        <div className="bz-card p-8 text-center text-[14px] text-[var(--bz-text-muted)]" style={{ borderRadius: 6 }}>
          加载中…
        </div>
      ) : (
        <div className="grid grid-cols-[1fr_360px] gap-4">
          <div className="bz-card overflow-hidden" style={{ borderRadius: 6 }}>
            <table className="w-full text-[13px]">
              <thead>
                <tr style={{ background: 'var(--bz-brand-tint)', borderBottom: '1px solid var(--bz-line)' }}>
                  <th className="text-left px-4 py-2.5 font-medium text-[var(--bz-text)]">角色</th>
                  <th className="text-left px-4 py-2.5 font-medium text-[var(--bz-text)]">编码</th>
                  <th className="text-left px-4 py-2.5 font-medium text-[var(--bz-text)]">数据范围</th>
                  <th className="text-left px-4 py-2.5 font-medium text-[var(--bz-text)]">系统角色</th>
                  <th className="text-left px-4 py-2.5 font-medium text-[var(--bz-text)]">权限数</th>
                </tr>
              </thead>
              <tbody>
                {roles.map((r) => (
                  <tr
                    key={r.id}
                    onClick={() => setSelectedRole(r.id)}
                    style={{
                      borderBottom: '1px solid var(--bz-line)',
                      cursor: 'pointer',
                      background: selectedRole === r.id ? 'var(--bz-brand-tint)' : undefined,
                    }}
                  >
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-1.5">
                        <Shield className="h-3.5 w-3.5" style={{ color: 'var(--bz-brand)' }} />
                        <span className="text-[var(--bz-text)]">{r.name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-2.5 text-[var(--bz-text-sub)]">{r.code}</td>
                    <td className="px-4 py-2.5 text-[var(--bz-text-sub)]">
                      {DATA_SCOPE_LABELS[r.dataScope] ?? r.dataScope}
                    </td>
                    <td className="px-4 py-2.5">
                      {r.isSystem ? (
                        <span
                          className="px-2 py-0.5 text-[12px]"
                          style={{ background: 'var(--bz-gold-tint)', color: 'var(--bz-gold)', borderRadius: 6 }}
                        >
                          <Lock className="h-3 w-3 inline mr-0.5" />
                          系统
                        </span>
                      ) : (
                        <span className="text-[12px] text-[var(--bz-text-muted)]">自定义</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-[var(--bz-text-sub)]">{r.permissions.length}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="bz-card p-4" style={{ borderRadius: 6 }}>
            {currentRole ? (
              <div className="flex flex-col gap-3">
                <div className="flex items-center gap-2">
                  <Shield className="h-4 w-4" style={{ color: 'var(--bz-brand)' }} />
                  <h3 className="text-[15px] font-semibold text-[var(--bz-text)]">{currentRole.name}</h3>
                </div>
                <p className="text-[13px] text-[var(--bz-text-sub)]">
                  {currentRole.description ?? '无描述'}
                </p>
                <div className="flex items-center gap-2 text-[13px]">
                  <span className="text-[var(--bz-text-muted)]">数据范围：</span>
                  <span className="text-[var(--bz-text)]">
                    {DATA_SCOPE_LABELS[currentRole.dataScope] ?? currentRole.dataScope}
                  </span>
                </div>
                <div className="flex flex-col gap-1.5">
                  <span className="text-[13px] text-[var(--bz-text-muted)]">权限列表</span>
                  <div className="flex flex-wrap gap-1">
                    {currentRole.permissions.map((p) => (
                      <span
                        key={p}
                        className="px-2 py-0.5 text-[12px]"
                        style={{
                          background: 'var(--bz-brand-tint)',
                          color: 'var(--bz-brand)',
                          borderRadius: 6,
                        }}
                      >
                        {p}
                      </span>
                    ))}
                    {currentRole.permissions.length === 0 && (
                      <span className="text-[13px] text-[var(--bz-text-muted)]">暂无权限</span>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center text-[14px] text-[var(--bz-text-muted)] py-8">
                选择左侧角色查看详情
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}