'use client';

import { useState } from 'react';
import { OrderStatusBadge } from '@/components/app/order-status-badge';
import { OrderDetailsPanel } from '@/components/app/order-details-panel';
import { formatMoneyWhole } from '@/domain/money';
import { formatTableDate } from '@/domain/replenishment';
import {
  ListCard,
  ListHeaderBar,
  ListRow,
  MobileCard,
  MobileChip,
  MobileProductImage,
  NumericCell,
  ProductCell,
  TextCell,
} from '@/components/app/list-pattern';
import type { PurchaseOrderRow } from '@/server/queries';

/**
 * Procurement list — the reference's list pattern: white card (title + count
 * inside), black column bar, gray pill rows that open the Order Details
 * slide-over (informational only; the reference performs no status mutation
 * from this list). Below `sm` rows swap to stacked mobile cards.
 */
export function ProcurementTable({ orders }: { orders: PurchaseOrderRow[] }) {
  const [selected, setSelected] = useState<PurchaseOrderRow | null>(null);

  return (
    <>
      <ListCard
        title="Procurement"
        count={`${orders.length} ${orders.length === 1 ? 'order' : 'orders'}`}
        ariaLabel="Purchase orders"
      >
        <ListHeaderBar>
          <span className="w-[224px] shrink-0">Product</span>
          <span className="w-[90px] shrink-0">Order #</span>
          <span className="min-w-0 flex-1 basis-0">Supplier</span>
          <span className="min-w-0 flex-1 basis-0 text-center">Qty</span>
          <span className="min-w-0 flex-1 basis-0 text-center">Total Cost</span>
          <span className="min-w-0 flex-1 basis-0 text-center">Date</span>
          <span className="w-[100px] shrink-0">Status</span>
        </ListHeaderBar>

        <div className="flex flex-col gap-4 pt-4">
          {orders.map((order) => (
            <div key={order.id} className="flex flex-col gap-4">
              <ListRow
                height="h-[77px]"
                onClick={() => setSelected(order)}
                ariaLabel={`Order details for ${order.orderNumber}`}
              >
                <ProductCell name={order.productName} sku={order.sku} imageUrl={order.imageUrl} width="w-[224px] shrink-0" />
                <NumericCell width="w-[90px] shrink-0">#{order.orderNumber}</NumericCell>
                <TextCell className="flex-1 basis-0">{order.supplierName}</TextCell>
                <NumericCell className="flex-1 basis-0 text-center">{order.quantity}</NumericCell>
                <NumericCell className="flex-1 basis-0 text-center">
                  {formatMoneyWhole(order.totalCostMinor)}
                </NumericCell>
                <NumericCell className="flex-1 basis-0 text-center">{formatTableDate(order.orderDate)}</NumericCell>
                <span className="w-[100px] shrink-0">
                  <OrderStatusBadge status={order.status} />
                </span>
              </ListRow>

              <MobileCard ariaLabel={`Order ${order.orderNumber}`}>
                <MobileProductImage imageUrl={order.imageUrl} alt={order.productName} />
                <div className="flex items-center justify-center">
                  <OrderStatusBadge status={order.status} />
                </div>
                <div className="col-span-2 flex flex-col justify-center gap-2">
                  <span className="font-brand text-sm font-medium text-[#111111]">{order.productName}</span>
                  <div className="flex flex-wrap gap-1">
                    <MobileChip>{order.sku}</MobileChip>
                    <MobileChip>{order.supplierName}</MobileChip>
                  </div>
                </div>
                <div className="flex flex-col justify-center gap-1">
                  <span className="font-brand text-sm text-[#343434]">Order No.</span>
                  <span className="font-numeric text-sm font-light text-[#111111]">#{order.orderNumber}</span>
                </div>
                <div className="flex flex-col justify-center gap-1">
                  <span className="font-brand text-sm text-[#343434]">Order Date</span>
                  <span className="font-numeric text-sm font-light text-[#111111]">
                    {formatTableDate(order.orderDate)}
                  </span>
                </div>
                <div className="flex flex-col justify-center gap-1">
                  <span className="font-brand text-sm text-[#343434]">Total Cost</span>
                  <span className="font-numeric text-sm font-light text-[#111111]">
                    {formatMoneyWhole(order.totalCostMinor)}
                  </span>
                </div>
                <div className="flex flex-col justify-center gap-1">
                  <span className="font-brand text-sm text-[#343434]">Qty</span>
                  <span className="font-numeric text-sm font-light text-[#111111]">{order.quantity} Units</span>
                </div>
              </MobileCard>
            </div>
          ))}
        </div>
      </ListCard>
      <OrderDetailsPanel order={selected} onClose={() => setSelected(null)} />
    </>
  );
}
