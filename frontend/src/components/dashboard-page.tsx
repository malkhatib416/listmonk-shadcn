import { useQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { Activity, AtSign, BarChart2, List, Mail, Send, TriangleAlert } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { useApp, useCan, useT } from '@/components/app-context';
import { EmptyState } from '@/components/empty-state';
import { PageHeader } from '@/components/page-header';
import { StatusBadge } from '@/components/status-badge';
import { TrendChart } from '@/components/trend-chart';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { statusTone } from '@/lib/campaigns';
import {
  campaignDate,
  dashboardCampaignsQuery,
  dashboardChartsQuery,
  dashboardCountsQuery,
  dashboardSystemQuery,
  meterTone,
} from '@/lib/dashboard';
import { formatDate } from '@/lib/format';
import { cn } from '@/lib/utils';

const fmt = (n: number | undefined) => (n ?? 0).toLocaleString();

function StatCard({
  testId,
  icon: Icon,
  label,
  value,
  to,
  children,
}: {
  testId: string;
  icon: typeof List;
  label: string;
  value: number | undefined;
  to?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <article className="bg-card flex flex-col gap-2 rounded-xl border p-5" data-testid={testId}>
      <p className="text-muted-foreground flex items-center gap-2 text-sm">
        <Icon className="size-4" /> {label}
      </p>
      <p className="text-3xl font-semibold tracking-tight" data-testid="stat-value">
        {to ?? fmt(value)}
      </p>
      {children ? <dl className="mt-1 flex justify-between gap-3 text-sm">{children}</dl> : null}
    </article>
  );
}

function Meta({ value, label, children }: { value: number; label: string; children: ReactNode }) {
  return (
    <div className="flex items-baseline gap-1.5">
      <dt className="font-semibold">{children ?? fmt(value)}</dt>
      <dd className="text-muted-foreground">{label}</dd>
    </div>
  );
}

const METER_TONE = {
  danger: '[&>[data-slot=progress-indicator]]:bg-danger-foreground',
  warning: '[&>[data-slot=progress-indicator]]:bg-warning-foreground',
  success: '[&>[data-slot=progress-indicator]]:bg-success-foreground',
  info: '',
  neutral: '',
};

function Meter({ pct, label }: { pct: number; label: string }) {
  return (
    <Progress
      value={Math.min(pct, 100)}
      aria-label={label}
      title={`${pct}%`}
      className={cn('bg-muted', METER_TONE[meterTone(pct)])}
    />
  );
}

function Card({
  title,
  to,
  children,
  className,
}: {
  title: ReactNode;
  to?: 'analytics';
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn('bg-card rounded-xl border p-5', className)}>
      <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold">
        {to ? (
          <Link to="/campaigns/analytics" className="hover:underline">
            {title}
          </Link>
        ) : (
          title
        )}
      </h2>
      {children}
    </section>
  );
}

export function DashboardPage() {
  const t = useT();
  const can = useCan();
  const { config } = useApp();
  const [today] = useState(() => new Date());
  const counts = useQuery(dashboardCountsQuery);
  const charts = useQuery(dashboardChartsQuery);
  const campaigns = useQuery(dashboardCampaignsQuery);
  const system = useQuery(dashboardSystemQuery);
  const c = counts.data;
  const sys = system.data;
  const byStatus = c?.campaigns.by_status ?? {};

  return (
    <>
      <PageHeader title={today.toLocaleDateString(config.lang, { dateStyle: 'long' })} />
      <div className="flex flex-col gap-6">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            testId="lists"
            icon={List}
            label={t('globals.terms.lists')}
            value={c?.lists.total}
            to={
              <Link to="/lists" className="hover:underline">
                {fmt(c?.lists.total)}
              </Link>
            }
          >
            <Meta value={c?.lists.public ?? 0} label={t('lists.types.public')}>
              <Link to="/lists" search={{ type: 'public' }} className="hover:underline">
                {fmt(c?.lists.public)}
              </Link>
            </Meta>
            <Meta value={c?.lists.private ?? 0} label={t('lists.types.private')}>
              <Link to="/lists" search={{ type: 'private' }} className="hover:underline">
                {fmt(c?.lists.private)}
              </Link>
            </Meta>
          </StatCard>

          <StatCard
            testId="subscribers"
            icon={AtSign}
            label={t('globals.terms.subscribers')}
            value={c?.subscribers.total}
            to={
              <Link to="/subscribers" className="hover:underline">
                {fmt(c?.subscribers.total)}
              </Link>
            }
          >
            <Meta value={c?.subscribers.orphans ?? 0} label={t('dashboard.orphanSubs')}>
              <Link
                to="/subscribers"
                search={{ subscription_status: 'none' }}
                className="hover:underline"
              >
                {fmt(c?.subscribers.orphans)}
              </Link>
            </Meta>
            <Meta
              value={c?.subscribers.blocklisted ?? 0}
              label={t('subscribers.status.blocklisted')}
            >
              <Link
                to="/subscribers"
                search={{ status: 'blocklisted' }}
                className="hover:underline"
              >
                {fmt(c?.subscribers.blocklisted)}
              </Link>
            </Meta>
          </StatCard>

          <StatCard
            testId="campaigns"
            icon={Send}
            label={t('globals.terms.campaigns')}
            value={c?.campaigns.total}
            to={
              <Link to="/campaigns" className="hover:underline">
                {fmt(c?.campaigns.total)}
              </Link>
            }
          >
            {(['scheduled', 'finished'] as const).map((s) => (
              <Meta key={s} value={byStatus[s] ?? 0} label={t(`campaigns.status.${s}`)}>
                <Link to="/campaigns" search={{ status: [s] }} className="hover:underline">
                  {fmt(byStatus[s])}
                </Link>
              </Meta>
            ))}
          </StatCard>

          <StatCard
            testId="messages"
            icon={Mail}
            label={t('dashboard.messagesSent')}
            value={c?.messages}
          />
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <Card title={t('dashboard.campaignViews')} to="analytics">
            {charts.isPending ? (
              <Skeleton className="h-56" />
            ) : (
              <TrendChart rows={charts.data?.campaign_views} label={t('dashboard.campaignViews')} />
            )}
          </Card>
          <Card title={t('dashboard.linkClicks')} to="analytics">
            {charts.isPending ? (
              <Skeleton className="h-56" />
            ) : (
              <TrendChart rows={charts.data?.link_clicks} label={t('dashboard.linkClicks')} />
            )}
          </Card>
        </div>

        <div className="grid gap-4 lg:grid-cols-3">
          <Card
            title={t('globals.terms.recent', { name: t('globals.terms.campaigns').toLowerCase() })}
            className="lg:col-span-2"
          >
            {campaigns.isPending ? (
              <Skeleton className="h-40" />
            ) : !campaigns.data?.length ? (
              <EmptyState icon={Send} title={t('globals.messages.emptyState')} />
            ) : (
              <ul className="divide-y" data-testid="recent-campaigns">
                {campaigns.data.map((camp) => (
                  <li key={camp.id} className="flex items-center gap-3 py-2.5">
                    <Link
                      to="/campaigns/$id"
                      params={{ id: String(camp.id) }}
                      className={cn(
                        'min-w-0 flex-1 truncate font-medium hover:underline',
                        camp.status === 'cancelled' && 'text-muted-foreground',
                      )}
                    >
                      {camp.name}
                    </Link>
                    <Link
                      to="/campaigns"
                      search={{ status: [camp.status] }}
                      title={`${t('globals.buttons.filter')} ${t(`campaigns.status.${camp.status}`)}`}
                    >
                      <StatusBadge tone={statusTone(camp.status)} dot>
                        {t(`campaigns.status.${camp.status}`)}
                      </StatusBadge>
                    </Link>
                    <span className="text-muted-foreground hidden w-28 text-right text-sm sm:block">
                      {formatDate(campaignDate(camp), config.lang)}
                    </span>
                    {can('campaigns:get_analytics') ? (
                      <Link
                        to="/campaigns/analytics"
                        search={{ id: [camp.id] }}
                        title={t('globals.terms.analytics')}
                        aria-label={t('globals.terms.analytics')}
                        className="text-muted-foreground hover:text-foreground"
                      >
                        <BarChart2 className="size-4" />
                      </Link>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card
            title={
              <>
                <Activity className="size-4" /> {t('dashboard.system')}
              </>
            }
          >
            {!sys ? (
              <Skeleton className="h-40" />
            ) : (
              <dl className="flex flex-col gap-4 text-sm" data-testid="system">
                <Row label="Uptime" value={sys.uptime} />
                <Row label="App memory" value={`${fmt(sys.app_mem_mb)} MB`} />
                {sys.has_host_mem ? (
                  <div className="flex flex-col gap-1.5">
                    <Row
                      label="System memory"
                      value={`${fmt(sys.mem_used_mb)} / ${fmt(sys.mem_total_mb)} MB`}
                    />
                    <Meter pct={sys.mem_pct} label="System memory" />
                  </div>
                ) : null}
                {sys.has_load ? (
                  <div className="flex flex-col gap-1.5">
                    <Row
                      label="CPU load"
                      value={`${sys.load_1} / ${sys.load_5} / ${sys.load_15}`}
                    />
                    <Meter pct={sys.load_pct} label="CPU load" />
                  </div>
                ) : null}
                <Row label="CPU cores" value={String(sys.num_cpu)} />
              </dl>
            )}
          </Card>
        </div>

        {sys?.cache_slow_queries ? (
          <p
            role="alert"
            className="bg-warning text-warning-foreground flex items-center gap-2 rounded-lg px-4 py-3 text-sm"
          >
            <TriangleAlert className="size-4 shrink-0" />
            <span>
              *{t('globals.messages.slowQueriesCached')}{' '}
              <a
                href="https://listmonk.app/docs/maintenance/performance/"
                target="_blank"
                rel="noopener noreferrer"
                className="underline"
              >
                {t('globals.buttons.learnMore')}
              </a>
            </span>
          </p>
        ) : null}
      </div>
    </>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt>{label}</dt>
      <dd className="text-muted-foreground">{value}</dd>
    </div>
  );
}
