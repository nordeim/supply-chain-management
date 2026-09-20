import Link from 'next/link';
import { listSuggestions } from '@/server/queries';
import { formatMoneyWhole } from '@/domain/money';
import { SuggestionRow } from '@/components/app/suggestion-row';

export const dynamic = 'force-dynamic';

function isoDate(date: Date | null): string {
  return date ? date.toISOString().slice(0, 10) : '—';
}

/**
 * AI Suggestions — pending replenishment recommendations with expandable,
 * number-backed reasoning. The layout mirrors the reference: a table of
 * Product / Supplier / Qty / Total Cost / Delivery with an AI Reasoning
 * expander per row and the "Suggested:" date beneath.
 */
export default async function AiSuggestionsPage() {
  const suggestions = await listSuggestions();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">AI Suggestions</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {suggestions.length} pending {suggestions.length === 1 ? 'suggestion' : 'suggestions'}
        </p>
      </div>

      {suggestions.length === 0 ? (
        <p className="rounded-[32px] bg-white p-6 text-sm text-muted-foreground">
          No pending suggestions. Everything is comfortably stocked — new suggestions appear here when a SKU is
          projected to fall below its reorder point.
        </p>
      ) : (
        <div className="flex flex-col gap-3">
          <div className="hidden grid-cols-[minmax(220px,3fr)_minmax(140px,2fr)_100px_minmax(110px,1.2fr)_minmax(110px,1fr)] gap-4 px-4 pb-1 text-sm font-semibold text-foreground md:grid">
            <span>Product</span>
            <span>Supplier</span>
            <span>Qty</span>
            <span>Total Cost</span>
            <span>Delivery</span>
          </div>
          {suggestions.map((s) => (
            <SuggestionRow
              key={s.orderId}
              suggestion={{
                orderId: s.orderId,
                productId: s.productId,
                productName: s.productName,
                sku: s.sku,
                supplierName: s.supplierName,
                quantity: s.quantity,
                totalCost: formatMoneyWhole(s.totalCostMinor),
                expectedDelivery: isoDate(s.expectedDelivery),
                aiReasoning: s.aiReasoning,
                suggestedAt: isoDate(s.orderDate),
              }}
            />
          ))}
        </div>
      )}

      <p className="text-sm text-muted-foreground">
        Suggestions are derived from the movement ledger — stock levels, sales velocity, and supplier lead
        times.{' '}
        <Link href="/purchase-orders" className="font-medium text-foreground underline-offset-2 hover:underline">
          Review the procurement queue
        </Link>{' '}
        to see every purchase order.
      </p>
    </div>
  );
}
