/**
 * Pending POS gauge — a semicircular speedometer (0..60 scale) with an
 * orange marker, cloned from the reference KPI card. Pure SVG so it stays
 * crisp and needs no client JS.
 */
export function PendingPosGauge({ value, max = 60 }: { value: number; max?: number }) {
  const clamped = Math.max(0, Math.min(value, max));
  const angle = (clamped / max) * 180 - 90; // -90° (0) .. +90° (max)
  const radius = 54;
  const cx = 64;
  const cy = 60;

  // Marker position on the arc.
  const rad = (angle * Math.PI) / 180;
  const markerX = cx + radius * Math.sin(rad);
  const markerY = cy - radius * Math.cos(rad);

  const ticks = [0, 15, 30, 45, 60];

  return (
    <svg
      viewBox="0 0 128 68"
      className="h-[68px] w-[128px]"
      role="img"
      aria-label={`Pending purchase orders: ${value} of a ${max} suggestion capacity`}
    >
      {/* Track */}
      <path
        d={`M ${cx - radius} ${cy} A ${radius} ${radius} 0 0 1 ${cx + radius} ${cy}`}
        fill="none"
        stroke="#e5e7eb"
        strokeWidth={8}
        strokeLinecap="round"
      />
      {/* Progress arc */}
      <path
        d={`M ${cx - radius} ${cy} A ${radius} ${radius} 0 0 1 ${markerX} ${markerY}`}
        fill="none"
        stroke="#f97316"
        strokeWidth={8}
        strokeLinecap="round"
      />
      {/* Marker dot */}
      <circle cx={markerX} cy={markerY} r={7} fill="#f97316" stroke="#ffffff" strokeWidth={2} />
      {/* Scale labels */}
      {ticks.map((t) => {
        const a = ((t / max) * 180 - 90) * (Math.PI / 180);
        const x = cx + (radius - 18) * Math.sin(a);
        const y = cy - (radius - 18) * Math.cos(a);
        return (
          <text key={t} x={x} y={y} textAnchor="middle" dominantBaseline="middle" fontSize={9} fill="#9ca3af">
            {t}
          </text>
        );
      })}
    </svg>
  );
}

/**
 * Low-stock severity bar — horizontal scale from -20 to 0 with a red
 * indicator at the current score (the deepest reorder-point shortfall).
 */
export function LowStockBar({ score, min = -20 }: { score: number; min?: -20 }) {
  const clamped = Math.max(min, Math.min(0, score));
  const percentFromLeft = ((clamped - min) / (0 - min)) * 100;
  const labels = [min, Math.round(min / 2), 0];

  return (
    <div className="mt-4" aria-label={`Low stock severity score ${clamped}, scale ${min} to 0`}>
      <div className="relative h-2 rounded-full bg-[#e5e7eb]">
        <div
          className="absolute top-1/2 h-4 w-1 -translate-y-1/2 rounded-full bg-destructive"
          style={{ left: `calc(${percentFromLeft}% - 2px)` }}
        />
      </div>
      <div className="mt-1.5 flex justify-between text-[11px] text-muted-foreground">
        {labels.map((l) => (
          <span key={l}>{l}</span>
        ))}
      </div>
    </div>
  );
}
