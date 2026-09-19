import { cn } from '@/lib/utils';

/** Status pill used across purchase-order surfaces. */
export function OrderStatusBadge({ status, className }: { status: string; className?: string }) {
  const styles: Record<string, string> = {
    Suggested: 'bg-primary/10 text-primary border-primary/20',
    Approved: 'bg-success/10 text-[#15803d] border-success/30',
    Delivered: 'bg-black/5 text-[#374151] border-black/10',
    Cancelled: 'bg-destructive/10 text-destructive border-destructive/20',
  };
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold',
        styles[status] ?? 'bg-black/5 text-[#374151] border-black/10',
        className,
      )}
    >
      {status}
    </span>
  );
}
