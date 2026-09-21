import { getMarketTrends } from '@/server/queries';
import { cn } from '@/lib/utils';
import type { MarketTrendView } from '@/domain/types';

export const dynamic = 'force-dynamic';

/** Semicircle gauge cloned from the reference card: r100 #DFDFDF track,
 *  six 1.5px dots at r112 in 30° steps (opacity 0.20→0.90) and a 16px orange
 *  marker positioned at the score fraction of the sweep. */
function TrendGauge({ score, direction }: { score: number; direction: 'Up' | 'Down' | 'Stable' }) {
  const center = { x: 100, y: 100 };
  const markerRadius = 78;
  // Sweep measured from the left end of the semicircle (180° math angle).
  const sweepRad = (Math.min(100, Math.max(0, score)) / 100) * Math.PI;
  const angle = Math.PI - sweepRad;
  const marker = {
    x: center.x + markerRadius * Math.cos(angle),
    y: center.y - markerRadius * Math.sin(angle),
  };
  const dots = Array.from({ length: 6 }, (_, i) => {
    const dotAngle = Math.PI - (i * Math.PI) / 5;
    return {
      x: center.x + 112 * Math.cos(dotAngle),
      y: center.y - 112 * Math.sin(dotAngle),
      opacity: 0.2 + (0.7 * i) / 5,
    };
  });
  const markerFill = direction === 'Up' ? '#64E03C' : direction === 'Down' ? '#F24E2C' : '#FF9000';

  return (
    <svg
      viewBox="-16 -16 232 116"
      preserveAspectRatio="xMidYMax meet"
      className="block w-full overflow-visible"
      role="img"
      aria-label={`Trend score ${score} of 100, ${direction}`}
    >
      <path
        d="M 0 100 A 100 100 0 0 1 200 100"
        fill="none"
        stroke="#DFDFDF"
        strokeWidth="1"
        strokeLinecap="round"
      />
      {dots.map((d, i) => (
        <circle key={i} cx={d.x} cy={d.y} r="1.5" fill={`rgba(52,52,52,${d.opacity.toFixed(2)})`} />
      ))}
      <circle cx={marker.x} cy={marker.y} r="16" fill={markerFill} />
    </svg>
  );
}

function TrendCard({ trend }: { trend: MarketTrendView }) {
  const positive = trend.changePct > 0;
  const changeColor =
    trend.direction === 'Up' ? 'text-[#64E03C]' : trend.direction === 'Down' ? 'text-[#F24E2C]' : 'text-primary';
  return (
    <article className="rounded-[32px] bg-white p-5 shadow-[0_1px_2px_rgba(0,0,0,0.05)]">
      <div className="flex items-start justify-between gap-2">
        <h2 className="font-brand text-sm font-medium text-[#111111]">{trend.category}</h2>
        <span className={cn('font-numeric text-xl font-light', changeColor)}>
          {positive ? '+' : ''}
          {trend.changePct.toFixed(1)}%
        </span>
      </div>

      <div className="mt-2">
        <TrendGauge score={trend.trendScore} direction={trend.direction} />
        <div className="flex justify-between font-numeric text-sm font-light text-[#343434]">
          <span>0</span>
          <span>100</span>
        </div>
      </div>

      <div className="mt-3 flex items-center justify-between">
        <span
          aria-label={trend.direction}
          className={cn(
            'inline-block h-3 w-3 rounded-full',
            trend.direction === 'Up' ? 'bg-[#64E03C]' : trend.direction === 'Down' ? 'bg-[#F24E2C]' : 'bg-primary',
          )}
        />
        <span className="font-brand text-sm font-normal text-[#898989]">{trend.quarter}</span>
      </div>

      <p className="mt-2 font-brand text-sm font-normal leading-relaxed text-[#898989]">{trend.description}</p>
      <p className="mt-2 font-brand text-sm font-normal text-[#DFDFDF]">Source: {trend.source}</p>
    </article>
  );
}

/** Market Trends — summary tiles + the 3-column category signal cards. */
export default async function MarketTrendsPage() {
  const { trends, avgTrendScore, risingCount, decliningCount, topGainerPct } = await getMarketTrends();

  const summary = [
    { label: 'Avg Trend Score', value: String(avgTrendScore), dark: true, valueClass: 'text-primary' },
    { label: 'Rising Categories', value: String(risingCount), dark: false, valueClass: 'text-[#111111]' },
    { label: 'Declining', value: String(decliningCount), dark: false, valueClass: 'text-[#F24E2C]' },
    { label: 'Top Gainer', value: `+${topGainerPct.toFixed(1)}%`, dark: false, valueClass: 'text-[#64E03C]' },
  ];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-baseline gap-2.5 pl-2.5">
        <h1 className="font-brand text-sm font-medium text-[#111111]">Market Trends</h1>
        <p className="font-brand text-sm font-normal text-[#898989]">
          {trends.length} {trends.length === 1 ? 'category' : 'categories'} · {trends[0]?.quarter ?? 'current quarter'}
        </p>
      </div>

      <div className="mx-4 grid h-[137px] grid-cols-2 gap-x-9 gap-y-4 xl:grid-cols-4">
        {summary.map((item) => (
          <div
            key={item.label}
            className={cn(
              'flex flex-col rounded-[32px] p-4 pb-5 shadow-[0_1px_2px_rgba(0,0,0,0.05)]',
              item.dark ? 'bg-[#111111]' : 'bg-white',
            )}
          >
            <p className={cn('font-brand text-sm font-normal', item.dark ? 'text-white' : 'text-[#111111]')}>
              {item.label}
            </p>
            <p className={cn('mt-auto font-numeric text-5xl font-light', item.valueClass)}>{item.value}</p>
          </div>
        ))}
      </div>

      {trends.length === 0 ? (
        <p className="rounded-[32px] bg-white p-6 font-brand text-sm text-muted-foreground shadow-[0_1px_2px_rgba(0,0,0,0.05)]">
          No market trend data available yet.
        </p>
      ) : (
        <div className="grid gap-1 md:grid-cols-2 xl:grid-cols-3">
          {trends.map((trend) => (
            <TrendCard key={trend.id} trend={trend} />
          ))}
        </div>
      )}
    </div>
  );
}
