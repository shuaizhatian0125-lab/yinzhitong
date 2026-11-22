'use client';

import * as React from 'react';
import Link from 'next/link';
import { ChevronDown, X } from 'lucide-react';
import { CENTERS } from '@/lib/permissions';
import { cn } from '@/lib/utils';

type Props = {
  open: boolean;
  onClose: () => void;
};

const GROUP_ORDER = ['核心', '生产', '经营', '管控'] as const;

const GROUP_ICON: Record<string, string> = {
  核心: '◆',
  生产: '▣',
  经营: '◈',
  管控: '◇',
};

export function MobileHamburgerMenu({ open, onClose }: Props) {
  const [expandedGroups, setExpandedGroups] = React.useState<Set<string>>(new Set(['核心']));

  const toggleGroup = (group: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(group)) next.delete(group);
      else next.add(group);
      return next;
    });
  };

  const groupedCenters = React.useMemo(() => {
    const map = new Map<string, typeof CENTERS>();
    for (const group of GROUP_ORDER) {
      map.set(group, CENTERS.filter((c) => c.group === group));
    }
    return map;
  }, []);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div
        className="relative flex flex-col w-[280px] h-full overflow-y-auto shadow-xl"
        style={{ background: 'var(--bz-surface)' }}
      >
        <div
          className="flex h-14 items-center justify-between px-4 border-b shrink-0"
          style={{ borderColor: 'var(--bz-line)' }}
        >
          <span className="text-[15px] font-semibold text-[var(--bz-text)]">导航菜单</span>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-[4px] text-[var(--bz-text-sub)] hover:bg-[var(--bz-brand-tint)] transition-all"
            aria-label="关闭菜单"
          >
            <X className="h-[18px] w-[18px]" />
          </button>
        </div>

        <nav className="flex-1 py-2">
          {GROUP_ORDER.map((group) => {
            const centers = groupedCenters.get(group) ?? [];
            const isExpanded = expandedGroups.has(group);

            return (
              <div key={group} className="mb-1">
                <button
                  onClick={() => toggleGroup(group)}
                  className="flex w-full items-center px-4 py-2.5 text-[14px] font-medium text-[var(--bz-text)] hover:bg-[var(--bz-brand-tint)] transition-colors"
                >
                  <span className="mr-2 text-[10px]" style={{ color: 'var(--bz-brand)' }}>
                    {GROUP_ICON[group]}
                  </span>
                  <span>{group}</span>
                  <span className="ml-auto">
                    <ChevronDown
                      className={cn('h-4 w-4 transition-transform', isExpanded && 'rotate-180')}
                      style={{ color: 'var(--bz-text-sub)' }}
                    />
                  </span>
                </button>

                {isExpanded && (
                  <div className="mt-0.5">
                    {centers.map((center) => (
                      <Link
                        key={center.code}
                        href={center.href}
                        onClick={onClose}
                        className="flex items-center px-4 py-2.5 pl-8 text-[14px] text-[var(--bz-text-sub)] hover:bg-[var(--bz-brand-tint)] hover:text-[var(--bz-brand)] transition-all"
                      >
                        <span className="truncate">{center.short}</span>
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            );
          })}

          <div
            className="mt-2 pt-2 border-t"
            style={{ borderColor: 'var(--bz-line)' }}
          >
            <Link
              href="/login"
              onClick={onClose}
              className="flex items-center px-4 py-2.5 text-[14px] text-[var(--bz-brand)] font-medium hover:bg-[var(--bz-brand-tint)] transition-all"
            >
              登录 / 注册
            </Link>
          </div>
        </nav>
      </div>
    </div>
  );
}