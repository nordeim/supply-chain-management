import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, ImagePlus } from 'lucide-react';
import { getSupplierDetail } from '@/server/queries';
import { formatMoneyWhole } from '@/domain/money';
import { OrderStatusBadge } from '@/components/app/order-status-badge';
import { cn } from '@/lib/utils';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{ id: string }>;
}

/** Health pill cloned from the reference: black pill with colored text
 *  (Healthy → green, Medium → orange, Out of Stock → red). */
function HealthBadge({ status }: { status: string }) {
  const color =
    status === 'Healthy' ? 'text-[#64E03C]' : status === 'Medium' ? 'text-primary' : 'text-[#F13A15]';
  return (
    <span className={cn('inline-flex h-6 items-center rounded-[40px] bg-[#111111] px-3 font-brand text-sm font-medium', color)}>
      {status}
    </span>
  );
}

/**
 * Supplier detail — the reference app's partner profile: hero card (upload
 * tile, name, contact with phone, big rating, terms, notes), the 4 stat
 * tiles (black / orange / white / white), the facts grid, the product list
 * with health pills, and recent purchase orders.
 */
export default async function SupplierDetailPage({ params }: PageProps) {
  const { id } = await params;
  const supplier = await getSupplierDetail(id);
  if (!supplier) notFound();

  const stats = [
    { label: 'Products', value: String(supplier.productCount), dark: true, valueClass: 'text-primary' },
    { label: 'Completed Orders', value: String(supplier.completedOrders), orange: true },
    { label: 'Total POs', value: String(supplier.totalPOs) },
    { label: 'Avg Lead Time', value: `${supplier.avgLeadTimeDays ?? '—'} days` },
  ];

  const facts = [
    { label: 'Lead Time (Days)', value: String(supplier.leadTimeDays) },
    { label: 'Reliability Score', value: `${supplier.rating}/5` },
    { label: 'Payment Terms', value: supplier.paymentTerms },
    { label: 'Notes', value: supplier.notes ?? '—' },
  ];

  return (
    <div className="flex flex-col gap-4">
      <Link
        href="/suppliers"
        className="inline-flex items-center gap-2 pl-2.5 font-brand text-sm font-medium text-[#343434] transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden />
        Back to Suppliers
      </Link>

      {/* Hero card */}
      <section
        aria-label={supplier.name}
        className="rounded-[32px] bg-white p-4 shadow-[0_1px_2px_rgba(0,0,0,0.05)]"
      >
        <div className="flex flex-col gap-4 sm:flex-row">
          <div
            aria-hidden
            className="flex aspect-square w-full max-w-[200px] shrink-0 flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-[#dfdfdf] bg-[#efefef] text-[#898989]"
          >
            <ImagePlus className="h-6 w-6" />
            <span className="font-brand text-sm font-normal">Click to upload</span>
          </div>

          <div className="flex min-w-0 flex-1 flex-col">
            <h1 className="font-brand text-sm font-medium text-[#111111]">{supplier.name}</h1>
            <p className="mt-2 font-brand text-sm font-normal text-[#111111]">
              {supplier.contactName}
              {supplier.phone ? ` · ${supplier.phone}` : ''}
            </p>
            <p className="font-brand text-sm font-normal text-[#111111]">{supplier.email}</p>

            <div className="mt-6 flex flex-wrap items-baseline gap-2">
              <span className="font-numeric text-5xl font-light text-[#111111]" aria-label={`Rating ${supplier.rating} of 5`}>
                {supplier.rating}/5
              </span>
              <span className="font-brand text-sm text-[#64E03C]" aria-hidden>
                ★
              </span>
              <span className="font-brand text-sm font-normal text-[#898989]">{supplier.paymentTerms}</span>
            </div>

            <p className="mt-4 font-brand text-sm font-normal text-[#898989]">{supplier.notes ?? ''}</p>
          </div>
        </div>
      </section>

      {/* Stat tiles (black / orange / white / white — like the reference) */}
      <div className="mx-4 grid h-[146px] grid-cols-2 gap-x-9 gap-y-4 xl:grid-cols-4">
        {stats.map((s) => (
          <div
            key={s.label}
            className={cn(
              'flex flex-col rounded-[32px] p-4 pb-5 shadow-[0_1px_2px_rgba(0,0,0,0.05)]',
              s.dark ? 'bg-[#111111]' : s.orange ? 'bg-primary' : 'bg-white',
            )}
          >
            <p
              className={cn(
                'font-brand text-sm font-normal',
                s.dark ? 'text-white' : 'text-[#111111]',
              )}
            >
              {s.label}
            </p>
            <p className={cn('mt-auto font-numeric text-5xl font-light', s.dark ? 'text-primary' : 'text-[#111111]')}>
              {s.value}
            </p>
          </div>
        ))}
      </div>

      {/* Facts grid */}
      <div className="mx-4 grid gap-4 md:grid-cols-2">
        {facts.map((f) => (
          <div
            key={f.label}
            className="flex min-h-[114px] flex-col justify-between rounded-[32px] bg-white p-4 shadow-[0_1px_2px_rgba(0,0,0,0.05)]"
          >
            <p className="font-brand text-sm font-normal text-[#343434]">{f.label}</p>
            <p className="font-brand text-sm font-medium text-[#111111]">{f.value}</p>
          </div>
        ))}
      </div>

      {/* Products */}
      <section
        aria-labelledby="supplier-products-heading"
        className="rounded-[32px] bg-white p-4 shadow-[0_1px_2px_rgba(0,0,0,0.05)]"
      >
        <h2 id="supplier-products-heading" className="font-brand text-sm font-medium text-[#111111]">
          Products
        </h2>
        {supplier.products.length === 0 ? (
          <p className="mt-4 font-brand text-sm text-[#898989]">No products linked to this supplier yet.</p>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[420px] font-brand text-sm">
              <thead>
                <tr className="text-left text-[#343434]">
                  <th scope="col" className="pb-3 pr-4 font-normal">Product</th>
                  <th scope="col" className="pb-3 pr-4 font-normal">Stock</th>
                  <th scope="col" className="pb-3 font-normal">Status</th>
                </tr>
              </thead>
              <tbody>
                {supplier.products.map((p) => (
                  <tr key={p.id} className="border-t border-black/5">
                    <td className="py-3 pr-4">
                      <Link href={`/products/${p.id}`} className="font-medium text-[#111111] underline-offset-2 hover:underline">
                        {p.name}
                      </Link>
                    </td>
                    <td className="py-3 pr-4 font-numeric font-light text-[#111111]">{p.stock}</td>
                    <td className="py-3">
                      <HealthBadge status={p.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Recent purchase orders — reference row format: status · product qty · cost · date */}
      <section
        aria-labelledby="supplier-orders-heading"
        className="rounded-[32px] bg-white p-4 shadow-[0_1px_2px_rgba(0,0,0,0.05)]"
      >
        <h2 id="supplier-orders-heading" className="font-brand text-sm font-medium text-[#111111]">
          Recent Purchase Orders
        </h2>
        {supplier.recentOrders.length === 0 ? (
          <p className="mt-4 font-brand text-sm text-[#898989]">No purchase orders yet</p>
        ) : (
          <ul className="mt-3 flex flex-col gap-2">
            {supplier.recentOrders.map((o) => (
              <li
                key={o.id}
                className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-[22px] bg-[#EFEFEF] px-4 py-3"
              >
                <OrderStatusBadge status={o.status} />
                <span className="font-brand text-sm font-medium text-[#111111]">
                  {o.orderNumber.replace(/^#/, '')}
                </span>
                <span className="font-brand text-sm font-normal text-[#111111]">
                  {o.quantity} Units
                </span>
                <span className="ml-auto font-numeric text-sm font-light text-[#111111]">
                  {formatMoneyWhole(o.totalCostMinor)}
                </span>
                <span className="font-numeric text-sm font-light text-[#111111]">
                  {o.orderDate.toISOString().slice(0, 10)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
