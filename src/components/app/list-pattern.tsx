import Link from 'next/link';

/**
 * List pattern — the reference app's shared list primitives (live computed-style
 * audit): every tabular page renders ONE white 32px-radius card whose header row
 * (title + count) sits inside the card, followed by a black #111111 header bar
 * (37px, 22px radius, white Inter 14px/400 labels) and rows as #EFEFEF gray
 * pills (22px radius, 16px gaps). Product cells lead with a 40x40 image
 * (8px radius); numeric cells render in Hanken Grotesk 300 via `font-numeric`.
 *
 * Responsive behavior cloned from the reference: below `sm` the AI-suggestions
 * and procurement rows swap to stacked mobile cards (grid sm:hidden); the
 * products rows keep the flex layout and hide columns per breakpoint instead.
 */

/** White list card with the reference's inside-the-card title row. */
export function ListCard({
  title,
  count,
  children,
  ariaLabel,
}: {
  title: string;
  count: string;
  children: React.ReactNode;
  ariaLabel?: string;
}) {
  return (
    <section
      aria-label={ariaLabel ?? title}
      className="rounded-[32px] bg-white p-4 shadow-[0_1px_2px_rgba(0,0,0,0.05)]"
    >
      <div className="grid grid-cols-2 gap-4 pb-4">
        <h1 className="font-brand text-sm font-medium text-[#111111]">{title}</h1>
        <p className="font-brand text-sm font-normal text-[#111111]">{count}</p>
      </div>
      {children}
    </section>
  );
}

/** The black column header bar (hidden below `sm` like the reference). */
export function ListHeaderBar({ children }: { children: React.ReactNode }) {
  return (
    <div className="hidden h-[37px] items-center gap-4 rounded-[22px] bg-[#111111] px-4 py-2 font-brand text-sm font-normal text-white sm:flex">
      {children}
    </div>
  );
}

/** A gray pill row (hidden below `sm`; mobile cards replace it there). */
export function ListRow({
  children,
  height = 'h-[56px]',
  onClick,
  clickable = false,
  ariaLabel,
}: {
  children: React.ReactNode;
  height?: string;
  onClick?: () => void;
  clickable?: boolean;
  ariaLabel?: string;
}) {
  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        aria-label={ariaLabel}
        className={`hidden w-full items-center gap-4 rounded-[22px] bg-[#EFEFEF] px-4 text-left transition-transform hover:-translate-y-[1px] sm:flex ${height}`}
      >
        {children}
      </button>
    );
  }
  return (
    <div
      aria-label={ariaLabel}
      className={`hidden w-full items-center gap-4 rounded-[22px] bg-[#EFEFEF] px-4 sm:flex ${height}`}
    >
      {children}
    </div>
  );
}

/** 40x40 product image tile (8px radius on the #DFDFDF placeholder). */
export function ProductThumb({ imageUrl, alt }: { imageUrl: string | null; alt: string }) {
  return (
    <div className="h-10 w-10 shrink-0 overflow-hidden rounded-lg bg-[#DFDFDF]">
      {imageUrl ? (
        <img src={imageUrl} alt={alt} className="h-full w-full object-cover" />
      ) : null}
    </div>
  );
}

/** First cell: image + name (Inter 14px/500) and optional SKU line below. */
export function ProductCell({
  name,
  sku,
  imageUrl,
  href,
  width = 'flex-[3] basis-0',
  ariaLabel,
}: {
  name: string;
  sku?: string;
  imageUrl: string | null;
  href?: string;
  width?: string;
  ariaLabel?: string;
}) {
  const body = (
    <>
      <ProductThumb imageUrl={imageUrl} alt={name} />
      <div className="flex min-w-0 flex-1 flex-col gap-1 overflow-hidden">
        <span className="truncate font-brand text-sm font-medium text-[#111111]">{name}</span>
        {sku ? <span className="truncate font-brand text-sm font-normal text-[#343434]">{sku}</span> : null}
      </div>
    </>
  );
  return (
    <div className={`flex min-w-0 items-center gap-2 ${width}`} aria-label={ariaLabel}>
      {href ? (
        <Link href={href} className="flex min-w-0 flex-1 items-center gap-2">
          {body}
        </Link>
      ) : (
        body
      )}
    </div>
  );
}

/** Inter 14px/400 text cell (supplier, category, SKU columns). */
export function TextCell({
  children,
  width = 'flex-[1.5] basis-0',
  className = '',
}: {
  children: React.ReactNode;
  width?: string;
  className?: string;
}) {
  return (
    <span
      className={`min-w-0 truncate font-brand text-sm font-normal text-[#111111] ${width} ${className}`}
    >
      {children}
    </span>
  );
}

/** Hanken Grotesk numeric cell (qty, cost, date columns). */
export function NumericCell({
  children,
  width = 'flex-1 basis-0',
  className = '',
}: {
  children: React.ReactNode;
  width?: string;
  className?: string;
}) {
  return (
    <span className={`min-w-0 truncate font-numeric text-sm font-light text-[#111111] ${width} ${className}`}>
      {children}
    </span>
  );
}

/** The stacked mobile card (grid sm:hidden) used by AI suggestions + procurement. */
export function MobileCard({ children, ariaLabel }: { children: React.ReactNode; ariaLabel?: string }) {
  return (
    <div
      aria-label={ariaLabel}
      className="grid grid-cols-2 gap-x-4 gap-y-6 rounded-[22px] bg-[#EFEFEF] p-4 sm:hidden"
    >
      {children}
    </div>
  );
}

/** Mobile card square product image (aspect 1/1, 12px radius). */
export function MobileProductImage({ imageUrl, alt }: { imageUrl: string | null; alt: string }) {
  return (
    <div className="aspect-square overflow-hidden rounded-xl bg-[#DFDFDF]">
      {imageUrl ? (
        <img src={imageUrl} alt={alt} className="h-full w-full object-cover" />
      ) : null}
    </div>
  );
}

/** Mobile card chip row (32px #DFDFDF pills: SKU, supplier). */
export function MobileChip({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex h-8 items-center rounded-[22px] bg-[#DFDFDF] px-3 font-brand text-sm text-[#111111]">
      {children}
    </span>
  );
}
