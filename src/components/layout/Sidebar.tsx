'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { CENTERS, type CenterDef } from '@/lib/permissions';
import { cn } from '@/lib/utils';

type SidebarProps = {
  collapsed: boolean;
  onToggleCollapse: () => void;
};

const GROUP_ORDER = ['核心', '生产', '经营', '管控'] as const;

const GROUP_ICON: Record<string, string> = {
  核心: '◆',
  生产: '▣',
  经营: '◈',
  管控: '◇',
};

export function Sidebar({ collapsed, onToggleCollapse }: SidebarProps) {
  const pathname = usePathname();
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
    const map = new Map<string, CenterDef[]>();
    for (const group of GROUP_ORDER) {
      map.set(group, CENTERS.filter((c) => c.group === group));
    }
    return map;
  }, []);

  return (
    <aside
      className={cn(
        'flex flex-col shrink-0 transition-all duration-200',
        collapsed ? 'w-[56px]' : 'w-[240px]'
      )}
      style={{ background: 'var(--bz-brand-deep)' }}
    >
      {/* Logo 区域 */}
      <div className="flex h-14 items-center px-4 border-b border-white/10">
        {!collapsed && (
          <span className="text-white font-semibold text-[15px] tracking-wide">银智通</span>
        )}
        {collapsed && <span className="text-white font-semibold text-[15px] mx-auto">银</span>}
      </div>

      {/* 导航区域 */}
      <nav className="flex-1 overflow-y-auto py-2">
        {GROUP_ORDER.map((group) => {
          const centers = groupedCenters.get(group) ?? [];
          const isExpanded = expandedGroups.has(group) && !collapsed;

          return (
            <div key={group} className="mb-1">
              {/* 分组标题 */}
              <button
                onClick={() => !collapsed && toggleGroup(group)}
                className={cn(
                  'flex w-full items-center px-4 py-2 text-[13px] font-medium text-white/60 hover:text-white/90 transition-colors',
                  collapsed && 'justify-center px-0'
                )}
              >
                {!collapsed && (
                  <>
                    <span className="mr-2 text-[10px]">{GROUP_ICON[group]}</span>
                    <span>{group}</span>
                    <span className="ml-auto">
                      {isExpanded ? (
                        <ChevronRight className="h-3 w-3 rotate-90" />
                      ) : (
                        <ChevronRight className="h-3 w-3" />
                      )}
                    </span>
                  </>
                )}
                {collapsed && <span className="text-[10px]">{GROUP_ICON[group]}</span>}
              </button>

              {/* 二级菜单 */}
              {isExpanded && (
                <div className="mt-0.5">
                  {centers.map((center) => {
                    const href = center.href;
                    const isActive = pathname === href || pathname.startsWith(href + '/');

                    return (
                      <Link
                        key={center.code}
                        href={href}
                        className={cn(
                          'flex items-center px-4 py-2 text-[14px] transition-all duration-200',
                          isActive
                            ? 'bg-white/12 text-white font-medium'
                            : 'text-white/70 hover:bg-white/8 hover:text-white'
                        )}
                        style={{
                          borderLeft: isActive ? '2px solid var(--bz-gold)' : '2px solid transparent',
                        }}
                      >
                        <span className="truncate">{center.short}</span>
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </nav>

      {/* 折叠按钮 */}
      <button
        onClick={onToggleCollapse}
        className="flex h-10 items-center justify-center border-t border-white/10 text-white/50 hover:text-white/80 transition-colors"
      >
        {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
      </button>
    </aside>
  );
}