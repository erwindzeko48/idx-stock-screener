'use client';

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { PricePoint } from '@/types/stock';
import { format } from 'date-fns';
import { id } from 'date-fns/locale';

interface Props {
  data: PricePoint[];
  currentPrice: number;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function CustomTooltip({ active, payload, label }: any) {
  if (active && payload && payload.length) {
    const price = payload[0]?.value;
    return (
      <div
        className="glass-card p-3"
        style={{ border: '1px solid rgba(99, 120, 175, 0.3)', minWidth: 140 }}
      >
        <p style={{ color: 'var(--text-muted)', fontSize: 11 }}>
          {label}
        </p>
        <p className="mono font-semibold mt-0.5" style={{ color: 'var(--text-primary)', fontSize: 15 }}>
          Rp {price?.toLocaleString('id-ID')}
        </p>
      </div>
    );
  }
  return null;
}

export function PriceChart({ data, currentPrice }: Props) {
  if (!data || data.length === 0) {
    return (
      <div
        className="flex items-center justify-center h-48 rounded-xl"
        style={{ background: 'rgba(15, 23, 42, 0.5)', border: '1px solid var(--border)' }}
      >
        <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>Data chart tidak tersedia</p>
      </div>
    );
  }

  const firstPrice = data[0]?.close ?? currentPrice;
  const isPositive = currentPrice >= firstPrice;
  const strokeColor = isPositive ? '#22c55e' : '#ef4444';
  const fillStart = isPositive ? 'rgba(34, 197, 94, 0.25)' : 'rgba(239, 68, 68, 0.25)';
  const fillEnd = 'rgba(0,0,0,0)';

  const chartData = data.map((p) => ({
    date: (() => {
      try {
        return format(new Date(p.date), 'dd MMM', { locale: id });
      } catch {
        return p.date;
      }
    })(),
    close: p.close,
    volume: p.volume,
  }));

  // Show only every 4th label to avoid crowding
  const tickStep = Math.max(1, Math.floor(chartData.length / 8));

  const minClose = Math.min(...data.map((d) => d.close));
  const maxClose = Math.max(...data.map((d) => d.close));
  const padding = (maxClose - minClose) * 0.05;

  return (
    <ResponsiveContainer width="100%" height={280}>
      <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="priceGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor={fillStart} stopOpacity={1} />
            <stop offset="95%" stopColor={fillEnd} stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid
          strokeDasharray="3 3"
          stroke="rgba(99, 120, 175, 0.08)"
          vertical={false}
        />
        <XAxis
          dataKey="date"
          tick={{ fill: 'var(--text-muted)', fontSize: 11 }}
          tickLine={false}
          axisLine={false}
          interval={tickStep - 1}
        />
        <YAxis
          domain={[minClose - padding, maxClose + padding]}
          tick={{ fill: 'var(--text-muted)', fontSize: 11 }}
          tickLine={false}
          axisLine={false}
          tickFormatter={(v) => `${(v / 1000).toFixed(1)}k`}
          width={50}
        />
        <Tooltip
          content={<CustomTooltip />}
          cursor={{ stroke: 'rgba(99, 120, 175, 0.3)', strokeWidth: 1 }}
        />
        <Area
          type="monotone"
          dataKey="close"
          stroke={strokeColor}
          strokeWidth={2}
          fill="url(#priceGradient)"
          dot={false}
          activeDot={{ r: 4, fill: strokeColor, strokeWidth: 0 }}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
