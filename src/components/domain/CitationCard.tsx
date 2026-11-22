'use client';

import * as React from 'react';
import { FileText, Quote } from 'lucide-react';

type CitationCardProps = {
  docName: string;
  pageNo?: number | null;
  snippet: string;
  sourceType?: string;
  url?: string | null;
  className?: string;
};

const SOURCE_LABEL: Record<string, string> = {
  knowledge: '知识库',
  document: '文档',
  upload: '上传文件',
  external: '外部来源',
};

export function CitationCard({
  docName,
  pageNo,
  snippet,
  sourceType = 'knowledge',
  url,
  className,
}: CitationCardProps) {
  return (
    <div
      className={`bz-shadow-soft ${className ?? ''}`}
      style={{
        borderRadius: 6,
        border: '1px solid var(--bz-line)',
        background: 'var(--bz-bg)',
        padding: '10px 12px',
      }}
    >
      <div className="flex items-center gap-2 mb-1.5">
        <FileText className="h-3.5 w-3.5" style={{ color: 'var(--bz-brand)' }} />
        <span className="text-[12px] font-medium text-[var(--bz-text)] truncate">{docName}</span>
        {pageNo != null && (
          <span className="text-[11px] text-[var(--bz-text-muted)] shrink-0">第 {pageNo} 页</span>
        )}
        <span
          className="text-[10px] px-1 py-0.5 rounded shrink-0"
          style={{ background: 'var(--bz-brand-tint)', color: 'var(--bz-brand)' }}
        >
          {SOURCE_LABEL[sourceType] ?? sourceType}
        </span>
      </div>

      <div className="flex items-start gap-1.5">
        <Quote className="h-3 w-3 mt-0.5 shrink-0" style={{ color: 'var(--bz-text-muted)' }} />
        <p className="text-[12px] text-[var(--bz-text-sub)] leading-relaxed line-clamp-3">
          {snippet}
        </p>
      </div>

      {url && (
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-[11px] text-[var(--bz-brand)] hover:underline mt-1 inline-block"
        >
          查看原文 →
        </a>
      )}
    </div>
  );
}