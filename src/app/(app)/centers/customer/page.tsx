'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { PageHeader } from '@/components/layout/PageHeader';
import { StatsSummaryBar } from '@/components/domain/StatsSummaryBar';

type CustomerListItem = {
  id: string;
  name: string;
  type: string;
  level: string | null;
  status: string;
  tags: string[];
  manager_id: string | null;
  updated_at: string;
};

const TYPE_LABEL: Record<string, string> = {
  corp: '对公',
  retail: '零售',
};

const LEVEL_LABEL: Record<string, string> = {
  A: 'A级',
  B: 'B级',
  C: 'C级',
  D: 'D级',
};

const STATUS_VARIANT: Record<string, string> = {
  active: 'bz-badge-ok',
  inactive: 'bz-badge-gray',
  prospect: 'bz-badge-blue',
};

const STATUS_LABEL: Record<string, string> = {
  active: '活跃',
  inactive: ' inactive',
  prospect: '潜在',
};

export default function CustomerListPage() {
  const router = useRouter();
  const [items, setItems] = React.useState<CustomerListItem[]>([]);
  const [total, setTotal] = React.useState(0);
  const [loading, setLoading] = React.useState(true);
  const [keyword, setKeyword] = React.useState('');
  const [typeFilter, setTypeFilter] = React.useState('');
  const [levelFilter, setLevelFilter] = React.useState('');

  const fetchCustomers = React.useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (keyword) params.set('keyword', keyword);
      if (typeFilter) params.set('type', typeFilter);
      if (levelFilter) params.set('level', levelFilter);

      const res = await fetch(`/api/v1/customers?${params.toString()}`);
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
  }, [keyword, typeFilter, levelFilter]);

  React.useEffect(() => {
    fetchCustomers();
  }, [fetchCustomers]);

  const handleRowClick = (id: string) => {
    router.push(`/centers/customer/${id}`);
  };

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="客户经营中心" description="客户全景画像、商机识别、拜访规划与生命周期管理" />

      <StatsSummaryBar stats={[{label:'客户总数', value:1280}, {label:'活跃客户', value:856}, {label:'本月新增', value:42}]} />

      <div className="bz-card" style={{ borderRadius: 4 }}>
        <div className="p-3 flex items-center gap-3 flex-wrap">
          <input
            type="text"
            placeholder="搜索客户名称"
            className="bz-input"
            style={{ width: 200 }}
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
          />
          <select
            className="bz-input"
            style={{ width: 120 }}
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
          >
            <option value="">全部类型</option>
            <option value="corp">对公</option>
            <option value="retail">零售</option>
          </select>
          <select
            className="bz-input"
            style={{ width: 120 }}
            value={levelFilter}
            onChange={(e) => setLevelFilter(e.target.value)}
          >
            <option value="">全部等级</option>
            <option value="A">A级</option>
            <option value="B">B级</option>
            <option value="C">C级</option>
            <option value="D">D级</option>
          </select>
          <button className="bz-btn bz-btn-default" onClick={fetchCustomers}>
            查询
          </button>
        </div>
      </div>

      <div className="bz-card" style={{ borderRadius: 4 }}>
        <div className="bz-card-head">
          <span className="bz-card-title">客户列表</span>
          <span className="text-[12px] text-[var(--bz-text-muted)]">共 {total} 个客户</span>
        </div>
        <div className="bz-scroll">
          <table className="bz-table">
            <thead>
              <tr>
                <th>客户名称</th>
                <th>客户类型</th>
                <th>客户等级</th>
                <th>状态</th>
                <th>标签</th>
                <th>更新时间</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={6} className="text-center text-[var(--bz-text-muted)] py-8">
                    加载中…
                  </td>
                </tr>
              )}
              {!loading && items.length === 0 && (
                <tr>
                  <td colSpan={6} className="text-center text-[var(--bz-text-muted)] py-8">
                    暂无匹配的客户数据
                  </td>
                </tr>
              )}
              {!loading && items.map((item) => (
                <tr
                  key={item.id}
                  className="cursor-pointer"
                  onClick={() => handleRowClick(item.id)}
                >
                  <td className="font-medium text-[var(--bz-text)]">{item.name}</td>
                  <td>{TYPE_LABEL[item.type] ?? item.type}</td>
                  <td>{item.level ? (LEVEL_LABEL[item.level] ?? item.level) : '待补充'}</td>
                  <td>
                    <span className={`bz-badge ${STATUS_VARIANT[item.status] ?? 'bz-badge-gray'}`}>
                      {STATUS_LABEL[item.status] ?? item.status}
                    </span>
                  </td>
                  <td>
                    {item.tags && item.tags.length > 0 ? (
                      <div className="flex flex-wrap gap-1">
                        {item.tags.slice(0, 3).map((tag) => (
                          <span key={tag} className="bz-badge bz-badge-blue" style={{ fontSize: 11 }}>
                            {tag}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <span className="text-[var(--bz-text-muted)]">无</span>
                    )}
                  </td>
                  <td className="text-[var(--bz-text-muted)]">
                    {new Date(item.updated_at).toLocaleDateString('zh-CN')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}