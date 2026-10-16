import { useQuery } from '@tanstack/react-query';
import { Link, useNavigate } from '@tanstack/react-router';
import { AlertTriangle } from 'lucide-react';
import { useState } from 'react';
import { useCan, useT } from '@/components/app-context';
import { Donut, LinksChart, SeriesChart, seriesColor } from '@/components/analytics-charts';
import { EmptyState } from '@/components/empty-state';
import { ItemPicker } from '@/components/item-picker';
import { PageHeader } from '@/components/page-header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import {
  analyticsQuery,
  formatCount,
  groupCounts,
  type AnalyticsItem,
  type AnalyticsSearch,
  type CountRow,
} from '@/lib/analytics';
import { BarChart2 } from 'lucide-react';

const pad = (n: number) => String(n).padStart(2, '0');
const toInput = (d: Date) =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;

function ChartCard({
  title,
  count,
  children,
}: {
  title: string;
  count?: number;
  children: React.ReactNode;
}) {
  return (
    <section className="bg-card rounded-xl border p-5">
      <h2 className="mb-4 text-sm font-semibold">
        {title}
        {count ? (
          <span className="text-muted-foreground ml-2 font-normal">({count.toLocaleString()})</span>
        ) : null}
      </h2>
      {children}
    </section>
  );
}

function Legend({
  resource,
  items,
  rows,
  extra,
  extraLabel,
}: {
  resource: 'campaigns' | 'lists';
  items: AnalyticsItem[];
  rows: CountRow[] | null;
  extra?: CountRow[] | null;
  extraLabel?: string;
}) {
  const idKey = resource === 'lists' ? 'list_id' : 'campaign_id';
  const totals = groupCounts(rows, idKey);
  const extras = groupCounts(extra, idKey);
  return (
    <ul className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-xs">
      {items.map((it, i) => (
        <li key={it.id} className="flex items-center gap-1.5">
          <span
            className="size-2 rounded-full"
            style={{ background: seriesColor(i) }}
            aria-hidden
          />
          {resource === 'lists' ? (
            <Link to="/lists/$id" params={{ id: String(it.id) }} className="hover:underline">
              #{it.id}: {it.name}
            </Link>
          ) : (
            <Link to="/campaigns/$id" params={{ id: String(it.id) }} className="hover:underline">
              #{it.id}: {it.name}
            </Link>
          )}
          : {formatCount(totals.get(it.id)?.total ?? 0, it.sent)}
          {extra ? (
            <span className="text-muted-foreground">
              ({extraLabel}: {extras.get(it.id)?.total ?? 0})
            </span>
          ) : null}
        </li>
      ))}
    </ul>
  );
}

// Campaign or list analytics: pick items and a date range, see the time series.
export function AnalyticsPage({
  resource,
  search,
}: {
  resource: 'campaigns' | 'lists';
  search: AnalyticsSearch;
}) {
  const t = useT();
  const can = useCan();
  const navigate = useNavigate();
  const { data, isFetching } = useQuery({
    ...analyticsQuery(resource, search),
    placeholderData: (p) => p,
  });
  const idKey = resource === 'lists' ? 'list_id' : 'campaign_id';

  const [picked, setPicked] = useState<AnalyticsItem[] | null>(null);
  const items = picked ?? data?.data.items ?? [];
  const [from, setFrom] = useState(
    () => search.from ?? toInput(new Date(Date.now() - 7 * 86400000)),
  );
  const [to, setTo] = useState(() => search.to ?? toInput(new Date()));
  const [interval, setInterval_] = useState(search.interval ?? 'day');

  const view = () =>
    void navigate({
      to: resource === 'lists' ? '/lists/analytics' : '/campaigns/analytics',
      search: { id: items.map((i) => i.id), from, to, interval },
    }).then(() => setPicked(null));

  const showCampaignCharts = data?.can_view_campaign_charts ?? can('campaigns:get_analytics');
  const d = data?.data;

  return (
    <>
      <PageHeader title={t('analytics.title')} />
      <form
        className="bg-card mb-6 grid gap-5 rounded-xl border p-5 lg:grid-cols-[1.2fr_1.6fr_9rem_auto]"
        onSubmit={(e) => {
          e.preventDefault();
          if (items.length > 0) view();
        }}
      >
        <div className="flex flex-col gap-2">
          <Label>{t(`globals.terms.${resource}`)}</Label>
          <ItemPicker resource={resource} value={items} onChange={setPicked} />
        </div>
        <div className="flex flex-col gap-2">
          <Label>
            {t('analytics.fromDate')} → {t('analytics.toDate')}
          </Label>
          <div className="flex gap-2">
            <Input
              type="datetime-local"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              aria-label={t('analytics.fromDate')}
              data-cy="from"
            />
            <Input
              type="datetime-local"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              aria-label={t('analytics.toDate')}
              data-cy="to"
            />
          </div>
          {data?.disable_tracking ? (
            <p className="text-warning-foreground flex items-center gap-1 text-xs">
              <AlertTriangle className="size-3.5" /> {t('analytics.trackingDisabled')}
            </p>
          ) : data && !data.individual_tracking ? (
            <p className="text-warning-foreground flex items-center gap-1 text-xs">
              <AlertTriangle className="size-3.5" /> {t('analytics.nonIndividualTracking')}
            </p>
          ) : null}
        </div>
        <div className="flex flex-col gap-2">
          <Label>{t('analytics.interval')}</Label>
          <Select value={interval} onValueChange={(v) => setInterval_(v as typeof interval)}>
            <SelectTrigger
              className="w-full"
              data-cy="interval"
              aria-label={t('analytics.interval')}
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(['day', 'hour', 'week', 'month'] as const).map((i) => (
                <SelectItem key={i} value={i}>
                  {t(`globals.terms.${i}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-end">
          <Button type="submit" disabled={items.length === 0 || isFetching} data-cy="btn-search">
            {t('globals.buttons.view')}
          </Button>
        </div>
      </form>

      {!data?.has_data ? (
        <div className="bg-card rounded-xl border">
          <EmptyState icon={BarChart2} title={t('globals.messages.emptyState')} />
        </div>
      ) : !d ? (
        <Skeleton className="h-64" />
      ) : (
        <div className="flex flex-col gap-6">
          {resource === 'lists' ? (
            <ChartCard
              title={t.tc('globals.terms.subscriptions', 2)}
              count={data.counts.subscriptions}
            >
              <div className="grid items-center gap-4 lg:grid-cols-[1fr_14rem]">
                <SeriesChart
                  items={items}
                  rows={d.subscriptions}
                  idKey={idKey}
                  extra={d.unsubscriptions}
                  extraLabel={t('subscribers.status.unsubscribed')}
                  label={t.tc('globals.terms.subscriptions', 2)}
                />
                <Donut items={items} rows={d.subscriptions} idKey={idKey} />
              </div>
              <Legend
                resource={resource}
                items={items}
                rows={d.subscriptions}
                extra={d.unsubscriptions}
                extraLabel={t('subscribers.status.unsubscribed')}
              />
            </ChartCard>
          ) : null}
          {showCampaignCharts
            ? (
                [
                  ['campaigns.views', d.views, data.counts.views],
                  ['campaigns.clicks', d.clicks, data.counts.clicks],
                  ['globals.terms.bounces', d.bounces, data.counts.bounces],
                ] as const
              ).map(([key, rows, count]) => (
                <ChartCard key={key} title={t(key)} count={count}>
                  {count > 0 ? (
                    <>
                      <div className="grid items-center gap-4 lg:grid-cols-[1fr_14rem]">
                        <SeriesChart items={items} rows={rows} idKey={idKey} label={t(key)} />
                        <Donut items={items} rows={rows} idKey={idKey} />
                      </div>
                      <Legend resource={resource} items={items} rows={rows} />
                    </>
                  ) : (
                    <EmptyState title={t('globals.messages.emptyState')} />
                  )}
                </ChartCard>
              ))
            : null}
          {showCampaignCharts ? (
            <ChartCard title={t('analytics.links')}>
              {d.links && d.links.length > 0 ? (
                <LinksChart rows={d.links} />
              ) : (
                <EmptyState title={t('globals.messages.emptyState')} />
              )}
            </ChartCard>
          ) : null}
        </div>
      )}
    </>
  );
}
