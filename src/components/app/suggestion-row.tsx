'use client';

import Link from 'next/link';
import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { REFERENCE_AI_REASONING } from '@/domain/replenishment';
import {
  MobileCard,
  MobileChip,
  MobileProductImage,
  NumericCell,
  ProductCell,
  TextCell,
} from '@/components/app/list-pattern';

/**
 * One AI suggestion group, cloned from the reference: a gray pill row
 * (Product image+name+SKU | Supplier | Qty | Total Cost | Delivery — Hanken
 * Grotesk numerals), the "AI Reasoning ▼" expander below it, and the
 * "Suggested: <date>" note. Below `sm` the row swaps to a stacked mobile
 * card (square image, SKU/supplier chips, Total Cost / Qty cells).
 * Informational only — the reference performs no mutation from this list.
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
    imageUrl: string | null;
  };
}) {
  const [open, setOpen] = useState(false);

  return (
    <div
      role="group"
      aria-label={`Suggestion ${suggestion.sku}`}
      className="flex flex-col gap-4"
    >
      {/* Desktop row (sm+) */}
      <div className="hidden h-[78px] w-full items-center gap-4 rounded-[22px] bg-[#EFEFEF] px-4 sm:flex">
        <ProductCell
          name={suggestion.productName}
          sku={suggestion.sku}
          imageUrl={suggestion.imageUrl}
          href={`/products/${suggestion.productId}`}
          width="w-[224px] shrink-0"
        />
        <TextCell className="flex-1 basis-0">{suggestion.supplierName}</TextCell>
        <NumericCell className="flex-1 basis-0 text-center lg:text-[18px]">{suggestion.quantity}</NumericCell>
        <NumericCell className="flex-1 basis-0 text-center lg:text-[18px]">{suggestion.totalCost}</NumericCell>
        <NumericCell className="flex-1 basis-0 text-center">{suggestion.expectedDelivery}</NumericCell>
      </div>

      {/* Mobile card (below sm) */}
      <MobileCard ariaLabel={`Suggestion for ${suggestion.productName}`}>
        <MobileProductImage imageUrl={suggestion.imageUrl} alt={suggestion.productName} />
        <div className="flex flex-col justify-center gap-2">
          <Link
            href={`/products/${suggestion.productId}`}
            className="font-brand text-sm font-medium text-[#111111]"
          >
            {suggestion.productName}
          </Link>
          <div className="flex flex-wrap gap-1">
            <MobileChip>{suggestion.sku}</MobileChip>
            <MobileChip>{suggestion.supplierName}</MobileChip>
          </div>
        </div>
        <div className="flex flex-col justify-center gap-1">
          <span className="font-brand text-sm text-[#343434]">Total Cost</span>
          <span className="font-numeric text-sm font-light text-[#111111]">{suggestion.totalCost}</span>
        </div>
        <div className="flex flex-col justify-center gap-1">
          <span className="font-brand text-sm text-[#343434]">Qty</span>
          <span className="font-numeric text-sm font-light text-[#111111]">{suggestion.quantity} Units</span>
        </div>
      </MobileCard>

      {/* Expander + suggested note (shared) */}
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
        className="flex h-[41px] w-full items-center justify-center gap-2 rounded-[20px] font-brand text-sm font-medium text-[#898989] transition-colors hover:bg-black/5"
      >
        AI Reasoning
        <ChevronDown className={`h-4 w-4 transition-transform ${open ? 'rotate-180' : ''}`} aria-hidden />
      </button>

      {open && (
        <div className="rounded-[20px] bg-[#EFEFEF] p-4 font-brand text-sm leading-relaxed text-[#343434]">
          {suggestion.aiReasoning ?? REFERENCE_AI_REASONING}
        </div>
      )}

      <p className="h-[21px] font-brand text-sm text-[#898989]">Suggested: {suggestion.suggestedAt}</p>
    </div>
  );
}
