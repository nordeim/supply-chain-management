import { AlertTriangle, CircleDollarSign, Boxes, ClipboardList } from 'lucide-react';
import { getDashboardData } from '@/server/queries';
import { formatMoneyWhole } from '@/domain/money';
import { KpiCard } from '@/components/app/kpi-card';
import { InventoryValueChart } from '@/components/app/inventory-value-chart';
import { PendingPosGauge, LowStockBar } from '@/components/app/kpi-gauges';
import { StockFeed } from '@/components/app/stock-feed';
import Link from 'next/link';
import { CalendarDays } from 'lucide-react';

export const dynamic = 'force-dynamic';

/**
 * Dashboard — the Inventory Manager control room: KPI tiles, 90-day
 * inventory value trend, fastest movers, and the replenishment stock feed.
 * All numbers are derived by the domain engine from the movement ledger.
 */
export default async function DashboardPage() {
  const data = await getDashboardData();
  const hasMovers = data.topMovers.length > 0;

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Inventory Manager</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Live stock intelligence, AI replenishment suggestions, and procurement status.
        </p>
      </div>

      {/* KPI row */}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          href="/products"
          variant="black"
          label="Total SKUs"
          value={String(data.totalSkus)}
          subtext="Active products"
          icon={<span className="h-2.5 w-2.5 rounded-full bg-primary" aria-hidden />}
        />
        <KpiCard
          href="/products?filter=low"
          variant="white"
          label="Low Stock Alerts"
          value={String(data.lowStockScore)}
          subtext="Action needed"
          icon={<span className="h-2.5 w-2.5 rounded-full bg-destructive" aria-hidden />}
        >
          <LowStockBar score={data.lowStockScore} />
        </KpiCard>
        <KpiCard
          href="/purchase-orders?status=Suggested"
          variant="white"
          label="Pending POS"
          value={String(data.pendingSuggestions)}
          subtext="POS awaiting approval"
          icon={<ClipboardList className="h-4 w-4 text-primary" aria-hidden />}
        >
          <div className="mt-3 flex justify-end">
            <PendingPosGauge value={data.pendingSuggestions} />
          </div>
        </KpiCard>
        <KpiCard
          href="/products"
          variant="orange"
          label="Inventory Value"
          value={formatMoneyWhole(data.inventoryValueMinor)}
          subtext="Across active stock"
          icon={<CircleDollarSign className="h-4 w-4" aria-hidden />}
        />
      </div>

      {/* Charts row */}
      <div className="grid gap-4 xl:grid-cols-2">
        <section
          aria-labelledby="inventory-value-heading"
          className="rounded-2xl bg-[#f3f4f6] p-5"
        >
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-primary" aria-hidden />
              <h2 id="inventory-value-heading" className="text-lg font-semibold">
                Inventory Value (Last 90 Days)
              </h2>
            </div>
            <CalendarDays className="h-4 w-4 text-muted-foreground" aria-hidden />
          </div>
          <div className="mt-3">
            <InventoryValueChart series={data.inventoryValueSeries} />
          </div>
        </section>

        <section aria-labelledby="top-movers-heading" className="rounded-2xl bg-[#f3f4f6] p-5">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-primary" aria-hidden />
            <h2 id="top-movers-heading" className="text-lg font-semibold">
              Top 5 Fastest-Moving Products
            </h2>
          </div>
          {hasMovers ? (
            <ul className="mt-4 flex max-h-[280px] flex-col gap-2 overflow-y-auto pr-1">
              {data.topMovers.map((mover) => {
                const delta = mover.velocityDelta;
                const deltaTone =
                  delta > 0 ? 'text-success' : delta < 0 ? 'text-destructive' : 'text-muted-foreground';
                return (
                  <li key={mover.id}>
                    <Link
                      href={`/products/${mover.id}`}
                      className="flex items-center justify-between gap-4 rounded-2xl bg-white px-4 py-3 transition-colors hover:bg-white/70"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-[15px] font-semibold">{mover.name}</p>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          {mover.totalSales} total sales
                          {delta !== 0 && (
                            <span className={`ml-2 font-semibold ${deltaTone}`}>
                              {delta > 0 ? '+' : ''}
                              {delta}/day vs prior 30d
                            </span>
                          )}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-2xl font-extrabold">{mover.velocityPerDay.toFixed(1)}</p>
                        <p className="text-[11px] text-muted-foreground">units/day</p>
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="mt-4 rounded-2xl bg-white p-4 text-sm text-muted-foreground">
              No sales velocity recorded yet — the movers list fills as stock moves.
            </p>
          )}
        </section>
      </div>

      {/* Stock feed */}
      <StockFeed items={data.stockFeed} />

      {/* Low stock explainer */}
      {data.lowStockScore < 0 && (
        <p className="flex items-start gap-2 text-sm text-muted-foreground">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" aria-hidden />
          The Low Stock Alerts score is the deepest reorder-point shortfall in the catalog, measured in
          reorder-point decades. A score of {data.lowStockScore} means at least one SKU is{' '}
          {Math.abs(data.lowStockScore) * 10}+ units below its reorder point.
        </p>
      )}
    </div>
  );
}
