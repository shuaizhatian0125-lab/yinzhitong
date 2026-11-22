'use client';

import * as React from 'react';
import { Search, RotateCcw, Sparkles } from 'lucide-react';

export type DiscoveryFilter = {
  industry: string;
  region: string;
  techField: string;
  scale: string;
};

type EnterpriseDiscoveryBarProps = {
  onDiscover: (filter: DiscoveryFilter) => void;
  onReset: () => void;
  loading?: boolean;
};

const REGION_OPTIONS = [
  { value: '', label: '全部区域' },
  { value: '北京', label: '北京' },
  { value: '上海', label: '上海' },
  { value: '深圳', label: '深圳' },
  { value: '杭州', label: '杭州' },
  { value: '广州', label: '广州' },
  { value: '成都', label: '成都' },
  { value: '武汉', label: '武汉' },
  { value: '南京', label: '南京' },
];

const INDUSTRY_OPTIONS = [
  { value: '', label: '全部行业' },
  { value: '人工智能', label: '人工智能' },
  { value: '半导体', label: '半导体' },
  { value: '新能源', label: '新能源' },
  { value: '生物医药', label: '生物医药' },
  { value: '高端制造', label: '高端制造' },
  { value: '金融科技', label: '金融科技' },
  { value: '云计算', label: '云计算' },
  { value: '物联网', label: '物联网' },
];

const TECH_FIELD_OPTIONS = [
  { value: '', label: '全部技术领域' },
  { value: '大模型', label: '大模型' },
  { value: '芯片设计', label: '芯片设计' },
  { value: '电池技术', label: '电池技术' },
  { value: '基因编辑', label: '基因编辑' },
  { value: '机器人', label: '机器人' },
  { value: '区块链', label: '区块链' },
];

const SCALE_OPTIONS = [
  { value: '', label: '全部规模' },
  { value: '大型', label: '大型' },
  { value: '中型', label: '中型' },
  { value: '小型', label: '小型' },
  { value: '微型', label: '微型' },
];

export function EnterpriseDiscoveryBar({ onDiscover, onReset, loading }: EnterpriseDiscoveryBarProps) {
  const [filter, setFilter] = React.useState<DiscoveryFilter>({
    industry: '',
    region: '',
    techField: '',
    scale: '',
  });

  const handleFieldChange = (field: keyof DiscoveryFilter, value: string) => {
    setFilter((prev) => ({ ...prev, [field]: value }));
  };

  const handleDiscover = () => {
    onDiscover(filter);
  };

  const handleReset = () => {
    setFilter({ industry: '', region: '', techField: '', scale: '' });
    onReset();
  };

  return (
    <div className="bz-card bz-shadow-soft" style={{ borderRadius: 6 }}>
      <div className="bz-card-head">
        <span className="bz-card-title">
          <Sparkles className="h-4 w-4" style={{ color: 'var(--bz-brand)' }} />
          企业发现引擎
        </span>
        <button className="bz-btn bz-btn-ghost text-[12px]" onClick={handleReset}>
          <RotateCcw className="h-3.5 w-3.5" />
          重置
        </button>
      </div>
      <div className="p-4">
        <div className="grid grid-cols-4 gap-3">
          <div>
            <label className="bz-label">行业</label>
            <select
              className="bz-select"
              value={filter.industry}
              onChange={(e) => handleFieldChange('industry', e.target.value)}
            >
              {INDUSTRY_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="bz-label">区域</label>
            <select
              className="bz-select"
              value={filter.region}
              onChange={(e) => handleFieldChange('region', e.target.value)}
            >
              {REGION_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="bz-label">技术领域</label>
            <select
              className="bz-select"
              value={filter.techField}
              onChange={(e) => handleFieldChange('techField', e.target.value)}
            >
              {TECH_FIELD_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="bz-label">企业规模</label>
            <select
              className="bz-select"
              value={filter.scale}
              onChange={(e) => handleFieldChange('scale', e.target.value)}
            >
              {SCALE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="mt-3 flex justify-end">
          <button
            className="bz-btn bz-btn-primary"
            onClick={handleDiscover}
            disabled={loading}
          >
            {loading ? (
              <span className="animate-pulse">发现中…</span>
            ) : (
              <>
                <Search className="h-3.5 w-3.5" />
                发现企业
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}