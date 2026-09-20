'use client';

import Link from 'next/link';
import { ArrowLeft, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { OrderStatusBadge } from '@/components/app/order-status-badge';
import { formatMoney, formatMoneyWhole } from '@/domain/money';
import { formatTableDate } from '@/domain/replenishment';
import type { PurchaseOrderRow } from '@/server/queries';

/**
 * Order Details panel — the reference app's slide-over that opens when a
 * procurement row is clicked: status badge, product summary with a View
 * link, Quantity, Total Cost, Order #, Unit Cost, Supplier, and Date.
 * Informational only (the reference exposes no status actions here).
 */
export function OrderDetailsPanel({
  order,
  onClose,
}: {
  order: PurchaseOrderRow | null;
  onClose: () => void;
}) {
  if (!order) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-black/30"
      role="dialog"
      aria-modal="true"
      aria-label={`Order details for ${order.orderNumber}`}
      onClick={onClose}
    >
      <aside
        className="flex h-full w-full max-w-[380px] flex-col overflow-y-auto bg-white p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Order Details</h2>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Close order details"
            onClick={onClose}
            className="rounded-full hover:bg-secondary"
          >
            <X className="h-5 w-5" aria-hidden />
          </Button>
        </div>

        <div className="mt-2">
          <OrderStatusBadge status={order.status} />
        </div>

        <div className="mt-6 space-y-6 text-sm">
          <div>
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate font-semibold">{order.productName}</p>
                <p className="mt-0.5 font-mono text-xs text-muted-foreground">{order.sku}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">{order.productCategory}</p>
              </div>
              <Button
                asChild
                variant="ghost"
                className="h-8 shrink-0 rounded-full px-3 text-sm font-medium text-[#343434] hover:bg-secondary"
              >
                <Link href={`/products/${order.productId}`}>
                  View
                  <ArrowLeft className="h-3.5 w-3.5 rotate-180" aria-hidden />
                </Link>
              </Button>
            </div>
          </div>

          <dl className="space-y-3">
            <div className="flex items-center justify-between">
              <dt className="text-muted-foreground">Quantity</dt>
              <dd className="font-semibold">{order.quantity}</dd>
            </div>
            <div className="flex items-center justify-between">
              <dt className="text-muted-foreground">Total Cost</dt>
              <dd className="font-semibold">{formatMoneyWhole(order.totalCostMinor)}</dd>
            </div>
            <div className="flex items-center justify-between">
              <dt className="text-muted-foreground">Order #</dt>
              <dd className="font-mono text-xs font-semibold">#{order.orderNumber}</dd>
            </div>
            <div className="flex items-center justify-between">
              <dt className="text-muted-foreground">Unit Cost</dt>
              <dd className="font-semibold">{formatMoney(order.unitCostMinor)}</dd>
            </div>
            <div className="flex items-center justify-between">
              <dt className="text-muted-foreground">Supplier</dt>
              <dd className="font-semibold">{order.supplierName}</dd>
            </div>
            <div className="flex items-center justify-between">
              <dt className="text-muted-foreground">Date</dt>
              <dd className="font-semibold">{formatTableDate(order.orderDate)}</dd>
            </div>
          </dl>
        </div>
      </aside>
    </div>
  );
}
