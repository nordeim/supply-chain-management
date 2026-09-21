import Link from 'next/link';
import { listSuggestions } from '@/server/queries';
import { formatMoneyWhole } from '@/domain/money';
import { SuggestionRow } from '@/components/app/suggestion-row';
import { ListCard, ListHeaderBar } from '@/components/app/list-pattern';

export const dynamic = 'force-dynamic';

function isoDate(date: Date | null): string {
  return date ? date.toISOString().slice(0, 10) : '—';
}

/**
 * AI Suggestions — pending replenishment recommendations inside the
 * reference's list card (title + count in the card, black column bar, gray
 * pill rows with expandable AI Reasoning beneath each row and the
 * "Suggested:" date note below that).
 */
export default async function AiSuggestionsPage() {
  const suggestions = await listSuggestions();

  return (
    <div className="flex flex-col gap-4">
      {suggestions.length === 0 ? (
        <p className="rounded-[32px] bg-white p-6 text-sm text-muted-foreground shadow-[0_1px_2px_rgba(0,0,0,0.05)]">
          No pending suggestions. Everything is comfortably stocked — new suggestions appear here when a SKU is
          projected to fall below its reorder point.
        </p>
      ) : (
        <ListCard
          title="AI Suggestions"
          count={`${suggestions.length} pending ${suggestions.length === 1 ? 'suggestion' : 'suggestions'}`}
          ariaLabel="AI replenishment suggestions"
        >
          <ListHeaderBar>
            <span className="w-[224px] shrink-0">Product</span>
            <span className="min-w-0 flex-1 basis-0">Supplier</span>
            <span className="min-w-0 flex-1 basis-0 text-center">Qty</span>
            <span className="min-w-0 flex-1 basis-0 text-center">Total Cost</span>
            <span className="min-w-0 flex-1 basis-0 text-center">Delivery</span>
          </ListHeaderBar>

          <div className="flex flex-col gap-4 pt-4">
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
                  imageUrl: s.imageUrl,
                }}
              />
            ))}
          </div>
        </ListCard>
      )}

      <p className="font-brand text-sm text-[#343434]">
        Suggestions are derived from the movement ledger — stock levels, sales velocity, and supplier lead
        times.{' '}
        <Link href="/purchase-orders" className="font-medium text-[#111111] underline-offset-2 hover:underline">
          Review the procurement queue
        </Link>{' '}
        to see every purchase order.
      </p>
    </div>
  );
}
