'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, CheckSquare, Users, User } from 'lucide-react';
import { cn } from '@/lib/utils';
import { MobileAIButton } from './MobileAIButton';

const TABS = [
  { href: '/workbench', label: '首页', icon: Home },
  { href: '/task', label: '任务', icon: CheckSquare },
  { href: '/collab', label: '协作', icon: Users },
  { href: '/cockpit', label: '我的', icon: User },
];

export function MobileBottomTabBar() {
  const pathname = usePathname();

  return (
    <nav
      className="relative flex h-[56px] shrink-0 items-center justify-around border-t px-2"
      style={{ background: 'var(--bz-surface)', borderColor: 'var(--bz-line)' }}
    >
      {TABS.slice(0, 2).map((tab) => {
        const isActive = pathname === tab.href || pathname.startsWith(tab.href + '/');
        const Icon = tab.icon;
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={cn(
              'flex flex-col items-center justify-center min-h-[44px] min-w-[44px] gap-0.5 rounded-[4px] transition-colors',
              isActive ? 'text-[var(--bz-brand)]' : 'text-[var(--bz-text-sub)]'
            )}
          >
            <Icon className="h-[20px] w-[20px]" />
            <span className="text-[11px] font-medium">{tab.label}</span>
          </Link>
        );
      })}

      <div className="relative flex items-center justify-center w-[56px]">
        <MobileAIButton />
      </div>

      {TABS.slice(2).map((tab) => {
        const isActive = pathname === tab.href || pathname.startsWith(tab.href + '/');
        const Icon = tab.icon;
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={cn(
              'flex flex-col items-center justify-center min-h-[44px] min-w-[44px] gap-0.5 rounded-[4px] transition-colors',
              isActive ? 'text-[var(--bz-brand)]' : 'text-[var(--bz-text-sub)]'
            )}
          >
            <Icon className="h-[20px] w-[20px]" />
            <span className="text-[11px] font-medium">{tab.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}