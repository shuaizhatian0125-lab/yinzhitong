'use client';

import * as React from 'react';
import { TrendingUp, FileText, BarChart3 } from 'lucide-react';

export type IndustryCardData = {
  id: string;
  name: string;
  code: string | null;
  level: number;
  description: string | null;
  enterpriseCount?: number;
};

type IndustryCardProps = {
  industry: IndustryCardData;
  onClick?: (id: string) => void;
};

const LEVEL_LABEL: Record<number, string> = {
  1: '一级行业',
  2: '二级行业',
  3: '三级行业',
};

export function IndustryCard({ industry, onClick }: IndustryCardProps) {
  return (
    <div
      className="bz-card bz-shadow-soft bz-hover-lift cursor-pointer"
      style={{ borderRadius: 6 }}
      onClick={() => onClick?.(industry.id)}
    >
      <div className="p-4">
        <div className="flex items-start justify-between mb-2">
          <div className="flex items-center gap-2">
            <div
              className="flex h-8 w-8 items-center justify-center rounded"
              style={{ background: 'var(--bz-brand-tint)' }}
            >
              <BarChart3 className="h-4 w-4" style={{ color: 'var(--bz-brand)' }} />
            </div>
            <div>
              <span className="text-[14px] font-medium text-[var(--bz-text)]">{industry.name}</span>
              <span className="text-[11px] text-[var(--bz-text-muted)] ml-2">
                {LEVEL_LABEL[industry.level] ?? `L${industry.level}`}
              </span>
            </div>
          </div>
          {industry.enterpriseCount !== undefined && industry.enterpriseCount > 0 && (
            <span className="bz-badge bz-badge-blue">
              {industry.enterpriseCount} 家企业
            </span>
          )}
        </div>
        <p className="text-[12px] text-[var(--bz-text-sub)] leading-relaxed line-clamp-2">
          {industry.description ?? '待补充'}
        </p>
        <div className="mt-3 flex items-center gap-3">
          <span className="flex items-center gap-1 text-[11px] text-[var(--bz-text-muted)]">
            <TrendingUp className="h-3 w-3" />
            行业趋势
          </span>
          <span className="flex items-center gap-1 text-[11px] text-[var(--bz-text-muted)]">
            <FileText className="h-3 w-3" />
            政策跟踪
          </span>
        </div>
      </div>
    </div>
  );
}