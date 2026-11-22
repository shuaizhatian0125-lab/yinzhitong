'use client';

import * as React from 'react';
import { PageHeader } from '@/components/layout/PageHeader';
import { Search, UserPlus, Shield, Trash2 } from 'lucide-react';

type UserItem = {
  id: string;
  username: string;
  displayName: string;
  roleCode: string;
  orgUnitId: string | null;
  status: string;
  title: string | null;
  lastLoginAt: string | null;
  createdAt: string;
};

type OrgItem = {
  id: string;
  name: string;
};

export default function UsersPage() {
  const [users, setUsers] = React.useState<UserItem[]>([]);
  const [orgs, setOrgs] = React.useState<OrgItem[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [keyword, setKeyword] = React.useState('');
  const [statusFilter, setStatusFilter] = React.useState('all');

  React.useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    try {
      const [usersRes, orgsRes] = await Promise.all([
        fetch('/api/v1/admin/users'),
        fetch('/api/v1/admin/org'),
      ]);
      const usersJson = await usersRes.json();
      const orgsJson = await orgsRes.json();
      if (usersJson.code === 0 && usersJson.data) {
        setUsers(usersJson.data.items ?? []);
      }
      if (orgsJson.code === 0 && orgsJson.data) {
        setOrgs(orgsJson.data.items ?? []);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }

  const orgMap = React.useMemo(() => {
    const m = new Map<string, string>();
    for (const o of orgs) m.set(o.id, o.name);
    return m;
  }, [orgs]);

  const filtered = React.useMemo(() => {
    let result = users;
    if (statusFilter !== 'all') {
      result = result.filter((u) => u.status === statusFilter);
    }
    if (keyword) {
      const kw = keyword.toLowerCase();
      result = result.filter(
        (u) =>
          u.username.toLowerCase().includes(kw) ||
          u.displayName.toLowerCase().includes(kw),
      );
    }
    return result;
  }, [users, statusFilter, keyword]);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="用户管理"
        description="管理平台用户账号、角色分配与组织归属"
        actions={
          <button className="bz-btn bz-btn-primary text-[13px] flex items-center gap-1">
            <UserPlus className="h-4 w-4" />
            新建用户
          </button>
        }
      />

      <div className="bz-card flex items-center gap-3 px-4 py-3" style={{ borderRadius: 6 }}>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="text-[13px] px-2 py-1 rounded-[6px] outline-none"
          style={{ background: 'var(--bz-bg)', border: '1px solid var(--bz-line)', borderRadius: 6 }}
        >
          <option value="all">全部状态</option>
          <option value="active">活跃</option>
          <option value="disabled">已禁用</option>
        </select>

        <div className="flex items-center gap-1.5 flex-1 max-w-[240px]">
          <Search className="h-3.5 w-3.5 text-[var(--bz-text-muted)]" />
          <input
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            placeholder="搜索用户名或姓名…"
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
                <th className="text-left px-4 py-2.5 font-medium text-[var(--bz-text)]">用户名</th>
                <th className="text-left px-4 py-2.5 font-medium text-[var(--bz-text)]">姓名</th>
                <th className="text-left px-4 py-2.5 font-medium text-[var(--bz-text)]">角色</th>
                <th className="text-left px-4 py-2.5 font-medium text-[var(--bz-text)]">所属组织</th>
                <th className="text-left px-4 py-2.5 font-medium text-[var(--bz-text)]">状态</th>
                <th className="text-left px-4 py-2.5 font-medium text-[var(--bz-text)]">最后登录</th>
                <th className="text-right px-4 py-2.5 font-medium text-[var(--bz-text)]">操作</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((u) => (
                <tr key={u.id} style={{ borderBottom: '1px solid var(--bz-line)' }}>
                  <td className="px-4 py-2.5 text-[var(--bz-text)]">{u.username}</td>
                  <td className="px-4 py-2.5 text-[var(--bz-text)]">{u.displayName}</td>
                  <td className="px-4 py-2.5">
                    <span
                      className="inline-flex items-center gap-1 px-2 py-0.5 text-[12px]"
                      style={{
                        background: 'var(--bz-brand-tint)',
                        color: 'var(--bz-brand)',
                        borderRadius: 6,
                      }}
                    >
                      <Shield className="h-3 w-3" />
                      {u.roleCode}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-[var(--bz-text-sub)]">
                    {u.orgUnitId ? orgMap.get(u.orgUnitId) ?? '-' : '-'}
                  </td>
                  <td className="px-4 py-2.5">
                    <span
                      className="px-2 py-0.5 text-[12px]"
                      style={{
                        background: u.status === 'active' ? 'rgba(30,123,79,0.1)' : 'rgba(180,35,24,0.1)',
                        color: u.status === 'active' ? 'var(--bz-ok)' : 'var(--bz-danger)',
                        borderRadius: 6,
                      }}
                    >
                      {u.status === 'active' ? '活跃' : '已禁用'}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-[var(--bz-text-muted)]">
                    {u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleDateString('zh-CN') : '-'}
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    <button
                      className="p-1 rounded-[6px] hover:bg-[var(--bz-brand-tint)]"
                      title="禁用用户"
                    >
                      <Trash2 className="h-3.5 w-3.5" style={{ color: 'var(--bz-danger)' }} />
                    </button>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-[var(--bz-text-muted)]">
                    暂无用户数据
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