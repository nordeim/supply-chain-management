'use client';

import { useState } from 'react';
import { OrderStatusBadge } from '@/components/app/order-status-badge';
import { OrderDetailsPanel } from '@/components/app/order-details-panel';
import { formatMoneyWhole } from '@/domain/money';
import { formatTableDate } from '@/domain/replenishment';
import type { PurchaseOrderRow } from '@/server/queries';

/**
 * Procurement table — reference layout: clickable rows (cursor pointer)
 * that open the Order Details slide-over. Informational only; the reference
 * performs no status mutation from this table.
 */
export function ProcurementTable({ orders }: { orders: PurchaseOrderRow[] }) {
  const [selected, setSelected] = useState<PurchaseOrderRow | null>(null);

  return (
    <>
      <div className="overflow-x-auto rounded-[32px] bg-white shadow-[0_1px_2px_rgba(0,0,0,0.05)]">
        <table className="w-full min-w-[900px] text-sm">
          <thead>
            <tr className="border-b border-black/5 text-left text-sm font-semibold text-foreground">
              <th scope="col" className="px-5 py-4">Product</th>
              <th scope="col" className="px-5 py-4">Order #</th>
              <th scope="col" className="px-5 py-4">Supplier</th>
              <th scope="col" className="px-5 py-4 text-right">Qty</th>
              <th scope="col" className="px-5 py-4 text-right">Total Cost</th>
              <th scope="col" className="px-5 py-4">Date</th>
              <th scope="col" className="px-5 py-4">Status</th>
            </tr>
          </thead>
          <tbody>
            {orders.map((order) => (
              <tr
                key={order.id}
                onClick={() => setSelected(order)}
                className="cursor-pointer border-b border-black/5 transition-colors last:border-0 hover:bg-[#efefef]"
              >
                <td className="px-5 py-3.5">
                  <span className="font-semibold">{order.productName}</span>
                  <span className="ml-2 font-mono text-xs text-muted-foreground">{order.sku}</span>
                </td>
                <td className="px-5 py-3.5 font-mono text-xs">#{order.orderNumber}</td>
                <td className="px-5 py-3.5 text-muted-foreground">{order.supplierName}</td>
                <td className="px-5 py-3.5 text-right font-semibold">{order.quantity}</td>
                <td className="px-5 py-3.5 text-right font-semibold">{formatMoneyWhole(order.totalCostMinor)}</td>
                <td className="px-5 py-3.5 text-muted-foreground">{formatTableDate(order.orderDate)}</td>
                <td className="px-5 py-3.5">
                  <OrderStatusBadge status={order.status} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <OrderDetailsPanel order={selected} onClose={() => setSelected(null)} />
    </>
  );
}
