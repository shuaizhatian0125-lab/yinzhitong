'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Bell } from 'lucide-react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { CommandInput } from '@/components/domain/CommandInput';

export function Topbar() {
  const router = useRouter();
  const [unreadCount] = React.useState(3);

  const handleLogout = React.useCallback(() => {
    // 令牌落在 localStorage，退出必须清掉，否则下一个使用者拿的是上一个的身份。
    window.localStorage.removeItem('access_token');
    void fetch('/api/v1/auth/logout', { method: 'POST' }).finally(() => router.push('/login'));
  }, [router]);

  return (
    <header
      className="flex h-14 shrink-0 items-center gap-4 px-6 border-b"
      style={{
        background: 'var(--bz-surface)',
        borderColor: 'var(--bz-line)',
      }}
    >
      {/* 左侧：Logo + 系统名称 */}
      <div className="flex items-center gap-2 shrink-0">
        <div
          className="flex h-8 w-8 items-center justify-center rounded-[4px] text-white text-sm font-bold"
          style={{ background: 'var(--bz-brand)' }}
        >
          银
        </div>
        <span className="text-[15px] font-semibold text-[var(--bz-text)]">银智通</span>
      </div>

      {/* 中部：AI 指令输入框 */}
      <div className="flex-1 max-w-[600px] mx-auto">
        <CommandInput />
      </div>

      {/* 右侧：通知 + 用户 */}
      <div className="flex items-center gap-3 shrink-0">
        {/* 通知图标 */}
        <button className="relative flex h-9 w-9 items-center justify-center rounded-[4px] text-[var(--bz-text-sub)] hover:bg-[var(--bz-brand-tint)] hover:text-[var(--bz-brand)] hover:shadow-sm transition-all">
          <Bell className="h-[18px] w-[18px]" />
          {unreadCount > 0 && (
            <span
              className="absolute top-1 right-1 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-medium text-white"
              style={{ background: 'var(--bz-danger)' }}
            >
              {unreadCount}
            </span>
          )}
        </button>

        {/* 用户头像下拉 */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex items-center gap-2 rounded outline-none">
              <Avatar className="h-8 w-8">
                <AvatarFallback
                  className="text-xs font-medium"
                  style={{ background: 'var(--bz-brand-tint)', color: 'var(--bz-brand)' }}
                >
                  用户
                </AvatarFallback>
              </Avatar>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuLabel>我的账户</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem>个人设置</DropdownMenuItem>
            <DropdownMenuItem>切换角色</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="text-[var(--bz-danger)]" onSelect={handleLogout}>
              退出登录
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}