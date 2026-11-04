import type { ReactNode } from 'react';
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';

// Paleta: verde = marca; azul e âmbar distinguem séries sem depender só da cor (legenda + tooltip).
export const C = { green: '#22c55e', greenSoft: '#86efac', blue: '#60a5fa', amber: '#fbbf24', grid: 'rgba(255,255,255,0.06)', axis: '#8b958e' };

const axisProps = { stroke: C.axis, tick: { fill: C.axis, fontSize: 11 }, tickLine: false, axisLine: false } as const;

function TooltipBox({ active, payload, label, unit }: { active?: boolean; payload?: { name?: string; value?: number | string; color?: string }[]; label?: string; unit?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-white/10 bg-ink-800/95 px-3 py-2 text-xs shadow-xl backdrop-blur">
      <div className="mb-1 font-semibold text-zinc-200">{label}</div>
      {payload.map((p, i) => (
        <div key={i} className="flex items-center gap-2 text-zinc-300">
          <span className="h-2 w-2 rounded-full" style={{ background: p.color }} />
          {p.name}: <b className="text-zinc-100">{typeof p.value === 'number' ? p.value.toLocaleString('pt-BR') : p.value}{unit ? ` ${unit}` : ''}</b>
        </div>
      ))}
    </div>
  );
}

export function ChartFrame({ height = 190, children }: { height?: number; children: ReactNode }) {
  return <div style={{ width: '100%', height }} role="img">{<ResponsiveContainer width="100%" height="100%">{children as never}</ResponsiveContainer>}</div>;
}

export function BarsChart({
  data, series, unit, goal, height, stacked = true, xKey = 'label', integer,
}: {
  data: Record<string, string | number | null>[]; series: { key: string; name: string; color: string }[]; unit?: string;
  goal?: number; height?: number; stacked?: boolean; xKey?: string; integer?: boolean;
}) {
  return (
    <ChartFrame height={height}>
      <BarChart data={data} margin={{ top: 8, right: 4, left: -18, bottom: 0 }}>
        <CartesianGrid vertical={false} stroke={C.grid} />
        <XAxis dataKey={xKey} {...axisProps} interval="preserveStartEnd" minTickGap={14} />
        <YAxis {...axisProps} allowDecimals={!integer} />
        <Tooltip cursor={{ fill: 'rgba(255,255,255,0.04)' }} content={<TooltipBox unit={unit} />} />
        {series.length > 1 && <Legend iconType="circle" wrapperStyle={{ fontSize: 11, color: C.axis }} />}
        {goal ? <ReferenceLine y={goal} stroke={C.amber} strokeDasharray="4 4" label={{ value: 'meta', fill: C.amber, fontSize: 10, position: 'insideTopRight' }} /> : null}
        {series.map((s, i) => (
          <Bar key={s.key} dataKey={s.key} name={s.name} fill={s.color} stackId={stacked ? 'a' : undefined}
            radius={stacked ? (i === series.length - 1 ? [5, 5, 0, 0] : 0) : [5, 5, 0, 0]} maxBarSize={28} />
        ))}
      </BarChart>
    </ChartFrame>
  );
}

export function LinesChart({
  data, series, unit, height, xKey = 'label', domain,
}: {
  data: Record<string, string | number | null>[]; series: { key: string; name: string; color: string }[]; unit?: string; height?: number; xKey?: string;
  domain?: [number | string, number | string];
}) {
  return (
    <ChartFrame height={height}>
      <LineChart data={data} margin={{ top: 8, right: 8, left: -14, bottom: 0 }}>
        <CartesianGrid vertical={false} stroke={C.grid} />
        <XAxis dataKey={xKey} {...axisProps} interval="preserveStartEnd" minTickGap={18} />
        <YAxis {...axisProps} domain={domain ?? ['auto', 'auto']} />
        <Tooltip content={<TooltipBox unit={unit} />} />
        {series.length > 1 && <Legend iconType="circle" wrapperStyle={{ fontSize: 11, color: C.axis }} />}
        {series.map((s) => (
          <Line key={s.key} type="monotone" dataKey={s.key} name={s.name} stroke={s.color} strokeWidth={2.4} connectNulls
            dot={{ r: data.length > 24 ? 0 : 3, fill: s.color, strokeWidth: 0 }} activeDot={{ r: 5 }} />
        ))}
      </LineChart>
    </ChartFrame>
  );
}

export function AreaChartSimple({ data, dataKey, name, unit, height, color = C.green, tight }: {
  data: Record<string, string | number | null>[]; dataKey: string; name: string; unit?: string; height?: number; color?: string;
  /** true = escala ajustada aos valores (peso, medidas); false = começa no zero (acumulados). */
  tight?: boolean;
}) {
  const id = `g-${dataKey}`;
  return (
    <ChartFrame height={height}>
      <AreaChart data={data} margin={{ top: 8, right: 8, left: -14, bottom: 0 }}>
        <defs>
          <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor={color} stopOpacity={0.35} />
            <stop offset="1" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid vertical={false} stroke={C.grid} />
        <XAxis dataKey="label" {...axisProps} interval="preserveStartEnd" minTickGap={18} />
        <YAxis {...axisProps} domain={tight ? [(min: number) => Math.floor(min - 1), (max: number) => Math.ceil(max + 1)] : [0, 'auto']} />
        <Tooltip content={<TooltipBox unit={unit} />} />
        <Area type="monotone" dataKey={dataKey} name={name} stroke={color} strokeWidth={2.4} fill={`url(#${id})`} />
      </AreaChart>
    </ChartFrame>
  );
}
