'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { PageHeader } from '@/components/layout/PageHeader';
import { authFetch, loginUrl } from '@/lib/auth-client';
import { StatsSummaryBar } from '@/components/domain/StatsSummaryBar';
import { EnterpriseSearchBar, type EnterpriseFacets, type EnterpriseSearchFilter } from '@/components/domain/EnterpriseSearchBar';
import { ConnectorStatusPanel } from '@/components/domain/ConnectorStatusPanel';

/**
 * 企业金融中心。
 *
 * 数据来源已切到 TVD 语料（/api/v1/tvd/enterprises）：顶栏三个数字直接取接口里的
 * stats，而 stats 是库里的 count(*)。之前这里写死过 560/180/23，跟库里有没有数据无关，
 * 属于"装饰性统计"，是本次升级要消灭的东西。
 *
 * 评分列在评分器跑之前一律显示"待评分"，不填 0 —— 缺数据不等于 0 分。
 */

type TvdEnterpriseItem = {
  id: string;
  name: string;
  industry: string | null;
  track: string | null;
  region: string | null;
  qualifications: string[];
  techKeywords: string[];
  patentTotal: number | null;
  inventionCount: number | null;
  validInventionRatio: string | null;
  overallScore: string | null;
  dataCoverage: string | null;
  pendingVerification: number;
  verificationStatus: string;
  dataKind: string;
  updatedAt: string;
  /** 日期在服务端算好放进 state，渲染期不再碰 Date，避免 CSR/SSR 文本不一致。 */
  updatedLabel: string;
};

type TvdStats = { enterprises: number; patents: number; pendingVerification: number };

const VERIFY_LABEL: Record<string, string> = {
  unverified: '未核验',
  single_source: '单源',
  multi_source: '多源',
  verified: '已核验',
  disputed: '有争议',
};

const VERIFY_CLASS: Record<string, string> = {
  unverified: 'bz-badge-gray',
  single_source: 'bz-badge-warn',
  multi_source: 'bz-badge-blue',
  verified: 'bz-badge-ok',
  disputed: 'bz-badge-danger',
};

const PAGE_SIZE = 20;

function fmt(n: number | null | undefined): string {
  return n === null || n === undefined ? '—' : String(n);
}

export default function EnterpriseListPage() {
  const router = useRouter();
  const [items, setItems] = React.useState<TvdEnterpriseItem[]>([]);
  const [total, setTotal] = React.useState(0);
  const [stats, setStats] = React.useState<TvdStats | null>(null);
  const [page, setPage] = React.useState(1);
  const [loading, setLoading] = React.useState(true);
  const [failed, setFailed] = React.useState<string | null>(null);
  const [facets, setFacets] = React.useState<EnterpriseFacets | null>(null);
  const [filter, setFilter] = React.useState<EnterpriseSearchFilter>({
    region: '',
    industry: '',
    track: '',
    verification: '',
    keyword: '',
  });

  const fetchEnterprises = React.useCallback(async (currentFilter: EnterpriseSearchFilter, currentPage: number) => {
    setLoading(true);
    setFailed(null);
    try {
      const params = new URLSearchParams();
      if (currentFilter.region) params.set('region', currentFilter.region);
      if (currentFilter.industry) params.set('industry', currentFilter.industry);
      if (currentFilter.track) params.set('track', currentFilter.track);
      if (currentFilter.verification) params.set('verification', currentFilter.verification);
      if (currentFilter.keyword) params.set('keyword', currentFilter.keyword);
      params.set('page', String(currentPage));
      params.set('page_size', String(PAGE_SIZE));

      const res = await authFetch<{
        items: TvdEnterpriseItem[];
        total: number;
        facets: EnterpriseFacets;
        stats: TvdStats;
      }>(`/api/v1/tvd/enterprises?${params.toString()}`);

      // 401 时令牌已被清掉，直接把用户送去登录页并带上 return path，
      // 不要再往下渲染成"暂无企业数据"。
      if (res.unauthorized) {
        router.push(loginUrl());
        return;
      }

      if (!res.ok || !res.data) {
        setItems([]);
        setTotal(0);
        setStats(null);
        setFacets(null);
        setFailed(res.message ?? '企业数据接口返回异常');
        return;
      }

      const data = res.data;
      setItems(
        (data.items ?? []).map((it) => ({
          ...it,
          updatedLabel: new Date(it.updatedAt).toLocaleDateString('zh-CN'),
        })),
      );
      setTotal(data.total ?? 0);
      setStats(data.stats ?? null);
      setFacets(data.facets ?? null);
    } finally {
      setLoading(false);
    }
  }, [router]);

  React.useEffect(() => {
    fetchEnterprises(filter, page);
  }, [fetchEnterprises, filter, page]);

  const handleSearch = (newFilter: EnterpriseSearchFilter) => {
    setPage(1);
    setFilter(newFilter);
  };

  const handleReset = () => {
    setPage(1);
    setFilter({ region: '', industry: '', track: '', verification: '', keyword: '' });
  };

  const handleRowClick = (id: string) => {
    router.push(`/centers/enterprise/tvd/${id}`);
  };

  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="flex flex-col gap-4 md:gap-6">
      <PageHeader title="企业金融中心" description="企业客户全景、技术信用画像、专利与证据溯源" />

      <div className="flex flex-wrap items-center gap-2 text-[12px]">
        <span className="bz-badge bz-badge-warn">演示数据</span>
        <span className="text-[var(--bz-text-muted)]">
          企业名与主导产品取自公开名单；专利、评分类数值为演示合成值，接口与页面均按 data_kind 标注来源等级。
        </span>
      </div>

      <StatsSummaryBar
        stats={[
          { label: '企业总数', value: stats ? stats.enterprises : '—' },
          { label: '专利总数', value: stats ? stats.patents : '—' },
          { label: '待核实企业', value: stats ? stats.pendingVerification : '—' },
        ]}
      />

      <ConnectorStatusPanel />

      <EnterpriseSearchBar facets={facets ?? undefined} onSearch={handleSearch} onReset={handleReset} />

      {failed && (
        <div className="bz-card rounded-[6px] px-4 py-3 text-[13px] text-[var(--bz-danger,#cc0000)]">
          {failed}
        </div>
      )}

      <div className="bz-card" style={{ borderRadius: 4 }}>
        <div className="bz-card-head">
          <span className="bz-card-title">企业列表</span>
          <span className="text-[12px] text-[var(--bz-text-muted)]">共 {total} 家企业</span>
        </div>

        {/* 移动端卡片列表 */}
        <div className="md:hidden flex flex-col gap-2 p-3">
          {loading && <div className="text-center text-[var(--bz-text-muted)] py-8">加载中…</div>}
          {!loading && items.length === 0 && (
            <div className="text-center text-[var(--bz-text-muted)] py-8">暂无匹配的企业数据</div>
          )}
          {!loading &&
            items.map((item) => (
              <div
                key={item.id}
                className="rounded-[6px] border p-3 cursor-pointer"
                style={{ borderColor: 'var(--bz-border)' }}
                onClick={() => handleRowClick(item.id)}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="font-medium text-[var(--bz-text)] text-[14px]">{item.name}</span>
                  <span className={`bz-badge ${VERIFY_CLASS[item.verificationStatus] ?? 'bz-badge-gray'}`}>
                    {VERIFY_LABEL[item.verificationStatus] ?? item.verificationStatus}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-[12px] text-[var(--bz-text-sub)] mb-1">
                  <span>{item.industry ?? '待补充'}</span>
                  <span>·</span>
                  <span>{item.region ?? '待补充'}</span>
                  <span>·</span>
                  <span>{item.overallScore === null ? '待评分' : `${item.overallScore} 分`}</span>
                </div>
                <div className="flex items-center gap-3 text-[12px] text-[var(--bz-text-muted)]">
                  <span>专利 {fmt(item.patentTotal)}</span>
                  <span>发明 {fmt(item.inventionCount)}</span>
                </div>
                {item.techKeywords.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {item.techKeywords.slice(0, 3).map((tag) => (
                      <span key={tag} className="bz-badge bz-badge-blue" style={{ fontSize: 11 }}>
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))}
        </div>

        {/* PC 端表格 */}
        <div className="hidden md:block bz-scroll">
          <table className="bz-table">
            <thead>
              <tr>
                <th>企业名称</th>
                <th>所属行业</th>
                <th>细分赛道</th>
                <th>所在区域</th>
                <th className="text-right">专利总数</th>
                <th className="text-right">发明专利</th>
                <th>评分</th>
                <th>核验</th>
                <th>更新时间</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={9} className="text-center text-[var(--bz-text-muted)] py-8">
                    加载中…
                  </td>
                </tr>
              )}
              {!loading && items.length === 0 && (
                <tr>
                  <td colSpan={9} className="text-center text-[var(--bz-text-muted)] py-8">
                    暂无匹配的企业数据
                  </td>
                </tr>
              )}
              {!loading &&
                items.map((item) => (
                  <tr key={item.id} className="cursor-pointer" onClick={() => handleRowClick(item.id)}>
                    <td className="font-medium text-[var(--bz-text)]">{item.name}</td>
                    <td>{item.industry ?? '待补充'}</td>
                    <td>{item.track ?? '待补充'}</td>
                    <td>{item.region ?? '待补充'}</td>
                    <td className="text-right tabular-nums">{fmt(item.patentTotal)}</td>
                    <td className="text-right tabular-nums">{fmt(item.inventionCount)}</td>
                    <td>
                      {item.overallScore === null ? (
                        <span className="text-[var(--bz-text-muted)]">待评分</span>
                      ) : (
                        <span className="tabular-nums">{item.overallScore}</span>
                      )}
                    </td>
                    <td>
                      <span className={`bz-badge ${VERIFY_CLASS[item.verificationStatus] ?? 'bz-badge-gray'}`}>
                        {VERIFY_LABEL[item.verificationStatus] ?? item.verificationStatus}
                      </span>
                    </td>
                    <td className="text-[var(--bz-text-muted)]">{item.updatedLabel}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>

        {total > PAGE_SIZE && (
          <div className="flex items-center justify-end gap-3 px-4 py-3 text-[12px] text-[var(--bz-text-sub)]">
            <button
              type="button"
              className="bz-btn bz-btn-ghost"
              disabled={page <= 1 || loading}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              上一页
            </button>
            <span>
              {page} / {pageCount}
            </span>
            <button
              type="button"
              className="bz-btn bz-btn-ghost"
              disabled={page >= pageCount || loading}
              onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
            >
              下一页
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
