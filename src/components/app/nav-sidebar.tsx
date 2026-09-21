'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { isNavItemActive, NAV_ITEMS } from './nav-items';

/**
 * Left nav rail — reference geometry (computed-style audit, Session 9):
 * a 224px rail with 16px left padding and 4px gaps; the ACTIVE section is
 * a 60px-tall row of two white pieces (a 60x60 rounded-[32px] icon square
 * plus a growing white label pill), and INACTIVE sections are 40px
 * #DFDFDF pills (radius 32, 16px padding, 10px icon, 14px/400 label).
 *
 * The rail renders at `lg` and up; below that the MobileNav bottom pill
 * takes over (see mobile-nav.tsx).
 */
export function NavSidebar() {
  const pathname = usePathname();

  return (
    <nav aria-label="Main navigation" className="hidden lg:flex w-[224px] shrink-0 flex-col gap-1 pl-4">
      {NAV_ITEMS.map((item) => {
        const active = isNavItemActive(pathname, item.href);
        const Icon = item.icon;
        return active ? (
          <Link
            key={item.href}
            href={item.href}
            aria-current="page"
            className="flex h-[60px] w-full items-center gap-1"
          >
            <span className="flex h-[60px] w-[60px] shrink-0 items-center justify-center rounded-[32px] bg-white shadow-sm">
              <Icon className="h-2.5 w-2.5 shrink-0" aria-hidden />
            </span>
            <span className="flex h-[60px] grow items-center rounded-[32px] bg-white px-4 shadow-sm">
              <span className="text-sm font-medium font-brand leading-[18px] text-[#111111]">{item.label}</span>
            </span>
          </Link>
        ) : (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              'flex h-10 w-full items-center gap-3 rounded-[32px] bg-secondary px-4',
              'transition-colors hover:bg-secondary/80',
            )}
          >
            <Icon className="h-2.5 w-2.5 shrink-0" aria-hidden />
            <span className="grow text-sm font-normal font-brand leading-[18px] text-[#111111]">{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
