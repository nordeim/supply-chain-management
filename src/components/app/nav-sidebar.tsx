'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutGrid, Package, Sparkles, ShoppingCart, TrendingUp, Users } from 'lucide-react';
import { cn } from '@/lib/utils';

const NAV_ITEMS = [
  { href: '/', label: 'Dashboard', icon: LayoutGrid },
  { href: '/products', label: 'Products', icon: Package },
  { href: '/ai-suggestions', label: 'AI Suggestions', icon: Sparkles },
  { href: '/purchase-orders', label: 'Procurement', icon: ShoppingCart },
  { href: '/suppliers', label: 'Suppliers', icon: Users },
  { href: '/market-trends', label: 'Market Trends', icon: TrendingUp },
] as const;

/** Left nav rail — pill items, active state derived from the pathname. */
export function NavSidebar() {
  const pathname = usePathname();

  function isActive(href: string): boolean {
    if (href === '/') return pathname === '/';
    return pathname === href || pathname.startsWith(`${href}/`);
  }

  return (
    <nav aria-label="Main navigation" className="hidden md:flex w-[224px] shrink-0 flex-col gap-2">
      {NAV_ITEMS.map((item) => {
        const active = isActive(item.href);
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? 'page' : undefined}
            className={cn(
              'flex h-[60px] items-center gap-3 rounded-2xl px-4 text-[15px] transition-colors',
              active
                ? 'bg-white font-semibold text-foreground shadow-[0_1px_2px_rgba(0,0,0,0.06)]'
                : 'bg-[#e5e7eb] font-medium text-[#1f2937] hover:bg-[#dcdfe3]',
            )}
          >
            <Icon
              className={cn('h-5 w-5 shrink-0', active ? 'text-foreground' : 'text-[#4b5563]')}
              aria-hidden
            />
            <span className="truncate">{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
