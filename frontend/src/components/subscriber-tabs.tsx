import { useQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { CheckCircle2, MoreHorizontal, RefreshCw, Trash2, UserX } from 'lucide-react';
import { useApp, useCan, useT } from '@/components/app-context';
import { useConfirm } from '@/components/confirm-dialog';
import { EmptyState } from '@/components/empty-state';
import { StatusBadge, type Tone } from '@/components/status-badge';
import { TrendChart, type TrendPoint } from '@/components/trend-chart';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useApiMutation } from '@/hooks/use-api-mutation';
import { apiFetch } from '@/lib/api';
import type { Bounce } from '@/lib/bounces';
import { formatDate, formatDateTime } from '@/lib/format';
import type { Subscriber } from '@/lib/subscribers';

const SUB_TONE: Record<string, Tone> = {
  confirmed: 'success',
  unconfirmed: 'warning',
  unsubscribed: 'danger',
};

function Block({
  title,
  children,
  actions,
}: {
  title: string;
  children: React.ReactNode;
  actions?: React.ReactNode;
}) {
  return (
    <section className="bg-card overflow-hidden rounded-xl border">
      <div className="flex items-center justify-between border-b px-5 py-3">
        <h2 className="text-sm font-semibold">{title}</h2>
        {actions}
      </div>
      {children}
    </section>
  );
}

// ---- Lists (subscriptions) ---------------------------------------------

export function ListsTab({ sub }: { sub: Subscriber }) {
  const t = useT();
  const can = useCan();
  const confirm = useConfirm();
  const { config } = useApp();
  const canSave = can('subscribers:manage');

  const act = useApiMutation({
    mutationFn: (v: {
      action: 'add' | 'unsubscribe' | 'remove';
      listId: number;
      status?: string;
    }) =>
      apiFetch('/api/subscribers/lists', {
        method: 'PUT',
        body: JSON.stringify({
          ids: [sub.id],
          action: v.action,
          target_list_ids: [v.listId],
          status: v.status ?? '',
        }),
      }),
    invalidate: [['subscribers']],
    success: () => t('subscribers.listChangeApplied'),
  });
  const run = async (v: Parameters<typeof act.mutate>[0]) => {
    if (
      await confirm({
        title: t('subscribers.manageLists'),
        description: t('globals.messages.confirm'),
      })
    )
      act.mutate(v);
  };

  const lists = sub.lists ?? [];
  if (lists.length === 0)
    return (
      <div className="bg-card rounded-xl border">
        <EmptyState title={t('globals.messages.emptyState')} />
      </div>
    );

  return (
    <div className="bg-card overflow-hidden rounded-xl border">
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead>{t('globals.terms.list')}</TableHead>
            <TableHead>{t('lists.optin')}</TableHead>
            <TableHead>{t('globals.fields.status')}</TableHead>
            <TableHead>{t('globals.fields.createdAt')}</TableHead>
            <TableHead>{t('globals.fields.updatedAt')}</TableHead>
            {canSave ? <TableHead className="w-12" /> : null}
          </TableRow>
        </TableHeader>
        <TableBody>
          {lists.map((l) => (
            <TableRow key={l.id} data-testid="sub-list-row">
              <TableCell>
                {l.restricted ? (
                  <span className="text-muted-foreground">{l.name}</span>
                ) : (
                  <Link
                    to="/lists/$id"
                    params={{ id: String(l.id) }}
                    className="font-medium hover:underline"
                  >
                    {l.name}
                  </Link>
                )}
              </TableCell>
              <TableCell>
                <StatusBadge tone={l.optin === 'double' ? 'success' : 'neutral'}>
                  {t(`lists.optins.${l.optin}`)}
                </StatusBadge>
              </TableCell>
              <TableCell>
                {l.optin === 'single' && l.subscription_status === 'unconfirmed' ? (
                  <span className="text-muted-foreground">–</span>
                ) : (
                  <StatusBadge tone={SUB_TONE[l.subscription_status] ?? 'neutral'} dot>
                    {t(`subscribers.status.${l.subscription_status}`)}
                  </StatusBadge>
                )}
              </TableCell>
              <TableCell className="text-muted-foreground">
                {formatDate(l.subscription_created_at, config.lang)}
              </TableCell>
              <TableCell className="text-muted-foreground">
                {formatDate(l.subscription_updated_at, config.lang)}
              </TableCell>
              {canSave ? (
                <TableCell className="text-right">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" aria-label={t('globals.buttons.more')}>
                        <MoreHorizontal />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      {l.optin === 'double' && l.subscription_status === 'unconfirmed' ? (
                        <DropdownMenuItem
                          data-testid="btn-confirm-sub"
                          onClick={() => run({ action: 'add', listId: l.id, status: 'confirmed' })}
                        >
                          <CheckCircle2 /> {t('email.optin.confirmSub')}
                        </DropdownMenuItem>
                      ) : null}
                      {l.subscription_status === 'unsubscribed' ? (
                        <DropdownMenuItem
                          data-testid="btn-resubscribe"
                          onClick={() =>
                            run({ action: 'add', listId: l.id, status: 'unconfirmed' })
                          }
                        >
                          <RefreshCw /> {t('subscribers.reSubscribe')}
                        </DropdownMenuItem>
                      ) : (
                        <DropdownMenuItem
                          data-testid="btn-unsubscribe"
                          onClick={() => run({ action: 'unsubscribe', listId: l.id })}
                        >
                          <UserX /> {t('email.unsub')}
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuItem
                        variant="destructive"
                        data-testid="btn-delete-sub"
                        onClick={() => run({ action: 'remove', listId: l.id })}
                      >
                        <Trash2 /> {t('globals.buttons.delete')}
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              ) : null}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

// "Send opt-in confirmation" for a subscriber with a double opt-in subscription.
export function useSendOptin(sub: Subscriber) {
  const t = useT();
  return useApiMutation({
    mutationFn: () => apiFetch(`/api/subscribers/${sub.id}/optin`, { method: 'POST' }),
    success: () => t('subscribers.sentOptinConfirm'),
  });
}

// ---- Bounces -----------------------------------------------------------

export function BouncesTab({ sub }: { sub: Subscriber }) {
  const t = useT();
  const { config } = useApp();
  const { data, isPending } = useQuery({
    queryKey: ['subscribers', sub.id, 'bounces'],
    queryFn: () => apiFetch<Bounce[]>(`/api/subscribers/${sub.id}/bounces`),
  });
  if (isPending) return <Skeleton className="h-40" />;
  if (!data || data.length === 0)
    return (
      <div className="bg-card rounded-xl border">
        <EmptyState title={t('globals.messages.emptyState')} />
      </div>
    );
  return (
    <div className="bg-card overflow-hidden rounded-xl border">
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead>{t('globals.terms.campaign')}</TableHead>
            <TableHead>{t('bounces.source')}</TableHead>
            <TableHead>{t('globals.fields.type')}</TableHead>
            <TableHead>{t('globals.fields.createdAt')}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.map((b) => (
            <TableRow key={b.id} data-testid="bounce-row">
              <TableCell>{b.campaign?.name ?? '—'}</TableCell>
              <TableCell className="text-muted-foreground">{b.source}</TableCell>
              <TableCell>
                <StatusBadge tone={b.type === 'soft' ? 'warning' : 'danger'}>
                  {t(`bounces.${b.type}`)}
                </StatusBadge>
              </TableCell>
              <TableCell className="text-muted-foreground">
                {formatDateTime(b.created_at, config.lang)}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

// ---- Activity ----------------------------------------------------------

interface Activity {
  campaign_views:
    | { id: number; name: string; subject: string; view_count: number; last_viewed_at: string }[]
    | null;
  link_clicks:
    | {
        url: string;
        campaign_id: number;
        campaign_name: string;
        campaign_subject: string;
        click_count: number;
        last_clicked_at: string;
      }[]
    | null;
}

interface SubCharts {
  campaign_views: TrendPoint[] | null;
  link_clicks: TrendPoint[] | null;
}

export function ActivityTab({ sub }: { sub: Subscriber }) {
  const t = useT();
  const can = useCan();
  const confirm = useConfirm();
  const { config } = useApp();
  const activity = useQuery({
    queryKey: ['subscribers', sub.id, 'activity'],
    queryFn: () => apiFetch<Activity>(`/api/subscribers/${sub.id}/activity`),
  });
  const charts = useQuery({
    queryKey: ['subscribers', sub.id, 'charts'],
    queryFn: () => apiFetch<SubCharts>(`/api/subscribers/${sub.id}/charts`),
  });
  const clear = useApiMutation({
    mutationFn: (type: 'campaign_views' | 'link_clicks') =>
      apiFetch(`/api/subscribers/${sub.id}/activity/${type}`, { method: 'DELETE' }),
    invalidate: [['subscribers']],
    success: () => t('globals.messages.done'),
  });

  const views = activity.data?.campaign_views ?? [];
  const clicks = activity.data?.link_clicks ?? [];
  const totalViews = views.reduce((n, v) => n + v.view_count, 0);
  const totalClicks = clicks.reduce((n, c) => n + c.click_count, 0);
  const canClear = can('subscribers:manage');

  const clearMenu = (type: 'campaign_views' | 'link_clicks') =>
    canClear ? (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" aria-label={t('globals.buttons.more')}>
            <MoreHorizontal />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem
            variant="destructive"
            onClick={async () => {
              if (
                await confirm({
                  title: t('globals.buttons.clear'),
                  description: t('globals.messages.confirm'),
                  destructive: true,
                })
              )
                clear.mutate(type);
            }}
          >
            <Trash2 /> {t('globals.buttons.clear')}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    ) : null;

  const camp = (id: number, name: string, subject: string) => (
    <div className="min-w-0">
      <Link to="/campaigns/$id" params={{ id: String(id) }} className="font-medium hover:underline">
        {name}
      </Link>
      <div className="text-muted-foreground truncate text-xs">{subject}</div>
    </div>
  );

  return (
    <div className="flex flex-col gap-6">
      <div className="bg-card flex flex-wrap items-center justify-between gap-4 rounded-xl border p-5">
        <div>
          <p className="font-semibold">{sub.name}</p>
          <p className="text-muted-foreground text-sm">{formatDate(sub.created_at, config.lang)}</p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => void navigator.clipboard?.writeText(String(sub.id))}
          >
            <span className="text-muted-foreground">{t('globals.fields.id')}</span> {sub.id}
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => void navigator.clipboard?.writeText(sub.uuid)}
          >
            <span className="text-muted-foreground">{t('globals.fields.uuid')}</span>{' '}
            {sub.uuid.slice(0, 8)}…
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        {[
          [t('globals.terms.campaigns'), views.length],
          [t('campaigns.views'), totalViews],
          [t('campaigns.clicks'), totalClicks],
        ].map(([label, n]) => (
          <div key={String(label)} className="bg-card rounded-xl border p-5">
            <p className="text-muted-foreground text-sm">{label}</p>
            <p className="mt-1 text-3xl font-semibold tracking-tight" data-testid="stat-value">
              {Number(n).toLocaleString()}
            </p>
          </div>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {(
          [
            ['campaigns.views', charts.data?.campaign_views],
            ['campaigns.clicks', charts.data?.link_clicks],
          ] as const
        ).map(([key, rows]) => (
          <section
            key={key}
            className="bg-card rounded-xl border p-5"
            data-testid={
              key === 'campaigns.views' ? 'chart-subscriber-views' : 'chart-subscriber-clicks'
            }
          >
            <h2 className="mb-4 text-sm font-semibold">{t(key)}</h2>
            {charts.isPending ? (
              <Skeleton className="h-56" />
            ) : (
              <TrendChart rows={rows} label={t(key)} />
            )}
          </section>
        ))}
      </div>

      {views.length > 0 ? (
        <Block title={t('campaigns.views')} actions={clearMenu('campaign_views')}>
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>{t('globals.terms.campaign')}</TableHead>
                <TableHead className="w-24 text-center">{t('campaigns.views')}</TableHead>
                <TableHead className="w-44">{t('globals.fields.createdAt')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {views.map((v) => (
                <TableRow key={v.id}>
                  <TableCell>{camp(v.id, v.name, v.subject)}</TableCell>
                  <TableCell className="text-center">{v.view_count}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {formatDateTime(v.last_viewed_at, config.lang)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Block>
      ) : null}

      {clicks.length > 0 ? (
        <Block title={t('campaigns.clicks')} actions={clearMenu('link_clicks')}>
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>{t('globals.terms.campaign')}</TableHead>
                <TableHead>{t('globals.terms.url')}</TableHead>
                <TableHead className="w-24 text-center">{t('campaigns.clicks')}</TableHead>
                <TableHead className="w-44">{t('globals.fields.createdAt')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {clicks.map((c, i) => (
                <TableRow key={`${c.url}-${i}`}>
                  <TableCell>
                    {c.campaign_id
                      ? camp(c.campaign_id, c.campaign_name, c.campaign_subject)
                      : null}
                  </TableCell>
                  <TableCell className="max-w-xs truncate">
                    <a
                      href={c.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary hover:underline"
                    >
                      {c.url}
                    </a>
                  </TableCell>
                  <TableCell className="text-center">{c.click_count}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {formatDateTime(c.last_clicked_at, config.lang)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Block>
      ) : null}
    </div>
  );
}
