import * as React from 'react';
import { requireUser } from '@/lib/auth';
import { ResponsiveLayout } from '@/components/layout/ResponsiveLayout';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  await requireUser();
  return <ResponsiveLayout>{children}</ResponsiveLayout>;
}