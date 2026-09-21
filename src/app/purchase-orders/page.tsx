import { listPurchaseOrders } from '@/server/queries';
import { OrderFilters } from '@/components/app/order-filters';
import { ProcurementTable } from '@/components/app/procurement-table';

export const dynamic = 'force-dynamic';

interface PageProps {
  searchParams: Promise<{ q?: string; status?: string }>;
}

/** Procurement — filter row above, then the list card with every order. */
export default async function PurchaseOrdersPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const search = params.q?.trim() ?? '';
  const status = params.status ?? 'All Statuses';

  const orders = await listPurchaseOrders(search || undefined, status);

  return (
    <div className="flex flex-col gap-4">
      <OrderFilters initialSearch={search} initialStatus={status} />

      {orders.length === 0 ? (
        <p className="rounded-[32px] bg-white p-6 text-sm text-muted-foreground shadow-[0_1px_2px_rgba(0,0,0,0.05)]">
          No purchase orders match the current filters.
        </p>
      ) : (
        <ProcurementTable orders={orders} />
      )}
    </div>
  );
}
