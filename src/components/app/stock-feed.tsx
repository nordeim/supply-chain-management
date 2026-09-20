'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { StockFeedItem } from '@/domain/types';

type FeedSort = 'priority' | 'recent' | 'product';

/**
 * Stock Feed — the reference dashboard's replenishment grid: a 4-column
 * layout of 232px cards. "Attention" cards (red tag, Order button) lead for
 * products at/below the reorder point; each pending AI suggestion renders
 * its own card (Review button + "AI suggests ordering N units"). Both
 * buttons navigate to the product's detail page — the reference performs no
 * mutation from the feed.
 */
export function StockFeed({ items }: { items: StockFeedItem[] }) {
  const [sort, setSort] = useState<FeedSort>('priority');

  const sorted = useMemo(() => {
    const copy = [...items];
    if (sort === 'product') return copy.sort((a, b) => a.productName.localeCompare(b.productName));
    if (sort === 'recent')
      return copy.sort((a, b) => {
        if (a.kind !== b.kind) return a.kind === 'attention' ? -1 : 1;
        return b.velocityPerDay - a.velocityPerDay;
      });
    return copy; // 'priority' — attention first, then suggestions in feed order
  }, [items, sort]);

  if (items.length === 0) {
    return (
      <section aria-labelledby="stock-feed-heading" className="rounded-[32px] bg-white p-6">
        <h2 id="stock-feed-heading" className="text-lg font-semibold">
          Stock Feed
        </h2>
        <p className="mt-4 text-sm text-muted-foreground">
          Nothing needs attention right now — items appear when stock drops to a reorder point or the
          engine opens a suggestion.
        </p>
      </section>
    );
  }

  return (
    <section aria-labelledby="stock-feed-heading" className="rounded-[32px] bg-white p-6">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <span className="h-4 w-4 shrink-0 rounded-full bg-primary" aria-hidden />
          <h2 id="stock-feed-heading" className="text-lg font-semibold">
            Stock Feed
          </h2>
        </div>
        <Select value={sort} onValueChange={(v) => setSort(v as FeedSort)}>
          <SelectTrigger aria-label="Sort stock feed" className="h-9 w-[130px] rounded-xl border-none bg-secondary text-sm font-medium">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="priority">Priority</SelectItem>
            <SelectItem value="recent">Recent</SelectItem>
            <SelectItem value="product">Product</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {sorted.map((item, index) => (
          <article
            key={`${item.kind}-${item.suggestionOrderId ?? item.productId}-${index}`}
            className="flex w-full max-w-[232px] flex-col gap-3 rounded-2xl bg-[#efefef] p-4"
          >
            {item.kind === 'attention' ? (
              <p className="flex items-center gap-1.5 text-sm font-semibold text-destructive">
                {item.outOfStock ? 'Out of Stock' : 'Low Stock'}
              </p>
            ) : (
              <p className="flex items-center gap-1.5 text-sm font-semibold text-primary">
                AI suggests ordering {item.suggestedQty ?? '—'} units
              </p>
            )}

            <Link href={`/products/${item.productId}`} aria-label={item.productName} className="block overflow-hidden rounded-xl bg-white">
              {item.imageUrl ? (
                <img src={item.imageUrl} alt="" className="h-24 w-full object-cover" />
              ) : (
                <div className="flex h-24 w-full items-center justify-center bg-secondary text-2xl font-semibold text-muted-foreground">
                  {item.sku.slice(-1)}
                </div>
              )}
            </Link>

            <div className="flex flex-1 flex-col justify-between gap-3">
              <div>
                <Link
                  href={`/products/${item.productId}`}
                  className="line-clamp-2 text-[15px] font-semibold leading-snug hover:underline"
                >
                  {item.productName}
                </Link>
                <p className="mt-1 text-xs text-muted-foreground">
                  {item.kind === 'attention'
                    ? `Velocity ${item.velocityPerDay.toFixed(1)}/day · Reorder point ${item.reorderPoint}`
                    : `Lead time ${item.supplierLeadTimeDays ?? '—'} days · ${item.supplierName ?? '—'}`}
                </p>
              </div>
              <Button
                asChild
                variant="outline"
                className="h-8 w-fit rounded-lg border-[#dfdfdf] bg-white px-3 text-xs font-semibold hover:bg-secondary"
              >
                <Link href={`/products/${item.productId}`}>
                  {item.kind === 'attention' ? 'Order' : 'Review'}
                  <ChevronDown className="h-3.5 w-3.5 -rotate-90" aria-hidden />
                </Link>
              </Button>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
