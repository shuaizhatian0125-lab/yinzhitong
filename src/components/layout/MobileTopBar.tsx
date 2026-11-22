'use client';

import * as React from 'react';
import { Menu } from 'lucide-react';
import { MobileHamburgerMenu } from './MobileHamburgerMenu';

export function MobileTopBar() {
  const [menuOpen, setMenuOpen] = React.useState(false);

  return (
    <>
      <header
        className="flex h-14 shrink-0 items-center justify-between px-4 border-b"
        style={{ background: 'var(--bz-surface)', borderColor: 'var(--bz-line)' }}
      >
        <div className="flex items-center gap-2">
          <div
            className="flex h-8 w-8 items-center justify-center rounded-[4px] text-white text-sm font-bold"
            style={{ background: 'var(--bz-brand)' }}
          >
            银
          </div>
          <span className="text-[15px] font-semibold text-[var(--bz-text)]">银智通</span>
        </div>

        <button
          onClick={() => setMenuOpen(true)}
          className="flex h-9 w-9 items-center justify-center rounded-[4px] text-[var(--bz-text-sub)] hover:bg-[var(--bz-brand-tint)] hover:text-[var(--bz-brand)] transition-all"
          aria-label="打开菜单"
        >
          <Menu className="h-[20px] w-[20px]" />
        </button>
      </header>

      <MobileHamburgerMenu open={menuOpen} onClose={() => setMenuOpen(false)} />
    </>
  );
}