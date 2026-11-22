'use client';

import * as React from 'react';
import { MobileTopBar } from './MobileTopBar';
import { MobileBottomTabBar } from './MobileBottomTabBar';

export function MobileAppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col h-screen w-full overflow-hidden bg-[var(--bz-bg)]">
      <MobileTopBar />
      <main className="flex-1 overflow-auto">
        <div className="px-4 py-3">{children}</div>
      </main>
      <MobileBottomTabBar />
    </div>
  );
}