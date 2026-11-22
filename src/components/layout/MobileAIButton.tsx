'use client';

import Link from 'next/link';

export function MobileAIButton() {
  return (
    <Link
      href="/workbench"
      className="absolute left-1/2 -translate-x-1/2 -top-[28px] flex h-[56px] w-[56px] items-center justify-center rounded-full shadow-lg transition-transform active:scale-95"
      style={{ background: 'var(--bz-brand)' }}
      aria-label="AI 工作台"
    >
      <svg
        className="h-[24px] w-[24px] text-white"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M12 2L2 7l10 5 10-5-10-5z" />
        <path d="M2 17l10 5 10-5" />
        <path d="M2 12l10 5 10-5" />
      </svg>
    </Link>
  );
}