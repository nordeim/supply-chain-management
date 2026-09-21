import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { getProductDetail } from '@/server/queries';
import { formatMoneyPlain } from '@/domain/money';
import { StockHistoryChart, DemandForecastChart } from '@/components/app/product-charts';
import { OrderStatusBadge } from '@/components/app/order-status-badge';
import { cn } from '@/lib/utils';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{ id: string }>;
}

/** Fact tile (265x119) used in the 2x2 policy grid. */
function FactCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex min-h-[119px] flex-col justify-between rounded-[32px] bg-white p-4 shadow-[0_1px_2px_rgba(0,0,0,0.05)]">
      <p className="font-brand text-sm font-normal text-[#343434]">{label}</p>
      <p className="font-brand text-sm font-medium text-[#111111]">{value}</p>
    </div>
  );
}

/** Stat tile (265x146) — black / orange / white like the reference. */
function StatTile({
  label,
  value,
  suffix,
  tone,
}: {
  label: string;
  value: string;
  suffix?: string;
  tone: 'dark' | 'orange' | 'plain';
}) {
  return (
    <div
      className={cn(
        'flex h-[146px] flex-col rounded-[32px] p-4 pb-5 shadow-[0_1px_2px_rgba(0,0,0,0.05)]',
        tone === 'dark' ? 'bg-[#111111]' : tone === 'orange' ? 'bg-primary' : 'bg-white',
      )}
    >
      <p className={cn('font-brand text-sm font-normal', tone === 'dark' ? 'text-white' : 'text-[#111111]')}>
        {label}
      </p>
      <p className={cn('mt-auto font-numeric text-5xl font-light', tone === 'dark' ? 'text-primary' : 'text-[#111111]')}>
        {value}
        {suffix && <span className="ml-1 font-numeric text-xl font-light">{suffix}</span>}
      </p>
    </div>
  );
}

/**
 * Product detail — the reference layout: hero card (image tile + name/SKU/
 * badges), the black/orange/white stat tiles, then a two-column grid:
 * Description + 2x2 policy facts + Location on the left, Stock History +
 * Demand Forecast + Purchase Orders on the right.
 */
export default async function ProductDetailPage({ params }: PageProps) {
  const { id } = await params;
  const product = await getProductDetail(id);
  if (!product) notFound();

  const a = product.analytics;
  const hasForecast = a.velocityPerDay > 0;

  return (
    <div className="flex flex-col gap-4">
      <Link
        href="/products"
        className="inline-flex items-center gap-2 pl-2.5 font-brand text-sm font-medium text-[#343434] transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden />
        Back to Products
      </Link>

      {/* Hero card */}
      <section
        aria-label={product.name}
        className="rounded-[32px] bg-white p-4 shadow-[0_1px_2px_rgba(0,0,0,0.05)]"
      >
        <div className="flex flex-col gap-4 sm:flex-row">
          <img
            src={product.imageUrl ?? ''}
            alt={product.name}
            className="aspect-square w-full max-w-[200px] shrink-0 rounded-2xl bg-[#EFEFEF] object-cover"
          />
          <div className="flex min-w-0 flex-1 flex-col">
            <h1 className="font-brand text-sm font-medium text-[#111111]">{product.name}</h1>
            <p className="mt-2 font-brand text-sm font-normal text-[#111111]">{product.sku}</p>
            <div className="mt-4 flex flex-wrap items-center gap-4">
              <span className="font-brand text-sm font-medium text-[#64E03C]">{product.status}</span>
              <span className="font-brand text-sm font-medium text-[#111111]">{product.category}</span>
            </div>
          </div>
        </div>
      </section>

      {/* Stat tiles: Stock (black) · Velocity (orange) · Cost · Price */}
      <div className="grid grid-cols-2 gap-1 xl:grid-cols-4">
        <StatTile label="Stock" value={String(product.stock)} tone="dark" />
        <StatTile label="Velocity" value={a.velocityPerDay.toFixed(1)} suffix="/Day" tone="orange" />
        <StatTile label="Cost" value={formatMoneyPlain(product.costMinor)} tone="plain" />
        <StatTile label="Price" value={formatMoneyPlain(product.priceMinor)} tone="plain" />
      </div>

      {/* Two-column body (4px gutters like the reference) */}
      <div className="grid gap-1 lg:grid-cols-2">
        {/* Left column */}
        <div className="flex flex-col gap-1">
          <section
            aria-labelledby="description-heading"
            className="min-h-[130px] rounded-[32px] bg-white p-4 shadow-[0_1px_2px_rgba(0,0,0,0.05)]"
          >
            <h2 id="description-heading" className="font-brand text-sm font-medium text-[#111111]">
              Description
            </h2>
            <p className="mt-2 font-brand text-sm font-normal leading-relaxed text-[#898989]">
              {product.description ?? 'No description recorded for this product.'}
            </p>
          </section>

          <div className="grid grid-cols-2 gap-1">
            <FactCard label="Reorder Point" value={String(product.reorderPoint)} />
            <FactCard label="Reorder Qty" value={String(product.reorderQty)} />
            <FactCard label="Supplier" value={product.supplierName ?? '—'} />
            <FactCard label="Lead Time (Days)" value={String(product.leadTimeDays)} />
          </div>

          <section
            aria-labelledby="location-heading"
            className="flex min-h-[114px] flex-col justify-between rounded-[32px] bg-white p-4 shadow-[0_1px_2px_rgba(0,0,0,0.05)]"
          >
            <h2 id="location-heading" className="font-brand text-sm font-normal text-[#343434]">
              Location
            </h2>
            <p className="font-brand text-sm font-medium text-[#111111]">{product.location ?? '—'}</p>
          </section>
        </div>

        {/* Right column */}
        <div className="flex flex-col gap-1">
          <section
            aria-labelledby="stock-history-heading"
            className="rounded-[32px] bg-white p-4 shadow-[0_1px_2px_rgba(0,0,0,0.05)]"
          >
            <h2 id="stock-history-heading" className="font-brand text-sm font-medium text-[#111111]">
              Stock Level History
            </h2>
            <div className="mt-3">
              <StockHistoryChart series={product.stockHistory} />
            </div>
          </section>

          <section
            aria-labelledby="forecast-heading"
            className="rounded-[32px] bg-white p-4 shadow-[0_1px_2px_rgba(0,0,0,0.05)]"
          >
            <h2 id="forecast-heading" className="font-brand text-sm font-medium text-[#111111]">
              Demand Forecast (Next 30 Days)
            </h2>
            {hasForecast ? (
              <div className="mt-3">
                <DemandForecastChart series={a.forecast} />
              </div>
            ) : (
              <p className="mt-3 font-brand text-sm text-[#898989]">
                No velocity data available — the forecast appears once this product starts selling.
              </p>
            )}
          </section>

          <section
            aria-labelledby="orders-heading"
            className="rounded-[32px] bg-white p-4 shadow-[0_1px_2px_rgba(0,0,0,0.05)]"
          >
            <h2 id="orders-heading" className="font-brand text-sm font-medium text-[#111111]">
              Purchase Orders
            </h2>
            {product.purchaseOrders.length === 0 ? (
              <p className="mt-3 font-brand text-sm text-[#898989]">No purchase orders</p>
            ) : (
              <ul className="mt-3 flex flex-col gap-1">
                {product.purchaseOrders.map((order) => (
                  <li key={order.id}>
                    <Link
                      href="/purchase-orders"
                      className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-[22px] bg-[#EFEFEF] px-4 py-3 transition-colors hover:bg-secondary"
                    >
                      <OrderStatusBadge status={order.status} />
                      <span className="font-brand text-sm font-medium text-[#111111]">{order.quantity} Units</span>
                      <span className="ml-auto font-brand text-sm font-normal text-[#111111]">
                        {order.supplierName}
                      </span>
                      <span className="font-numeric text-sm font-light text-[#111111]">
                        {order.orderDate.toISOString().slice(0, 10)}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
