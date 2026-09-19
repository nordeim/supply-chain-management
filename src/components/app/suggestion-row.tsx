'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { Link2 } from 'lucide-react';
import { Check, ChevronDown, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { approveSuggestionAction, dismissSuggestionAction } from '@/server/actions';

/**
 * One AI suggestion row: product, supplier, qty, total cost, delivery date,
 * and an expandable "AI Reasoning" panel. Approve moves the suggestion into
 * an approved purchase order; Dismiss cancels it.
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
  const { toast } = useToast();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  async function handleDecision(action: 'approve' | 'dismiss') {
    startTransition(async () => {
      const result =
        action === 'approve'
          ? await approveSuggestionAction(suggestion.orderId)
          : await dismissSuggestionAction(suggestion.orderId);
      if (result.ok) {
        toast({
          title: action === 'approve' ? 'Suggestion approved' : 'Suggestion dismissed',
          description: `${suggestion.productName} — order ${result.data.orderNumber}`,
        });
      } else {
        toast({ title: 'Action failed', description: result.message, variant: 'destructive' });
      }
      router.refresh();
    });
  }

  return (
    <article className="rounded-2xl bg-[#f3f4f6] p-4">
      <div className="grid items-center gap-4 md:grid-cols-[minmax(200px,2fr)_1fr_auto_auto]">
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
          <span className="ml-1 text-muted-foreground">units</span>
        </p>
        <p className="text-sm font-semibold">{suggestion.totalCost}</p>
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border-t border-black/5 pt-3">
        <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
          <span>
            Delivery <span className="font-medium text-foreground">{suggestion.expectedDelivery}</span>
          </span>
          <span className="inline-flex items-center gap-1">
            <Link2 className="h-3.5 w-3.5" aria-hidden />
            Suggested {suggestion.suggestedAt}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={() => handleDecision('dismiss')}
            disabled={isPending}
            className="h-8 rounded-full border-[#dcdfe3] bg-white text-sm font-medium hover:bg-white/70"
          >
            <X className="h-3.5 w-3.5" aria-hidden />
            Dismiss
          </Button>
          <Button
            onClick={() => handleDecision('approve')}
            disabled={isPending}
            className="h-8 rounded-full bg-primary text-sm font-semibold text-primary-foreground hover:bg-primary/90"
          >
            <Check className="h-3.5 w-3.5" aria-hidden />
            Approve
          </Button>
          <Button
            variant="ghost"
            aria-expanded={open}
            onClick={() => setOpen(!open)}
            className="h-8 rounded-full text-sm font-medium text-[#374151] hover:bg-black/5"
          >
            AI Reasoning
            <ChevronDown className={`h-4 w-4 transition-transform ${open ? 'rotate-180' : ''}`} aria-hidden />
          </Button>
        </div>
      </div>

      {open && (
        <div className="mt-3 rounded-xl bg-white p-4 text-sm leading-relaxed text-[#374151]">
          {suggestion.aiReasoning ??
            'The replenishment engine flagged this SKU because its projected stock at the end of the supplier lead time falls below the reorder point.'}
        </div>
      )}
    </article>
  );
}
