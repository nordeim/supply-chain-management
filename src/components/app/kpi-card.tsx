import Link from 'next/link';
import { cn } from '@/lib/utils';

/**
 * KPI card — the dashboard's stat tiles. Three visual variants cloned from
 * the reference: black (Total SKUs), white (alerts/pending), orange
 * (inventory value). Each card links to the page that explains its number.
 */
export function KpiCard({
  href,
  variant,
  label,
  value,
  subtext,
  icon,
  children,
}: {
  href: string;
  variant: 'black' | 'white' | 'orange';
  label: string;
  value: string;
  subtext: string;
  icon?: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      aria-label={`${label}: ${value}`}
      className={cn(
        'block rounded-2xl p-5 transition-transform hover:-translate-y-0.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary',
        variant === 'black' && 'bg-black text-white',
        variant === 'white' && 'bg-white text-foreground shadow-[0_1px_2px_rgba(0,0,0,0.05)]',
        variant === 'orange' && 'bg-primary text-primary-foreground',
      )}
    >
      <div className="flex items-center gap-2">
        {icon}
        <p className={cn('text-sm font-medium', variant === 'white' ? 'text-muted-foreground' : 'opacity-90')}>
          {label}
        </p>
      </div>
      <p
        className={cn(
          'mt-2 text-4xl font-extrabold tracking-tight',
          variant === 'black' && 'text-primary',
          variant === 'orange' && 'text-primary-foreground',
        )}
      >
        {value}
      </p>
      <p className={cn('mt-1 text-sm', variant === 'white' ? 'text-muted-foreground' : 'opacity-80')}>{subtext}</p>
      {children}
    </Link>
  );
}
