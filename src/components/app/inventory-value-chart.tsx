import type { InventoryValuePoint } from '@/domain/types';

const DOT_ORANGE = '#FF9000'; // first point (no comparison)
const DOT_RED = '#F13A15'; // value below the previous point
const DOT_GREEN = '#64E13C'; // value at/above the previous point

const VIEW_W = 376;
const VIEW_H = 312;
const PLOT_BOTTOM = 288; // y of the $0 baseline
const MARKER_Y = 310; // small marker dot row

/**
 * Inventory Value chart (last 90 days) — the reference app's custom dot plot:
 * thirteen weekly samples rendered as animated colored dots (orange = first
 * sample, red = below the previous sample, green = at/above it), each on a
 * faint vertical guide line with a small baseline marker beneath, and
 * dollar-formatted y-axis labels down the left side. Pure SVG, no client JS.
 */
export function InventoryValueChart({ series }: { series: InventoryValuePoint[] }) {
  // Sample 13 points across the 90-day window (weekly cadence, today last).
  const sampled = sampleSeries(series, 13);
  const max = Math.max(...sampled.map((p) => p.valueMinor), 1);
  const stepMinor = max > 25000000 ? 10000000 : 5000000; // $100k or $50k steps
  const top = Math.max(stepMinor, Math.ceil(max / stepMinor) * stepMinor); // round axis top
  const yFor = (valueMinor: number): number =>
    PLOT_BOTTOM - (valueMinor / top) * PLOT_BOTTOM;

  const stepX = sampled.length > 1 ? (VIEW_W - 16 * 2) / (sampled.length - 1) : 0;

  // Y labels: round dollar ticks from the axis top down to $0.
  const yLabels: string[] = [];
  for (let v = top; v >= 0; v -= stepMinor) yLabels.push(formatTick(v));

  return (
    <div className="mt-3 flex w-full items-stretch gap-2" role="img" aria-label="Inventory value over the last 90 days, in dollars">
      <div className="flex w-10 shrink-0 flex-col justify-between py-0 text-right text-xs text-muted-foreground">
        {yLabels.map((label) => (
          <span key={label}>{label}</span>
        ))}
      </div>
      <svg viewBox={`0 0 ${VIEW_W} ${VIEW_H}`} className="h-auto max-h-[312px] w-full min-w-0" aria-hidden>
        {sampled.map((point, i) => {
          const x = 16 + i * stepX;
          const y = yFor(point.valueMinor);
          const fill = i === 0 ? DOT_ORANGE : point.valueMinor < sampled[i - 1]!.valueMinor ? DOT_RED : DOT_GREEN;
          return (
            <g key={point.date}>
              <line x1={x} y1={0} x2={x} y2={PLOT_BOTTOM} stroke="#EFEFEF" strokeWidth={1} />
              <circle cx={x} cy={y} r={8} fill={fill}>
                <animate
                  attributeName="cy"
                  from={PLOT_BOTTOM}
                  to={y}
                  dur="0.6s"
                  begin="0s"
                  fill="freeze"
                  calcMode="spline"
                  keyTimes="0;1"
                  keySplines="0.0 0.0 0.2 1.0"
                />
              </circle>
              <circle cx={x} cy={MARKER_Y} r={2} fill="#343434" />
            </g>
          );
        })}
      </svg>
    </div>
  );
}

/** Evenly sample `count` points from the series (always keeps the last point). */
function sampleSeries(series: InventoryValuePoint[], count: number): InventoryValuePoint[] {
  if (series.length <= count) return series;
  const result: InventoryValuePoint[] = [];
  const stride = (series.length - 1) / (count - 1);
  for (let i = 0; i < count; i += 1) {
    result.push(series[Math.min(series.length - 1, Math.round(i * stride))]!);
  }
  return result;
}

function formatTick(valueMinor: number): string {
  const dollars = valueMinor / 100;
  if (dollars === 0) return '$0k';
  if (dollars >= 1000) return `$${Math.round(dollars / 1000)}k`;
  return `$${Math.round(dollars)}`;
}
