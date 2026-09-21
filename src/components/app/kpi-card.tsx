import Link from 'next/link';
import { cn } from '@/lib/utils';

/**
 * KPI card — the dashboard's stat tiles, cloned from the reference geometry:
 * 32px radius, 16px circular dot indicator beside a 14px/500 label, a
 * 32–48px font-light value, and a 14px subtext. Variants: black (Total SKUs),
 * white (alerts/pending), orange (inventory value). The reference's tall
 * cards (Low Stock, Pending POS) pass `className="min-h-[400px]"` with a
 * gauge filling the lower half.
 */
export function KpiCard({
  href,
  variant,
  label,
  value,
  subtext,
  dotClassName,
  className,
  children,
}: {
  href?: string;
  variant: 'black' | 'white' | 'orange';
  label: string;
  value: string;
  subtext?: string;
  /** Dot indicator color class; defaults per variant (white on colored cards). */
  dotClassName?: string;
  className?: string;
  children?: React.ReactNode;
}) {
  const body = (
    <>
      <div className="flex items-center gap-2.5">
        <span
          aria-hidden
          className={cn(
            'h-4 w-4 shrink-0 rounded-full',
            dotClassName ??
              (variant === 'white' ? 'bg-primary' : variant === 'black' ? 'bg-white' : 'bg-white'),
          )}
        />
        <p
          className={cn(
            'text-sm font-medium',
            variant === 'white' ? 'text-[#111111]' : 'text-white',
          )}
        >
          {label}
        </p>
      </div>
      <div className={cn('mt-5 flex flex-col', children ? 'gap-4' : 'gap-1')}>
        <p
          className={cn(
            'text-[32px] leading-none font-light text-[32px] sm:text-[48px] sm:leading-none',
            variant === 'white'
              ? 'text-[#111111]'
              : variant === 'black'
                ? 'text-primary'
                : 'text-white',
          )}
        >
          {value}
        </p>
        {subtext && (
          <p className={cn('text-sm', variant === 'white' ? 'text-[#343434]' : 'text-white/80')}>{subtext}</p>
        )}
      </div>
      {children}
    </>
  );

  const cardClass = cn(
    'block rounded-[32px] p-6 transition-transform hover:-translate-y-0.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary',
    variant === 'black' && 'bg-[#111111]',
    variant === 'white' && 'bg-white text-foreground shadow-[0_1px_2px_rgba(0,0,0,0.05)]',
    variant === 'orange' && 'bg-primary text-primary-foreground',
    className,
  );

  if (href) {
    return (
      <Link href={href} aria-label={`${label}: ${value}`} className={cardClass}>
        {body}
      </Link>
    );
  }
  return (
    <div className={cardClass} role="group" aria-label={`${label}: ${value}`}>
      {body}
    </div>
  );
}
