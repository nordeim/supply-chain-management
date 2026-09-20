'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { BarChart3, Boxes, LayoutGrid, ShoppingCart, Users } from 'lucide-react';
import { cn } from '@/lib/utils';

const NAV_ITEMS = [
  { href: '/', label: 'Dashboard', icon: LayoutGrid },
  { href: '/products', label: 'Products', icon: Boxes },
  { href: '/ai-suggestions', label: 'AI Suggestions', icon: SparkleGlyph },
  { href: '/purchase-orders', label: 'Procurement', icon: ShoppingCart },
  { href: '/suppliers', label: 'Suppliers', icon: Users },
  { href: '/market-trends', label: 'Market Trends', icon: BarChart3 },
] as const;

/** AI Suggestions glyph — the reference's four-point sparkle. */
function SparkleGlyph(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden {...props}>
      <path d="M12 2.6c.35 2.9 1.28 5.06 2.8 6.5 1.52 1.44 3.68 2.34 6.47 2.7v1.4c-2.8.36-4.95 1.26-6.47 2.7-1.52 1.44-2.45 3.6-2.8 6.5-.35-2.9-1.28-5.06-2.8-6.5-1.52-1.44-3.68-2.34-6.47-2.7v-1.4c2.8-.36 4.95-1.26 6.47-2.7 1.52-1.44 2.45-3.6 2.8-6.5Z" />
      <path d="M19.5 3.2c.17 1.16.55 2 1.13 2.55.58.55 1.42.9 2.53 1.06v.6c-1.1.15-1.94.5-2.53 1.06-.57.55-.95 1.4-1.13 2.55-.17-1.16-.55-2-1.13-2.55-.58-.56-1.42-.91-2.53-1.06v-.6c1.1-.16 1.95-.51 2.53-1.06.58-.55.96-1.4 1.13-2.55Z" opacity="0.0" />
    </svg>
  );
}

/**
 * Left nav rail — pill items. Active = white 40px pill inside a 60px row;
 * inactive = #DFDFDF pill (reference geometry: 224px rail, radius 32).
 */
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
              'flex h-[60px] items-center gap-3 rounded-[32px] px-4 text-[15px] transition-colors',
              active
                ? 'bg-white font-semibold text-foreground shadow-[0_1px_2px_rgba(0,0,0,0.06)]'
                : 'bg-secondary font-medium text-secondary-foreground hover:bg-secondary/80',
            )}
          >
            <Icon
              className={cn('h-5 w-5 shrink-0', active ? 'text-foreground' : 'text-[#343434]')}
              aria-hidden
            />
            <span className="truncate">{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
