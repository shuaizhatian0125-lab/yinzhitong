'use client';

import * as React from 'react';
import { Search, RotateCcw } from 'lucide-react';
import { VERIFICATION_LABEL } from '@/lib/tvd-labels';

export type EnterpriseSearchFilter = {
  region: string;
  industry: string;
  track: string;
  verification: string;
  keyword: string;
};

/** 接口 facets 字段：下拉选项直接来自库里出现过的值，而不是前端写死的一份名单。 */
export type EnterpriseFacets = {
  regions: string[];
  industries: string[];
  tracks: string[];
  verifications: string[];
};

type EnterpriseSearchBarProps = {
  facets?: EnterpriseFacets;
  onSearch: (filter: EnterpriseSearchFilter) => void;
  onReset: () => void;
};

const EMPTY: EnterpriseSearchFilter = {
  region: '',
  industry: '',
  track: '',
  verification: '',
  keyword: '',
};

function options(values: string[] | undefined, allLabel: string, render?: (v: string) => string) {
  return [
    { value: '', label: allLabel },
    ...(values ?? []).map((v) => ({ value: v, label: render ? render(v) : v })),
  ];
}

export function EnterpriseSearchBar({ facets, onSearch, onReset }: EnterpriseSearchBarProps) {
  const [filter, setFilter] = React.useState<EnterpriseSearchFilter>(EMPTY);

  const handleFieldChange = (field: keyof EnterpriseSearchFilter, value: string) => {
    setFilter((prev) => ({ ...prev, [field]: value }));
  };

  const handleSearch = () => {
    onSearch(filter);
  };

  const handleReset = () => {
    setFilter({ ...EMPTY });
    onReset();
  };

  const fields: { key: keyof EnterpriseSearchFilter; label: string; opts: { value: string; label: string }[] }[] = [
    { key: 'region', label: '区域', opts: options(facets?.regions, '全部区域') },
    { key: 'industry', label: '行业', opts: options(facets?.industries, '全部行业') },
    { key: 'track', label: '细分赛道', opts: options(facets?.tracks, '全部赛道') },
    {
      key: 'verification',
      label: '核验状态',
      opts: options(facets?.verifications, '全部核验状态', (v) => VERIFICATION_LABEL[v]?.label ?? v),
    },
  ];

  return (
    <div className="bz-card bz-shadow-soft" style={{ borderRadius: 6 }}>
      <div className="bz-card-head">
        <span className="bz-card-title">企业筛选</span>
        <span className="text-[12px] text-[var(--bz-text-muted)]">
          下拉选项来自当前库中实际存在的值{facets ? `（区域 ${facets.regions.length} · 行业 ${facets.industries.length} · 赛道 ${facets.tracks.length}）` : ''}
        </span>
        <button className="bz-btn bz-btn-ghost text-[12px]" onClick={handleReset}>
          <RotateCcw className="h-3.5 w-3.5" />
          重置
        </button>
      </div>
      <div className="p-4">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
          {fields.map((f) => (
            <div key={f.key}>
              <label className="bz-label">{f.label}</label>
              <select
                className="bz-select"
                value={filter[f.key]}
                onChange={(e) => handleFieldChange(f.key, e.target.value)}
              >
                {f.opts.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          ))}
          <div>
            <label className="bz-label">关键词</label>
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--bz-text-muted)]" />
              <input
                className="bz-input pl-8"
                placeholder="搜索企业名称/技术关键词"
                value={filter.keyword}
                onChange={(e) => handleFieldChange('keyword', e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSearch();
                }}
              />
            </div>
          </div>
        </div>
        <div className="mt-3 flex justify-end">
          <button className="bz-btn bz-btn-primary" onClick={handleSearch}>
            <Search className="h-3.5 w-3.5" />
            搜索
          </button>
        </div>
      </div>
    </div>
  );
}
