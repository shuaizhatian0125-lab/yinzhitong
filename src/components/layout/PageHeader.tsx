import * as React from 'react';

export type PageHeaderProps = {
  title: string;
  description?: string;
  actions?: React.ReactNode;
};

export function PageHeader({ title, description, actions }: PageHeaderProps) {
  return (
    <div className="mb-5 flex items-start justify-between gap-4 pb-3 border-b border-[var(--bz-line)]">
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center gap-2">
          <span className="inline-block w-[3px] h-[22px] rounded-[1px]" style={{ background: 'var(--bz-brand)' }} />
          <h1 className="text-[22px] font-semibold text-[var(--bz-text)] leading-tight">{title}</h1>
        </div>
        {description && (
          <p className="text-[14px] text-[var(--bz-text-sub)] leading-relaxed">{description}</p>
        )}
      </div>
      {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
    </div>
  );
}