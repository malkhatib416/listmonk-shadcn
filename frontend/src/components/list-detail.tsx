import { useQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { Copy, Eye, EyeOff, Pencil, UserCheck, UserX } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { useApp, useCan, useT } from '@/components/app-context';
import { CampaignsTable } from '@/components/campaigns-table';
import { ListForm } from '@/components/list-form';
import { PageHeader } from '@/components/page-header';
import { StatusBadge } from '@/components/status-badge';
import { TrendChart, type TrendPoint } from '@/components/trend-chart';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { apiFetch } from '@/lib/api';
import { hardHref } from '@/lib/basepath';
import { formatDate } from '@/lib/format';
import { listQuery, type List } from '@/lib/lists';
import type { CampaignsSearch } from '@/lib/campaigns';
import { canManageList } from '@/lib/permissions';
import { cn } from '@/lib/utils';

interface ListCharts {
  subscriptions: TrendPoint[] | null;
  unsubscriptions: TrendPoint[] | null;
  campaign_views?: TrendPoint[] | null;
}

function Tabs({ list, tab }: { list: List; tab: 'view' | 'edit' }) {
  const t = useT();
  const { user } = useApp();
  const base =
    'inline-flex items-center gap-2 border-b-2 px-3 py-2 text-sm font-medium transition-colors';
  return (
    <div className="mb-6 flex gap-1 border-b" role="tablist">
      <Link
        to="/lists/$id"
        params={{ id: String(list.id) }}
        role="tab"
        aria-selected={tab === 'view'}
        className={cn(
          base,
          tab === 'view'
            ? 'border-primary text-foreground'
            : 'text-muted-foreground hover:text-foreground border-transparent',
        )}
      >
        <Eye className="size-4" /> {t('globals.buttons.view')}
      </Link>
      <Link
        to="/lists/$id/edit"
        params={{ id: String(list.id) }}
        role="tab"
        aria-selected={tab === 'edit'}
        className={cn(
          base,
          tab === 'edit'
            ? 'border-primary text-foreground'
            : 'text-muted-foreground hover:text-foreground border-transparent',
        )}
      >
        <Pencil className="size-4" />{' '}
        {canManageList(user, list.id) ? t('globals.buttons.edit') : t('globals.buttons.view')}
      </Link>
    </div>
  );
}

function Stat({ label, value, href }: { label: string; value: number; href?: string }) {
  return (
    <div className="bg-card rounded-xl border p-5">
      <p className="text-muted-foreground text-sm">{label}</p>
      <p className="mt-1 text-3xl font-semibold tracking-tight">
        {href ? (
          <a href={href} className="hover:underline">
            {value.toLocaleString()}
          </a>
        ) : (
          value.toLocaleString()
        )}
      </p>
    </div>
  );
}

function Overview({ list }: { list: List }) {
  const t = useT();
  const can = useCan();
  const { config } = useApp();
  const charts = useQuery({
    queryKey: ['lists', list.id, 'charts'],
    queryFn: () => apiFetch<ListCharts>(`/api/lists/${list.id}/charts`),
  });
  const subs = hardHref(window._LM_ROOT, `/admin/subscribers/lists/${list.id}`);
  const canSubs = can('subscribers:get', 'subscribers:get_all');
  const showViews = can('campaigns:get', 'campaigns:get_all') && can('campaigns:get_analytics');
  const s = list.subscriber_statuses ?? {};
  const [campaignsSearch, setCampaignsSearch] = useState<CampaignsSearch>({});

  const copy = (v: string) => {
    void navigator.clipboard?.writeText(v);
    toast.success(t('globals.messages.copied'));
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="bg-card flex flex-wrap items-start justify-between gap-4 rounded-xl border p-5">
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge tone={list.type === 'public' ? 'info' : 'neutral'}>
              {list.type === 'public' ? <Eye className="size-3" /> : <EyeOff className="size-3" />}
              {t(`lists.types.${list.type}`)}
            </StatusBadge>
            <StatusBadge tone={list.optin === 'double' ? 'success' : 'neutral'}>
              {list.optin === 'double' ? (
                <UserCheck className="size-3" />
              ) : (
                <UserX className="size-3" />
              )}
              {t(`lists.optins.${list.optin}`)}
            </StatusBadge>
            {list.status === 'archived' ? <StatusBadge>{t('lists.archived')}</StatusBadge> : null}
            <span className="text-muted-foreground text-sm">
              {formatDate(list.created_at, config.lang)}
            </span>
          </div>
          {list.description ? (
            <p className="text-muted-foreground text-sm">{list.description}</p>
          ) : null}
          {list.tags?.length ? (
            <div className="flex flex-wrap gap-2 text-sm">
              {list.tags.map((tag) => (
                <Link
                  key={tag}
                  to="/lists"
                  search={{ tag: [tag] }}
                  className="text-primary hover:underline"
                >
                  #{tag}
                </Link>
              ))}
            </div>
          ) : null}
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" onClick={() => copy(String(list.id))}>
            <span className="text-muted-foreground">{t('globals.fields.id')}</span> {list.id}{' '}
            <Copy />
          </Button>
          <Button variant="secondary" size="sm" onClick={() => copy(list.uuid)}>
            <span className="text-muted-foreground">{t('globals.fields.uuid')}</span>{' '}
            {list.uuid.slice(0, 8)}… <Copy />
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat
          label={t('globals.terms.subscribers')}
          value={list.subscriber_count}
          href={canSubs ? subs : undefined}
        />
        {(['confirmed', 'unconfirmed', 'unsubscribed'] as const).map((st) => (
          <Stat
            key={st}
            label={t(`subscribers.status.${st}`)}
            value={s[st] ?? 0}
            href={canSubs ? `${subs}?subscription_status=${st}` : undefined}
          />
        ))}
      </div>

      <div className={cn('grid gap-4', showViews && 'lg:grid-cols-2')}>
        <section className="bg-card rounded-xl border p-5">
          <h2 className="mb-4 text-sm font-semibold">{t.tc('globals.terms.subscriptions', 2)}</h2>
          {charts.isPending ? (
            <Skeleton className="h-56" />
          ) : (
            <TrendChart
              rows={charts.data?.subscriptions}
              comparison={charts.data?.unsubscriptions}
              label={t.tc('globals.terms.subscriptions', 2)}
              comparisonLabel={t('subscribers.status.unsubscribed')}
            />
          )}
        </section>
        {showViews ? (
          <section className="bg-card rounded-xl border p-5">
            <h2 className="mb-4 text-sm font-semibold">{t('dashboard.campaignViews')}</h2>
            {charts.isPending ? (
              <Skeleton className="h-56" />
            ) : (
              <TrendChart rows={charts.data?.campaign_views} label={t('dashboard.campaignViews')} />
            )}
          </section>
        ) : null}
      </div>

      {can('campaigns:get', 'campaigns:get_all') ? (
        <section>
          <h2 className="mb-3 text-sm font-semibold">{t('globals.terms.campaigns')}</h2>
          <CampaignsTable
            readonly
            listId={list.id}
            search={campaignsSearch}
            onSearch={(patch, resetPage = true) =>
              setCampaignsSearch((prev) => ({
                ...prev,
                ...(resetPage ? { page: undefined } : {}),
                ...patch,
              }))
            }
          />
        </section>
      ) : null}
    </div>
  );
}

// The list page: header, View / Edit tabs, and the active tab.
export function ListDetail({ id, tab }: { id: number; tab: 'view' | 'edit' }) {
  const { user } = useApp();
  const { data: list, error } = useQuery(listQuery(id));
  if (error) return <p className="text-destructive text-sm">{error.message}</p>;
  if (!list) return <Skeleton className="h-96 max-w-4xl" />;

  return (
    <>
      <PageHeader title={list.name} />
      <Tabs list={list} tab={tab} />
      {tab === 'edit' ? (
        <ListForm key={list.id} list={list} canSave={canManageList(user, list.id)} />
      ) : (
        <Overview list={list} />
      )}
    </>
  );
}
