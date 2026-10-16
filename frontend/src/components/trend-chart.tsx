import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from 'recharts';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart';

export interface TrendPoint {
  date: string;
  count: number;
}

// "2026-10-09" -> "09 Oct" (parsed as a local date so western zones don't show the day before).
export function shortDate(iso: string): string {
  const d = new Date(`${iso}T00:00:00`);
  return Number.isNaN(d.getTime())
    ? iso
    : d.toLocaleDateString(undefined, { day: '2-digit', month: 'short' });
}

// An area chart of {date, count} rows with an optional dashed comparison series. Colors come
// from the theme tokens, so it follows light/dark.
export function TrendChart({
  rows,
  comparison,
  label,
  comparisonLabel,
}: {
  rows: TrendPoint[] | null | undefined;
  comparison?: TrendPoint[] | null;
  label: string;
  comparisonLabel?: string;
}) {
  const other = new Map((comparison ?? []).map((p) => [p.date, p.count]));
  const data = (rows ?? []).map((p) => ({
    date: p.date,
    primary: p.count,
    ...(comparison ? { secondary: other.get(p.date) ?? 0 } : {}),
  }));

  const config: ChartConfig = {
    primary: { label, color: 'var(--primary)' },
    ...(comparison
      ? { secondary: { label: comparisonLabel ?? '', color: 'var(--danger-foreground)' } }
      : {}),
  };

  return (
    <ChartContainer config={config} className="h-56 w-full" aria-label={label}>
      <AreaChart data={data} margin={{ left: 0, right: 8, top: 8 }}>
        <CartesianGrid vertical={false} />
        <XAxis
          dataKey="date"
          tickLine={false}
          axisLine={false}
          tickMargin={8}
          tickFormatter={shortDate}
          minTickGap={24}
        />
        <YAxis tickLine={false} axisLine={false} width={32} allowDecimals={false} />
        <ChartTooltip
          content={<ChartTooltipContent labelFormatter={(v) => shortDate(String(v))} />}
        />
        <Area
          dataKey="primary"
          type="monotone"
          stroke="var(--color-primary)"
          fill="var(--color-primary)"
          fillOpacity={0.12}
          strokeWidth={2}
        />
        {comparison ? (
          <Area
            dataKey="secondary"
            type="monotone"
            stroke="var(--color-secondary)"
            fill="none"
            strokeWidth={2}
            strokeDasharray="6 4"
          />
        ) : null}
      </AreaChart>
    </ChartContainer>
  );
}
