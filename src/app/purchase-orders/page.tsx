import Link from 'next/link';
import { listPurchaseOrders } from '@/server/queries';
import { formatMoneyWhole } from '@/domain/money';
import { formatTableDate } from '@/domain/replenishment';
import { OrderStatusBadge } from '@/components/app/order-status-badge';
import { OrderFilters } from '@/components/app/order-filters';

export const dynamic = 'force-dynamic';

interface PageProps {
  searchParams: Promise<{ q?: string; status?: string }>;
}

/** Procurement — all purchase orders with search + status filter. */
export default async function PurchaseOrdersPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const search = params.q?.trim() ?? '';
  const status = params.status ?? 'All Statuses';

  const orders = await listPurchaseOrders(search || undefined, status);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Procurement</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {orders.length} {orders.length === 1 ? 'order' : 'orders'}
          </p>
        </div>
        <OrderFilters initialSearch={search} initialStatus={status} />
      </div>

      {orders.length === 0 ? (
        <p className="rounded-2xl bg-[#f3f4f6] p-6 text-sm text-muted-foreground">
          No purchase orders match the current filters.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-[#e5e7eb]">
          <table className="w-full min-w-[900px] text-sm">
            <thead>
              <tr className="border-b border-[#e5e7eb] bg-[#f9fafb] text-left text-xs uppercase tracking-wide text-muted-foreground">
                <th scope="col" className="px-4 py-3 font-semibold">Product</th>
                <th scope="col" className="px-4 py-3 font-semibold">Order #</th>
                <th scope="col" className="px-4 py-3 font-semibold">Supplier</th>
                <th scope="col" className="px-4 py-3 font-semibold text-right">Qty</th>
                <th scope="col" className="px-4 py-3 font-semibold text-right">Total Cost</th>
                <th scope="col" className="px-4 py-3 font-semibold">Date</th>
                <th scope="col" className="px-4 py-3 font-semibold">Status</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((order) => (
                <tr key={order.id} className="border-b border-[#e5e7eb] last:border-0 transition-colors hover:bg-[#f9fafb]">
                  <td className="px-4 py-3">
                    <Link href={`/products/${order.productId}`} className="font-semibold underline-offset-2 hover:underline">
                      {order.productName}
                    </Link>
                    <span className="ml-2 font-mono text-xs text-muted-foreground">{order.sku}</span>
                  </td>
                  <td className="px-4 py-3 font-mono text-xs">#{order.orderNumber}</td>
                  <td className="px-4 py-3 text-muted-foreground">{order.supplierName}</td>
                  <td className="px-4 py-3 text-right font-semibold">{order.quantity}</td>
                  <td className="px-4 py-3 text-right font-semibold">{formatMoneyWhole(order.totalCostMinor)}</td>
                  <td className="px-4 py-3 text-muted-foreground">{formatTableDate(order.orderDate)}</td>
                  <td className="px-4 py-3">
                    <OrderStatusBadge status={order.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
