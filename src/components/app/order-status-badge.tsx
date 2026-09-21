import { cn } from '@/lib/utils';

/**
 * Status pill used across purchase-order surfaces. Reference style (computed
 * on the live app): SOLID pills — 28px tall, 40px radius, 12px horizontal
 * padding, Inter 14px/500, capitalized label, #111 text. Suggested renders the
 * brand orange, Approved a light blue, Cancelled gray-on-gray. Delivered has
 * no live specimen (the demo set has none); it follows the same solid family
 * with the success green.
 */
export function OrderStatusBadge({ status, className }: { status: string; className?: string }) {
  const styles: Record<string, string> = {
    Suggested: 'bg-primary text-[#111111]',
    Approved: 'bg-[#3CB5E1] text-[#111111]',
    Delivered: 'bg-[#64E03C] text-[#111111]',
    Cancelled: 'bg-[#EFEFEF] text-[#898989]',
  };
  return (
    <span
      className={cn(
        'inline-flex h-7 items-center rounded-[40px] px-3 font-brand text-sm font-medium capitalize',
        styles[status] ?? 'bg-[#EFEFEF] text-[#898989]',
        className,
      )}
    >
      {status}
    </span>
  );
}
