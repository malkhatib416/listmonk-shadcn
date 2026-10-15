import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  XAxis,
  YAxis,
} from 'recharts';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart';
import {
  chartRows,
  groupCounts,
  linkLabel,
  toLabel,
  type AnalyticsItem,
  type CountRow,
  type LinkRow,
} from '@/lib/analytics';

export const seriesColor = (i: number) => `var(--chart-${(i % 8) + 1})`;

// One line per item (and a dashed line per item for `extra`, e.g. unsubscriptions).
export function SeriesChart({
  items,
  rows,
  idKey,
  extra,
  extraLabel,
  label,
}: {
  items: AnalyticsItem[];
  rows: CountRow[] | null;
  idKey: 'campaign_id' | 'list_id';
  extra?: CountRow[] | null;
  extraLabel?: string;
  label: string;
}) {
  const main = chartRows(rows, idKey, 's');
  const second = extra ? chartRows(extra, idKey, 'u') : [];
  const byTs = new Map<string, Record<string, number | string>>();
  for (const r of [...main, ...second])
    byTs.set(String(r.ts), { ...(byTs.get(String(r.ts)) ?? {}), ...r });
  const data = [...byTs.values()].sort((a, b) => String(a.ts).localeCompare(String(b.ts)));

  const config: ChartConfig = {};
  items.forEach((it, i) => {
    config[`s${it.id}`] = { label: `#${it.id}: ${it.name}`, color: seriesColor(i) };
    if (extra)
      config[`u${it.id}`] = {
        label: `#${it.id}: ${it.name}: ${extraLabel}`,
        color: seriesColor(i),
      };
  });

  return (
    <ChartContainer config={config} className="h-64 w-full" aria-label={label}>
      <LineChart data={data} margin={{ left: 0, right: 8, top: 8 }}>
        <CartesianGrid vertical={false} />
        <XAxis
          dataKey="ts"
          tickLine={false}
          axisLine={false}
          tickMargin={8}
          tickFormatter={toLabel}
          minTickGap={32}
        />
        <YAxis tickLine={false} axisLine={false} width={32} allowDecimals={false} />
        <ChartTooltip
          content={<ChartTooltipContent labelFormatter={(v) => toLabel(String(v))} />}
        />
        {items.map((it) => (
          <Line
            key={`s${it.id}`}
            dataKey={`s${it.id}`}
            type="monotone"
            stroke={`var(--color-s${it.id})`}
            strokeWidth={2}
            dot={false}
          />
        ))}
        {extra
          ? items.map((it) => (
              <Line
                key={`u${it.id}`}
                dataKey={`u${it.id}`}
                type="monotone"
                stroke={`var(--color-u${it.id})`}
                strokeWidth={2}
                strokeDasharray="6 4"
                dot={false}
              />
            ))
          : null}
      </LineChart>
    </ChartContainer>
  );
}

// Share of the total per item.
export function Donut({
  items,
  rows,
  idKey,
}: {
  items: AnalyticsItem[];
  rows: CountRow[] | null;
  idKey: 'campaign_id' | 'list_id';
}) {
  const groups = groupCounts(rows, idKey);
  const data = items.map((it, i) => ({
    id: `s${it.id}`,
    name: `#${it.id}: ${it.name}`,
    value: groups.get(it.id)?.total ?? 0,
    fill: seriesColor(i),
  }));
  const config: ChartConfig = Object.fromEntries(
    data.map((d) => [d.id, { label: d.name, color: d.fill }]),
  );
  return (
    <ChartContainer config={config} className="mx-auto aspect-square h-52">
      <PieChart>
        <ChartTooltip content={<ChartTooltipContent nameKey="id" hideLabel />} />
        <Pie data={data} dataKey="value" nameKey="id" innerRadius="70%" strokeWidth={4}>
          {data.map((d) => (
            <Cell key={d.id} fill={d.fill} />
          ))}
        </Pie>
      </PieChart>
    </ChartContainer>
  );
}

// Clicks per link, horizontal bars.
export function LinksChart({ rows }: { rows: LinkRow[] }) {
  const data = rows.map((r) => ({ label: linkLabel(r.url), url: r.url, count: r.count }));
  const config: ChartConfig = { count: { label: 'Clicks', color: 'var(--chart-1)' } };
  return (
    <ChartContainer
      config={config}
      className="w-full"
      style={{ height: Math.max(160, data.length * 44) }}
    >
      <BarChart data={data} layout="vertical" margin={{ left: 8, right: 16 }}>
        <CartesianGrid horizontal={false} />
        <YAxis dataKey="label" type="category" tickLine={false} axisLine={false} width={180} />
        <XAxis type="number" hide />
        <ChartTooltip content={<ChartTooltipContent hideLabel />} />
        <Bar dataKey="count" fill="var(--color-count)" radius={4} barSize={24} />
      </BarChart>
    </ChartContainer>
  );
}
