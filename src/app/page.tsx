import { getDashboardData } from '@/server/queries';
import { formatMoneyWhole } from '@/domain/money';
import { KpiCard } from '@/components/app/kpi-card';
import { InventoryValueChart } from '@/components/app/inventory-value-chart';
import { PendingPosGauge, LowStockScale } from '@/components/app/kpi-gauges';
import { StockFeed } from '@/components/app/stock-feed';
import Link from 'next/link';
import { Maximize2 } from 'lucide-react';

export const dynamic = 'force-dynamic';

/**
 * Dashboard — the Inventory Manager control room, composed in the reference
 * app's exact layout: an asymmetric KPI grid (stacked black + orange cards on
 * the left, two tall gauge cards to the right), two white 32px-radius chart
 * cards, and the stock-feed grid. All numbers are derived by the domain
 * engine from the movement ledger.
 */
export default async function DashboardPage() {
  const data = await getDashboardData();
  const hasMovers = data.topMovers.length > 0;

  return (
    <div className="flex flex-col gap-4">
      {/* KPI grid — reference geometry: at lg the stacked black+orange column
          (331fr) plus the two tall gauge cards sharing the remaining width;
          below lg the reference stacks [Total SKUs | Inventory Value] as a
          row, with the two gauge cards full-width (side-by-side from sm). */}
      <div className="flex flex-col gap-4 lg:grid lg:grid-cols-[minmax(280px,331fr)_1fr]">
        <div className="flex flex-row gap-4 lg:flex-col">
          <KpiCard
            href="/products"
            variant="black"
            label="Total SKUs"
            value={String(data.totalSkus)}
            subtext="Active products"
            dotClassName="bg-white"
            className="min-h-[192px] flex-1"
          />
          <KpiCard
            variant="orange"
            label="Inventory Value"
            value={formatMoneyWhole(data.inventoryValueMinor)}
            subtext="Across active stock"
            dotClassName="bg-white"
            className="min-h-[192px] flex-1"
          />
        </div>

        <div className="flex flex-col gap-4 sm:flex-row">
          <KpiCard
            href="/products?status=low"
            variant="white"
            label="Low Stock Alerts"
            value={String(data.lowStockScore)}
            subtext="Action needed"
            dotClassName="bg-destructive"
            className="flex min-h-[400px] flex-1 flex-col"
          >
            <LowStockScale score={data.lowStockScore} />
          </KpiCard>

          <KpiCard
            href="/ai-suggestions"
            variant="white"
            label="Pending POS"
            value={String(data.pendingSuggestions)}
            subtext="POS awaiting approval"
            dotClassName="bg-primary"
            className="flex min-h-[400px] flex-1 flex-col"
          >
            <div className="mt-auto">
              <PendingPosGauge value={data.pendingSuggestions} />
            </div>
          </KpiCard>
        </div>
      </div>

      {/* Charts row — two white 32px-radius cards */}
      <div className="grid gap-4 xl:grid-cols-2">
        <section aria-labelledby="inventory-value-heading" className="min-w-0 rounded-[32px] bg-white p-6">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2.5">
              <span className="h-4 w-4 shrink-0 rounded-full bg-primary" aria-hidden />
              <h2 id="inventory-value-heading" className="text-lg font-semibold">
                Inventory Value (Last 90 Days)
              </h2>
            </div>
            <button
              type="button"
              aria-label="Expand chart"
              className="flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-secondary"
            >
              <Maximize2 className="h-5 w-5" aria-hidden />
            </button>
          </div>
          <div className="mt-3">
            <InventoryValueChart series={data.inventoryValueSeries} />
          </div>
        </section>

        <section aria-labelledby="top-movers-heading" className="min-w-0 rounded-[32px] bg-white p-6">
          <div className="flex items-center gap-2.5">
            <span className="h-4 w-4 shrink-0 rounded-full bg-primary" aria-hidden />
            <h2 id="top-movers-heading" className="text-lg font-semibold">
              Top 5 Fastest-Moving Products
            </h2>
          </div>
          {hasMovers ? (
            <ul className="mt-4 flex max-h-[280px] flex-col gap-2 overflow-y-auto pr-1">
              {data.topMovers.map((mover) => {
                const delta = mover.salesDelta30d;
                const deltaTone =
                  delta > 0
                    ? 'bg-success/15 text-[#15803d]'
                    : delta < 0
                      ? 'bg-destructive/10 text-destructive'
                      : 'bg-secondary text-[#343434]';
                return (
                  <li key={mover.id}>
                    <Link
                      href={`/products/${mover.id}`}
                      className="flex items-center justify-between gap-4 rounded-2xl bg-[#efefef] px-4 py-3 transition-colors hover:bg-secondary"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-[15px] font-semibold">{mover.name}</p>
                        <p className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
                          {mover.totalSales} total sales
                          <span
                            className={`inline-flex min-w-7 items-center justify-center rounded-md px-1.5 py-0.5 text-xs font-bold ${deltaTone}`}
                            aria-label={`Sales delta: ${delta > 0 ? '+' : ''}${delta} units in the last 30 days`}
                          >
                            {delta > 0 ? '+' : ''}
                            {delta}
                          </span>
                        </p>
                      </div>
                      <p className="text-xl font-bold tabular-nums">{mover.velocityPerDay.toFixed(1)}</p>
                    </Link>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="mt-4 rounded-2xl bg-[#efefef] p-4 text-sm text-muted-foreground">
              No sales velocity recorded yet — the movers list fills as stock moves.
            </p>
          )}
        </section>
      </div>

      {/* Stock feed */}
      <StockFeed items={data.stockFeed} />
    </div>
  );
}
