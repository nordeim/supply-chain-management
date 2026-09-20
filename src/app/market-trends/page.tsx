import { ArrowDownRight, ArrowUpRight, Minus } from 'lucide-react';
import { getMarketTrends } from '@/server/queries';
import { cn } from '@/lib/utils';

export const dynamic = 'force-dynamic';

/** Market Trends — category demand signals with score gauges and sources. */
export default async function MarketTrendsPage() {
  const { trends, avgTrendScore, risingCount, decliningCount, topGainerPct } = await getMarketTrends();

  const summary = [
    { label: 'Avg Trend Score', value: String(avgTrendScore) },
    { label: 'Rising Categories', value: String(risingCount) },
    { label: 'Declining', value: String(decliningCount) },
    { label: 'Top Gainer', value: `+${topGainerPct.toFixed(1)}%` },
  ];

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Market Trends</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {trends.length} {trends.length === 1 ? 'category' : 'categories'} · {trends[0]?.quarter ?? 'current quarter'}
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {summary.map((item) => (
          <div key={item.label} className="rounded-[32px] bg-white p-5 shadow-[0_1px_2px_rgba(0,0,0,0.05)]">
            <p className="text-sm font-medium text-muted-foreground">{item.label}</p>
            <p
              className={cn(
                'mt-1 text-3xl font-extrabold tracking-tight',
                item.label === 'Top Gainer' && 'text-success',
              )}
            >
              {item.value}
            </p>
          </div>
        ))}
      </div>

      {trends.length === 0 ? (
        <p className="rounded-[32px] bg-white p-6 shadow-[0_1px_2px_rgba(0,0,0,0.05)] text-sm text-muted-foreground">
          No market trend data available yet.
        </p>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {trends.map((trend) => {
            const positive = trend.changePct > 0;
            const TrendIcon = trend.direction === 'Up' ? ArrowUpRight : trend.direction === 'Down' ? ArrowDownRight : Minus;
            const iconTone =
              trend.direction === 'Up' ? 'text-success' : trend.direction === 'Down' ? 'text-destructive' : 'text-muted-foreground';
            return (
              <article key={trend.id} className="rounded-[32px] bg-white p-5 shadow-[0_1px_2px_rgba(0,0,0,0.05)]">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h2 className="text-lg font-bold">{trend.category}</h2>
                  <span
                    className={cn(
                      'inline-flex items-center gap-1 text-base font-bold',
                      positive ? 'text-success' : trend.changePct < 0 ? 'text-destructive' : 'text-muted-foreground',
                    )}
                  >
                    {positive ? '+' : ''}
                    {trend.changePct.toFixed(1)}%
                    <TrendIcon className={cn('h-4 w-4', iconTone)} aria-hidden />
                  </span>
                </div>

                {/* Trend score gauge (0-100) */}
                <div className="mt-4" role="img" aria-label={`Trend score ${trend.trendScore} of 100, ${trend.direction}`}>
                  <div className="relative h-2 rounded-full bg-black/10">
                    <div
                      className={cn(
                        'h-2 rounded-full',
                        trend.direction === 'Up' ? 'bg-success' : trend.direction === 'Down' ? 'bg-destructive' : 'bg-[#9ca3af]',
                      )}
                      style={{ width: `${trend.trendScore}%` }}
                    />
                  </div>
                  <div className="mt-1.5 flex justify-between text-[11px] text-muted-foreground">
                    <span>0</span>
                    <span>{trend.trendScore}</span>
                    <span>100</span>
                  </div>
                  <p className="mt-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    {trend.direction} · {trend.quarter}
                  </p>
                </div>

                <p className="mt-3 text-sm leading-relaxed text-[#374151]">{trend.description}</p>
                <p className="mt-3 text-xs text-muted-foreground">
                  Source: <span className="font-medium text-foreground">{trend.source}</span>
                </p>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
