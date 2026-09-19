'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMemo, useState, useTransition } from 'react';
import { ArrowRight, ChevronDown, PackageX, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { approveSuggestionAction, generateSuggestionsAction } from '@/server/actions';
import type { StockFeedItem } from '@/domain/types';

type FeedSort = 'priority' | 'recent' | 'product';

/**
 * Stock Feed — replenishment attention list. Out-of-stock items first with a
 * direct "Order" action; items with an open AI suggestion get a "Review"
 * jump link. Sorting mirrors the reference's Priority dropdown.
 */
export function StockFeed({ items }: { items: StockFeedItem[] }) {
  const { toast } = useToast();
  const router = useRouter();
  const [sort, setSort] = useState<FeedSort>('priority');
  const [isPending, startTransition] = useTransition();

  const sorted = useMemo(() => {
    const copy = [...items];
    if (sort === 'product') return copy.sort((a, b) => a.productName.localeCompare(b.productName));
    if (sort === 'recent') return copy.sort((a, b) => b.velocityPerDay - a.velocityPerDay);
    return copy; // 'priority' — already sorted by the query layer
  }, [items, sort]);

  async function handleOrder(item: StockFeedItem) {
    startTransition(async () => {
      if (item.suggestionOrderId) {
        const result = await approveSuggestionAction(item.suggestionOrderId);
        if (result.ok) {
          toast({ title: 'Purchase order approved', description: `${item.productName} — ${result.data.orderNumber}` });
        } else {
          toast({ title: 'Could not approve order', description: result.message, variant: 'destructive' });
        }
      } else {
        const result = await generateSuggestionsAction();
        if (result.ok) {
          toast({
            title: 'Suggestion generated',
            description: `The replenishment engine created ${result.data.created} suggestion(s). Review them on the AI Suggestions page.`,
          });
        } else {
          toast({ title: 'Could not generate suggestion', description: result.message, variant: 'destructive' });
        }
      }
      router.refresh();
    });
  }

  return (
    <section aria-labelledby="stock-feed-heading">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-primary" aria-hidden />
          <h2 id="stock-feed-heading" className="text-lg font-semibold">
            Stock Feed
          </h2>
        </div>
        <Select value={sort} onValueChange={(v) => setSort(v as FeedSort)}>
          <SelectTrigger
            aria-label="Sort stock feed"
            className="h-9 w-[150px] rounded-full bg-[#f3f4f6] border-none text-sm text-foreground"
          >
            <SelectValue />
            <ChevronDown className="h-4 w-4 opacity-60" aria-hidden />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="priority">Priority</SelectItem>
            <SelectItem value="recent">Recent velocity</SelectItem>
            <SelectItem value="product">Product name</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {sorted.length === 0 ? (
        <p className="mt-4 rounded-2xl bg-[#f3f4f6] p-4 text-sm text-muted-foreground">
          Everything is comfortably above its reorder point — nothing needs attention right now.
        </p>
      ) : (
        <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {sorted.map((item) => (
            <article
              key={`${item.productId}-${item.suggestionOrderId ?? 'none'}`}
              className="rounded-2xl bg-[#f3f4f6] p-4"
            >
              {item.outOfStock ? (
                <p className="flex items-center gap-1.5 text-sm font-semibold text-destructive">
                  <PackageX className="h-4 w-4" aria-hidden />
                  Out of Stock
                </p>
              ) : (
                <p className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
                  <Sparkles className="h-4 w-4 text-primary" aria-hidden />
                  AI suggests ordering {item.suggestedQty ?? item.reorderPoint + 10} units
                </p>
              )}

              <Link
                href={`/products/${item.productId}`}
                className="mt-2 block truncate text-[15px] font-semibold underline-offset-2 hover:underline"
              >
                {item.productName}
              </Link>

              <p className="mt-1 text-sm text-muted-foreground">
                {item.outOfStock
                  ? `Velocity ${item.velocityPerDay.toFixed(1)}/day · Reorder point ${item.reorderPoint}`
                  : `Lead time ${item.supplierLeadTimeDays ?? '—'} days · ${item.supplierName ?? 'No supplier'}`}
              </p>

              <div className="mt-3">
                {item.suggestionOrderId ? (
                  <Button
                    asChild
                    variant="outline"
                    className="h-8 rounded-full border-[#dcdfe3] bg-white text-sm font-semibold hover:bg-white/60"
                  >
                    <Link href="/ai-suggestions">
                      Review
                      <ArrowRight className="h-3.5 w-3.5" aria-hidden />
                    </Link>
                  </Button>
                ) : (
                  <Button
                    onClick={() => handleOrder(item)}
                    disabled={isPending}
                    className="h-8 rounded-full bg-primary text-sm font-semibold text-primary-foreground hover:bg-primary/90"
                  >
                    Order
                  </Button>
                )}
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
