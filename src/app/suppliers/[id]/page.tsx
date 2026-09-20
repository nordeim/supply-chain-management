import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, ImagePlus, Star } from 'lucide-react';
import { getSupplierDetail } from '@/server/queries';
import { formatMoneyWhole } from '@/domain/money';
import { formatTableDate } from '@/domain/replenishment';
import { OrderStatusBadge } from '@/components/app/order-status-badge';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{ id: string }>;
}

/**
 * Supplier detail — the reference app's partner profile: back link, image
 * placeholder, name, stat tiles (Products / Completed Orders / Total POs /
 * Avg Lead Time), the partner facts (lead time, reliability, terms, notes),
 * the supplier's product list, and recent purchase orders.
 */
export default async function SupplierDetailPage({ params }: PageProps) {
  const { id } = await params;
  const supplier = await getSupplierDetail(id);
  if (!supplier) notFound();

  const stats = [
    { label: 'Products', value: String(supplier.productCount) },
    { label: 'Completed Orders', value: String(supplier.completedOrders) },
    { label: 'Total POs', value: String(supplier.totalPOs) },
    { label: 'Avg Lead Time', value: `${supplier.avgLeadTimeDays ?? '—'} days` },
  ];

  return (
    <div className="flex flex-col gap-6">
      <Link
        href="/suppliers"
        className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden />
        Back to Suppliers
      </Link>

      <div className="flex flex-col gap-6 rounded-[32px] bg-white p-6 shadow-[0_1px_2px_rgba(0,0,0,0.05)] lg:flex-row">
        <div
          aria-hidden
          className="flex aspect-[4/3] w-full max-w-[280px] shrink-0 items-center justify-center rounded-2xl border border-dashed border-[#dfdfdf] bg-[#efefef] text-muted-foreground"
        >
          <ImagePlus className="h-8 w-8" />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h1 className="text-2xl font-bold tracking-tight">{supplier.name}</h1>
            <span className="inline-flex items-center gap-1" aria-label={`Reliability ${supplier.rating} of 5`}>
              <span className="text-sm font-bold">{supplier.rating}/5</span>
              <Star className="h-4 w-4 fill-primary text-primary" aria-hidden />
            </span>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Contact: {supplier.contactName} · {supplier.email}
          </p>

          <div className="mt-6 grid grid-cols-2 gap-4 md:grid-cols-4">
            {stats.map((s) => (
              <div key={s.label} className="rounded-2xl bg-[#efefef] p-4">
                <p className="text-xs font-medium text-muted-foreground">{s.label}</p>
                <p className="mt-1 text-lg font-bold">{s.value}</p>
              </div>
            ))}
          </div>

          <dl className="mt-6 grid gap-3 text-sm md:grid-cols-2">
            <div className="flex items-center justify-between rounded-2xl bg-[#efefef] px-4 py-3">
              <dt className="text-muted-foreground">Lead Time (Days)</dt>
              <dd className="font-semibold">{supplier.leadTimeDays}</dd>
            </div>
            <div className="flex items-center justify-between rounded-2xl bg-[#efefef] px-4 py-3">
              <dt className="text-muted-foreground">Reliability Score</dt>
              <dd className="font-semibold">{supplier.rating}/5</dd>
            </div>
            <div className="flex items-center justify-between rounded-2xl bg-[#efefef] px-4 py-3">
              <dt className="text-muted-foreground">Payment Terms</dt>
              <dd className="font-semibold">{supplier.paymentTerms}</dd>
            </div>
            <div className="flex items-center justify-between rounded-2xl bg-[#efefef] px-4 py-3">
              <dt className="text-muted-foreground">Notes</dt>
              <dd className="font-semibold">{supplier.notes ?? '—'}</dd>
            </div>
          </dl>
        </div>
      </div>

      <section aria-labelledby="supplier-products-heading" className="rounded-[32px] bg-white p-6 shadow-[0_1px_2px_rgba(0,0,0,0.05)]">
        <h2 id="supplier-products-heading" className="text-lg font-semibold">
          Products
        </h2>
        {supplier.products.length === 0 ? (
          <p className="mt-4 text-sm text-muted-foreground">No products linked to this supplier yet.</p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[420px] text-sm">
              <thead>
                <tr className="border-b border-black/5 text-left font-semibold">
                  <th scope="col" className="pb-3 pr-4">Product</th>
                  <th scope="col" className="pb-3 pr-4">Stock</th>
                  <th scope="col" className="pb-3">Status</th>
                </tr>
              </thead>
              <tbody>
                {supplier.products.map((p) => (
                  <tr key={p.id} className="border-b border-black/5 last:border-0">
                    <td className="py-3 pr-4">
                      <Link href={`/products/${p.id}`} className="font-semibold underline-offset-2 hover:underline">
                        {p.name}
                      </Link>
                    </td>
                    <td className="py-3 pr-4">{p.stock}</td>
                    <td className="py-3">
                      <span
                        className={
                          p.status === 'Healthy' ? 'font-semibold text-success' : 'font-semibold text-destructive'
                        }
                      >
                        {p.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section aria-labelledby="supplier-orders-heading" className="rounded-[32px] bg-white p-6 shadow-[0_1px_2px_rgba(0,0,0,0.05)]">
        <h2 id="supplier-orders-heading" className="text-lg font-semibold">
          Recent Purchase Orders
        </h2>
        {supplier.recentOrders.length === 0 ? (
          <p className="mt-4 text-sm text-muted-foreground">No purchase orders yet</p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[520px] text-sm">
              <thead>
                <tr className="border-b border-black/5 text-left font-semibold">
                  <th scope="col" className="pb-3 pr-4">Order #</th>
                  <th scope="col" className="pb-3 pr-4">Qty</th>
                  <th scope="col" className="pb-3 pr-4">Total Cost</th>
                  <th scope="col" className="pb-3 pr-4">Date</th>
                  <th scope="col" className="pb-3">Status</th>
                </tr>
              </thead>
              <tbody>
                {supplier.recentOrders.map((o) => (
                  <tr key={o.id} className="border-b border-black/5 last:border-0">
                    <td className="py-3 pr-4 font-mono text-xs">#{o.orderNumber}</td>
                    <td className="py-3 pr-4">{o.quantity}</td>
                    <td className="py-3 pr-4 font-semibold">{formatMoneyWhole(o.totalCostMinor)}</td>
                    <td className="py-3 pr-4 text-muted-foreground">{formatTableDate(o.orderDate)}</td>
                    <td className="py-3">
                      <OrderStatusBadge status={o.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
