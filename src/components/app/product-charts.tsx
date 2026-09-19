'use client';

import { useMemo } from 'react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  AreaChart,
  Area,
} from 'recharts';
import type { ForecastPoint, StockHistoryPoint } from '@/domain/types';

function monthTick(iso: string): string {
  const [, mm, dd] = iso.split('-');
  return `${mm}.${dd}`;
}

/** Stock Level History — replayed ledger stock per day (product detail). */
export function StockHistoryChart({ series }: { series: StockHistoryPoint[] }) {
  const data = useMemo(
    () =>
      series.map((p) => ({
        date: monthTick(p.date),
        fullDate: p.date,
        stock: p.stock,
      })),
    [series],
  );

  return (
    <div className="h-[240px] w-full" role="img" aria-label="Stock level history, units in stock per day">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
          <XAxis
            dataKey="date"
            tick={{ fontSize: 11, fill: '#6b7280' }}
            tickLine={false}
            axisLine={{ stroke: '#e5e7eb' }}
            interval="preserveStartEnd"
            minTickGap={56}
          />
          <YAxis tick={{ fontSize: 11, fill: '#6b7280' }} tickLine={false} axisLine={false} width={36} allowDecimals={false} />
          <Tooltip
            formatter={(value: number | string) => [`${value} units`, 'Stock']}
            labelFormatter={(_label, payload) => (payload?.[0]?.payload as { fullDate?: string })?.fullDate ?? ''}
            contentStyle={{ borderRadius: 12, border: '1px solid #e5e7eb', fontSize: 13 }}
          />
          <Line type="stepAfter" dataKey="stock" stroke="#111827" strokeWidth={2} dot={false} activeDot={{ r: 3 }} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Demand Forecast — cumulative next-30-day projection with a ±25% band. */
export function DemandForecastChart({ series }: { series: ForecastPoint[] }) {
  const data = useMemo(
    () =>
      series.map((p) => ({
        date: monthTick(p.date),
        fullDate: p.date,
        demand: p.demand,
        band: [p.lower, p.upper] as [number, number],
      })),
    [series],
  );

  return (
    <div className="h-[240px] w-full" role="img" aria-label="Cumulative demand forecast for the next 30 days">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
          <defs>
            <linearGradient id="forecastFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#f97316" stopOpacity={0.3} />
              <stop offset="100%" stopColor="#f97316" stopOpacity={0.03} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
          <XAxis
            dataKey="date"
            tick={{ fontSize: 11, fill: '#6b7280' }}
            tickLine={false}
            axisLine={{ stroke: '#e5e7eb' }}
            interval="preserveStartEnd"
            minTickGap={56}
          />
          <YAxis tick={{ fontSize: 11, fill: '#6b7280' }} tickLine={false} axisLine={false} width={36} allowDecimals={false} />
          <Tooltip
            formatter={(value: number | string | Array<number>, name) => {
              if (name === 'band') {
                const band = value as Array<number>;
                return [`${band[0]} – ${band[1]} units`, 'Range'];
              }
              return [`${value} units`, 'Forecast'];
            }}
            labelFormatter={(_label, payload) => (payload?.[0]?.payload as { fullDate?: string })?.fullDate ?? ''}
            contentStyle={{ borderRadius: 12, border: '1px solid #e5e7eb', fontSize: 13 }}
          />
          <Area dataKey="band" stroke="none" fill="#f97316" fillOpacity={0.12} name="band" activeDot={false} />
          <Area
            type="monotone"
            dataKey="demand"
            stroke="#f97316"
            strokeWidth={2}
            fill="url(#forecastFill)"
            dot={false}
            activeDot={{ r: 3, fill: '#f97316' }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
