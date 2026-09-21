'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { isNavItemActive, NAV_ITEMS } from './nav-items';

/**
 * MobileNav — the reference app's floating bottom navigation, extracted
 * from the live app (Session 9 parity audit):
 *
 * - Wrapper: `fixed bottom-0 left-0 right-0 z-50 flex justify-center pb-4`,
 *   pointer-events pass through except on the pill itself, visible only
 *   below `lg` (the desktop rail takes over at lg).
 * - Pill container: 42px tall, 100px radius, frosted glass —
 *   rgba(255,255,255,0.1) over a 20px backdrop blur, 4px horizontal
 *   padding, 4px gap, overflow visible.
 * - Active section: white 48px pill (100px radius, 16px padding) with a
 *   14px icon, 10px gap, and a 14px/500 Inter label in #111111 — it
 *   renders in place (fixed item order), slightly taller than the
 *   container so it "arches" over it, exactly like the reference.
 * - Inactive sections: 34px circles on #DFDFDF with a 14px icon.
 */
export function MobileNav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Mobile navigation"
      className="pointer-events-none fixed inset-x-0 bottom-0 z-50 flex justify-center pb-4 lg:hidden"
    >
      <div className="pointer-events-auto flex h-[42px] items-center gap-1 overflow-visible rounded-[100px] bg-white/10 px-1 backdrop-blur-[20px]">
        {NAV_ITEMS.map((item) => {
          const active = isNavItemActive(pathname, item.href);
          const Icon = item.icon;
          return active ? (
            <Link
              key={item.href}
              href={item.href}
              aria-current="page"
              className="relative z-[1] inline-flex h-12 shrink-0 items-center gap-2.5 rounded-[100px] bg-white px-4 text-sm font-medium text-[#111111] transition-colors"
            >
              <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden />
              <span className="whitespace-nowrap font-brand">{item.label}</span>
            </Link>
          ) : (
            <Link
              key={item.href}
              href={item.href}
              aria-label={item.label}
              className={cn(
                'inline-flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-full',
                'bg-[#DFDFDF] text-[#343434] transition-colors hover:bg-[#d0d0d0]',
              )}
            >
              <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden />
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
