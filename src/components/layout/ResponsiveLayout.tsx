'use client';

import * as React from 'react';
import { useBreakpoint } from '@/hooks/use-breakpoint';
import { AppShell } from './AppShell';
import { MobileAppShell } from './MobileAppShell';

export function ResponsiveLayout({ children }: { children: React.ReactNode }) {
  const breakpoint = useBreakpoint();

  if (breakpoint === 'mobile') {
    return <MobileAppShell>{children}</MobileAppShell>;
  }

  return <AppShell>{children}</AppShell>;
}