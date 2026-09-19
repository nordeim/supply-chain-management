'use client';

import { useMemo } from 'react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts';
import type { InventoryValuePoint } from '@/domain/types';

/**
 * Inventory Value chart (last 90 days) — area line in brand orange with a
 * subtle gradient, dollar-formatted axis, and a date-scanned x-axis.
 */
export function InventoryValueChart({ series }: { series: InventoryValuePoint[] }) {
  const data = useMemo(
    () =>
      series.map((point) => ({
        date: point.date.slice(5).replace('-', '/'), // "MM/DD" axis labels
        fullDate: point.date,
        value: point.valueMinor / 100, // dollars for recharts
      })),
    [series],
  );

  return (
    <div className="h-[280px] w-full" role="img" aria-label="Inventory value over the last 90 days, in dollars">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 10, right: 16, bottom: 0, left: 0 }}>
          <defs>
            <linearGradient id="inventoryValueFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#f97316" stopOpacity={0.28} />
              <stop offset="100%" stopColor="#f97316" stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical />
          <XAxis
            dataKey="date"
            tick={{ fontSize: 12, fill: '#6b7280' }}
            tickLine={false}
            axisLine={{ stroke: '#e5e7eb' }}
            interval="preserveStartEnd"
            minTickGap={48}
          />
          <YAxis
            tick={{ fontSize: 12, fill: '#6b7280' }}
            tickLine={false}
            axisLine={false}
            width={56}
            tickFormatter={(v: number) => (v >= 1000 ? `$${Math.round(v / 1000)}k` : `$${v}`)}
          />
          <Tooltip
            formatter={(value: number | string) => [`$${Number(value).toLocaleString('en-US')}`, 'Inventory value']}
            labelFormatter={(_label, payload) => {
              const point = payload?.[0]?.payload as { fullDate?: string } | undefined;
              return point?.fullDate ?? '';
            }}
            contentStyle={{ borderRadius: 12, border: '1px solid #e5e7eb', fontSize: 13 }}
          />
          <Area
            type="monotone"
            dataKey="value"
            stroke="#f97316"
            strokeWidth={2}
            fill="url(#inventoryValueFill)"
            dot={false}
            activeDot={{ r: 4, fill: '#f97316' }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
