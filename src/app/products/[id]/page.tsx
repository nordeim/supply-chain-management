import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { getProductDetail } from '@/server/queries';
import { formatMoneyPlain } from '@/domain/money';
import { StockHistoryChart, DemandForecastChart } from '@/components/app/product-charts';
import { OrderStatusBadge } from '@/components/app/order-status-badge';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{ id: string }>;
}

/** Product detail — stats, policy, supplier, history & forecast charts, orders. */
export default async function ProductDetailPage({ params }: PageProps) {
  const { id } = await params;
  const product = await getProductDetail(id);
  if (!product) notFound();

  const a = product.analytics;
  const hasForecast = a.velocityPerDay > 0;

  // Stat tiles match the reference: "$2320.0" one-decimal money format.
  const stats = [
    { label: 'Stock', value: String(product.stock), hint: product.stock <= product.reorderPoint ? 'At/below reorder point' : undefined },
    { label: 'Velocity', value: `${a.velocityPerDay.toFixed(1)}`, unit: '/Day' },
    { label: 'Cost', value: formatMoneyPlain(product.costMinor) },
    { label: 'Price', value: formatMoneyPlain(product.priceMinor) },
  ];

  const policy = [
    { label: 'Reorder Point', value: String(product.reorderPoint) },
    { label: 'Reorder Qty', value: String(product.reorderQty) },
    { label: 'Supplier', value: product.supplierName ?? '—' },
    { label: 'Lead Time (Days)', value: String(product.supplierLeadTimeDays ?? product.leadTimeDays) },
    { label: 'Location', value: product.location ?? '—' },
  ];

  return (
    <div className="flex flex-col gap-8">
      <div>
        <Link
          href="/products"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden />
          Back to Products
        </Link>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-bold tracking-tight">{product.name}</h1>
          <span className="font-mono text-sm text-muted-foreground">{product.sku}</span>
          <OrderStatusBadge status={product.status} />
          <span className="text-sm text-muted-foreground">{product.category}</span>
        </div>
      </div>

      {/* Stat tiles */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map((stat) => (
          <div key={stat.label} className="rounded-[32px] bg-white p-5 shadow-[0_1px_2px_rgba(0,0,0,0.05)]">
            <p className="text-sm font-medium text-muted-foreground">{stat.label}</p>
            <p className="mt-1 text-3xl font-extrabold tracking-tight">
              {stat.value}
              {stat.unit && <span className="ml-1 text-sm font-medium text-muted-foreground">{stat.unit}</span>}
            </p>
            {stat.hint && <p className="mt-1 text-xs font-medium text-destructive">{stat.hint}</p>}
          </div>
        ))}
      </div>

      {/* Description + policy */}
      <div className="grid gap-4 xl:grid-cols-2">
        <section aria-labelledby="description-heading" className="rounded-[32px] bg-white p-5 shadow-[0_1px_2px_rgba(0,0,0,0.05)]">
          <h2 id="description-heading" className="text-base font-semibold">
            Description
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-[#343434]">
            {product.description ?? 'No description recorded for this product.'}
          </p>
          <div className="mt-4 flex items-center gap-4 text-sm text-muted-foreground">
            <span>{product.supplierName ?? 'No supplier'}</span>
            <span>{product.location ?? 'No location'}</span>
          </div>
        </section>

        <section aria-labelledby="policy-heading" className="rounded-[32px] bg-white p-5 shadow-[0_1px_2px_rgba(0,0,0,0.05)]">
          <h2 id="policy-heading" className="text-base font-semibold">
            Replenishment Policy
          </h2>
          <dl className="mt-3 grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
            {policy.map((row) => (
              <div key={row.label} className="flex items-baseline justify-between gap-2 border-b border-black/5 pb-2">
                <dt className="text-muted-foreground">{row.label}</dt>
                <dd className="font-semibold">{row.value}</dd>
              </div>
            ))}
          </dl>
        </section>
      </div>

      {/* Charts */}
      <section aria-labelledby="stock-history-heading" className="rounded-[32px] bg-white p-5 shadow-[0_1px_2px_rgba(0,0,0,0.05)]">
        <h2 id="stock-history-heading" className="text-lg font-semibold">
          Stock Level History
        </h2>
        <div className="mt-3">
          <StockHistoryChart series={product.stockHistory} />
        </div>
      </section>

      <section aria-labelledby="forecast-heading" className="rounded-[32px] bg-white p-5 shadow-[0_1px_2px_rgba(0,0,0,0.05)]">
        <h2 id="forecast-heading" className="text-lg font-semibold">
          Demand Forecast (Next 30 Days)
        </h2>
        {hasForecast ? (
          <div className="mt-3">
            <DemandForecastChart series={a.forecast} />
          </div>
        ) : (
          <p className="mt-3 rounded-2xl bg-[#efefef] p-4 text-sm text-muted-foreground">
            No velocity data available — the forecast appears once this product starts selling.
          </p>
        )}
      </section>

      {/* Purchase orders — reference layout: status + qty · supplier + date links */}
      <section aria-labelledby="orders-heading" className="rounded-[32px] bg-white p-5 shadow-[0_1px_2px_rgba(0,0,0,0.05)]">
        <h2 id="orders-heading" className="text-lg font-semibold">
          Purchase Orders
        </h2>
        {product.purchaseOrders.length === 0 ? (
          <p className="mt-3 rounded-2xl bg-[#efefef] p-4 text-sm text-muted-foreground">No purchase orders</p>
        ) : (
          <ul className="mt-3 flex flex-col gap-2">
            {product.purchaseOrders.map((order) => (
              <li key={order.id}>
                <Link
                  href="/purchase-orders"
                  className="flex flex-wrap items-center gap-2 rounded-2xl bg-[#efefef] px-4 py-3 text-sm transition-colors hover:bg-secondary"
                >
                  <OrderStatusBadge status={order.status} />
                  <span className="font-semibold">{order.quantity} units</span>
                  <span className="text-muted-foreground">· {order.supplierName}</span>
                  <span className="ml-auto text-muted-foreground">
                    {order.orderDate.toISOString().slice(0, 10)}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
