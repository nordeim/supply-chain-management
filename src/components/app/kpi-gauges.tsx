import {
  LOW_STOCK_SCALE_MAX,
  LOW_STOCK_SCALE_MIN,
  gaugeAngleFraction,
  lowStockTickIndex,
} from '@/domain/replenishment';

/**
 * Pending POS gauge — the reference card's semicircular dial, reproduced at
 * its exact geometry (measured live): a 1px #DFDFDF arc of radius 100
 * spanning 180°, seven tick dots (r 1.5) at radius 112 with opacity ramping
 * 0.20→0.90, and an orange (r 16) marker positioned on a radius-78 circle at
 * the value's angle. Labels 0 and 60 sit at the arc ends. Pure SVG — no
 * client JS needed.
 */
export function PendingPosGauge({ value, max = 60 }: { value: number; max?: number }) {
  const fraction = gaugeAngleFraction(value, max);
  // Arc: center (112,100), radius 100, from (12,100) to (212,100).
  const cx = 112;
  const cy = 100;
  const arcR = 100;
  const dotR = 112;
  const markerR = 78;

  const pointOn = (radius: number, degrees: number): { x: number; y: number } => {
    // degrees: 0 = arc's left end (180° in standard terms) … 1 = right end (0°).
    const angleRad = (Math.PI * (180 - degrees)) / 180;
    return { x: cx + radius * Math.cos(angleRad), y: cy - radius * Math.sin(angleRad) };
  };

  const markerAngle = fraction * 180;
  const marker = pointOn(markerR, markerAngle);
  const dots = Array.from({ length: 7 }, (_, i) => ({
    ...pointOn(dotR, i * 30),
    opacity: 0.2 + (0.7 * i) / 6,
  }));

  return (
    <figure className="w-full max-w-[291px]" aria-label={`Pending purchase orders: ${value} of a ${max} suggestion capacity`}>
      <svg viewBox="-8 -14 240 122" className="h-auto w-full" role="img" aria-hidden>
        <path
          d={`M ${cx - arcR} ${cy} A ${arcR} ${arcR} 0 0 1 ${cx + arcR} ${cy}`}
          fill="none"
          stroke="#DFDFDF"
          strokeWidth="1"
          strokeLinecap="round"
        />
        {dots.map((d, i) => (
          <circle key={i} cx={d.x} cy={d.y} r="1.5" fill={`rgba(52,52,52,${d.opacity.toFixed(2)})`} />
        ))}
        <circle cx={marker.x} cy={marker.y} r="16" fill="#FF9000" />
      </svg>
      <figcaption className="flex justify-between text-sm text-[#343434]">
        <span>0</span>
        <span>{max}</span>
      </figcaption>
    </figure>
  );
}

/**
 * Low-stock severity scale — the reference card's linear gauge, reproduced at
 * its exact geometry: twenty 1px tick marks (40px tall, black with opacity
 * ramping 0.15→0.50) laid out with justify-between, a 3px red marker inserted
 * right after the score's tick, a taller 56px end tick, and the -20 / -10 / 0
 * labels beneath.
 */
export function LowStockScale({ score }: { score: number }) {
  const tickCount = 20;
  const markerIndex = Math.min(tickCount - 1, Math.max(0, lowStockTickIndex(score, tickCount)));

  return (
    <div
      className="mt-auto w-full"
      aria-label={`Low stock severity score ${score}, scale ${LOW_STOCK_SCALE_MIN} to ${LOW_STOCK_SCALE_MAX}`}
    >
      <div className="flex h-[56px] items-end justify-between overflow-hidden">
        {Array.from({ length: tickCount }, (_, i) => {
          const opacity = 0.15 + (0.35 * i) / (tickCount - 1);
          const items = [
            <div key={`t${i}`} className="w-px bg-[#111111]" style={{ height: 40, opacity: opacity.toFixed(2) }} />,
          ];
          if (i === markerIndex) {
            items.push(<div key="marker" className="w-[3px] rounded-sm bg-destructive" style={{ height: 40 }} />);
          }
          return items;
        })}
        <div className="w-px bg-[#111111] opacity-50" style={{ height: 56 }} />
      </div>
      <div className="mt-1 flex justify-between text-sm text-[#343434]">
        <span>{LOW_STOCK_SCALE_MIN}</span>
        <span>{Math.round(LOW_STOCK_SCALE_MIN / 2)}</span>
        <span>{LOW_STOCK_SCALE_MAX}</span>
      </div>
    </div>
  );
}
