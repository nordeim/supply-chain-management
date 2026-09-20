'use client';

import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { REFERENCE_AI_REASONING } from '@/domain/replenishment';

/**
 * One AI suggestion row, cloned from the reference: a table line of Product
 * (name + SKU), Supplier, Qty, Total Cost, and Delivery, with an expandable
 * "AI Reasoning" panel and the "Suggested: <date>" note beneath. The
 * reference performs no mutation from this list — rows are informational.
 */
export function SuggestionRow({
  suggestion,
}: {
  suggestion: {
    orderId: string;
    productId: string;
    productName: string;
    sku: string;
    supplierName: string;
    quantity: number;
    totalCost: string;
    expectedDelivery: string;
    aiReasoning: string | null;
    suggestedAt: string;
  };
}) {
  const [open, setOpen] = useState(false);

  return (
    <article className="rounded-2xl bg-white p-4 shadow-[0_1px_2px_rgba(0,0,0,0.05)]">
      <div className="grid items-center gap-4 md:grid-cols-[minmax(220px,3fr)_minmax(140px,2fr)_100px_minmax(110px,1.2fr)_minmax(110px,1fr)]">
        <div className="min-w-0">
          <a
            href={`/products/${suggestion.productId}`}
            className="block truncate text-[15px] font-semibold underline-offset-2 hover:underline"
          >
            {suggestion.productName}
          </a>
          <p className="mt-0.5 font-mono text-xs text-muted-foreground">{suggestion.sku}</p>
        </div>
        <p className="text-sm text-muted-foreground">{suggestion.supplierName}</p>
        <p className="text-sm">
          <span className="font-semibold">{suggestion.quantity}</span>
          <span className="ml-1 text-muted-foreground">Units</span>
        </p>
        <p className="text-sm font-semibold">{suggestion.totalCost}</p>
        <p className="text-sm text-muted-foreground">{suggestion.expectedDelivery}</p>
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border-t border-black/5 pt-3">
        <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
          <span>Suggested: {suggestion.suggestedAt}</span>
        </div>
        <Button
          variant="ghost"
          aria-expanded={open}
          onClick={() => setOpen(!open)}
          className="h-8 rounded-full text-sm font-medium text-[#343434] hover:bg-black/5"
        >
          AI Reasoning
          <ChevronDown className={`h-4 w-4 transition-transform ${open ? 'rotate-180' : ''}`} aria-hidden />
        </Button>
      </div>

      {open && (
        <div className="mt-3 rounded-xl bg-[#efefef] p-4 text-sm leading-relaxed text-[#343434]">
          {suggestion.aiReasoning ?? REFERENCE_AI_REASONING}
        </div>
      )}
    </article>
  );
}
