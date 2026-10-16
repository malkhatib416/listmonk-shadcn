import { useQuery } from '@tanstack/react-query';
import { Link, useNavigate } from '@tanstack/react-router';
import {
  BarChart2,
  Clock,
  Copy,
  Eye,
  Loader2,
  MoreHorizontal,
  Pause,
  Pencil,
  Send,
  Trash2,
  UserCheck,
  XCircle,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { useApp, useCan, useT } from '@/components/app-context';
import { BulkBar } from '@/components/bulk-bar';
import { useConfirm } from '@/components/confirm-dialog';
import { DataTable, type Column } from '@/components/data-table';
import { EmptyState } from '@/components/empty-state';
import { Pagination } from '@/components/pagination';
import { PreviewDialog, type PreviewSource } from '@/components/preview-dialog';
import { PromptDialog } from '@/components/prompt-dialog';
import { StatusBadge } from '@/components/status-badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Progress } from '@/components/ui/progress';
import { useApiMutation } from '@/hooks/use-api-mutation';
import { useSelection } from '@/hooks/use-selection';
import { apiFetch } from '@/lib/api';
import { bulkQuery } from '@/lib/bulk';
import {
  campaignActions,
  campaignsQuery,
  mergeRunningStats,
  progressPercent,
  runningStatsQuery,
  statusTone,
  type Campaign,
  type CampaignStatus,
  type CampaignsSearch,
} from '@/lib/campaigns';
import { formatDate, formatDateTime } from '@/lib/format';

// The campaigns table. Used on /campaigns and, read-only, on a list's overview page.
export function CampaignsTable({
  search,
  onSearch,
  listId,
  readonly,
}: {
  search: CampaignsSearch;
  onSearch: (patch: Partial<CampaignsSearch>, resetPage?: boolean) => void;
  listId?: number;
  readonly?: boolean;
}) {
  const t = useT();
  const can = useCan();
  const confirm = useConfirm();
  const navigate = useNavigate();
  const { config } = useApp();
  const { data, isPending, error } = useQuery(campaignsQuery(search, listId));
  const hasRunning = (data?.results ?? []).some((c) => c.status === 'running');
  const live = useQuery(runningStatsQuery(hasRunning));
  const { selected, allMatching, setSelected, selectAllMatching, clear } = useSelection(
    JSON.stringify([search, listId]),
  );
  const [preview, setPreview] = useState<PreviewSource | null>(null);
  const [cloning, setCloning] = useState<Campaign | null>(null);
  const canManage = can('campaigns:manage', 'campaigns:manage_all');
  const canSend = can('campaigns:send');

  const rows = useMemo(
    () => mergeRunningStats(data?.results ?? [], live.data ?? []),
    [data, live.data],
  );
  const total = data?.total ?? 0;
  const count = allMatching ? total : selected.size;
  const invalidate = [['campaigns']];

  const changeStatus = useApiMutation({
    mutationFn: ({ c, status }: { c: Campaign; status: CampaignStatus }) =>
      apiFetch(`/api/campaigns/${c.id}/status`, {
        method: 'PUT',
        body: JSON.stringify({ status }),
      }),
    invalidate,
    success: (_d, v) => t('campaigns.statusChanged', { name: v.c.name, status: v.status }),
  });
  const del = useApiMutation({
    mutationFn: (c: Campaign) => apiFetch(`/api/campaigns/${c.id}`, { method: 'DELETE' }),
    invalidate,
    success: (_d, c) => t('globals.messages.deleted', { name: c.name }),
  });
  const delMany = useApiMutation({
    mutationFn: () =>
      apiFetch(
        `/api/campaigns?${bulkQuery({ ids: [...selected], allMatching }, { query: search.query, status: search.status, tag: search.tag, type: search.type })}`,
        { method: 'DELETE' },
      ),
    invalidate,
    success: () =>
      t('globals.messages.deletedCount', {
        num: count,
        name: t.tc('globals.terms.campaign', count),
      }),
    onSuccess: clear,
  });
  const clone = useApiMutation({
    mutationFn: async ({ from, name }: { from: Campaign; name: string }) => {
      const c = await apiFetch<
        Campaign & {
          from_email: string;
          template_id: number | null;
          messenger: string;
          body: string;
          body_source: string | null;
          altbody: string | null;
          headers: unknown;
          attribs: unknown;
          archive: boolean;
          archive_template_id: number | null;
          archive_meta: unknown;
          media: { id: number }[] | null;
        }
      >(`/api/campaigns/${from.id}`);
      const slug = `${name.toLowerCase().replace(/[^a-z0-9]/g, '-')}-${String(Date.now()).slice(-4)}`;
      return apiFetch<Campaign>('/api/campaigns', {
        method: 'POST',
        body: JSON.stringify({
          name,
          subject: c.subject,
          lists: (c.lists ?? []).map((l) => l.id),
          type: c.type,
          from_email: c.from_email,
          content_type: c.content_type,
          messenger: c.messenger,
          tags: c.tags,
          template_id: c.template_id,
          body: c.body,
          body_source: c.body_source,
          altbody: c.altbody,
          headers: c.headers,
          attribs: c.attribs,
          send_at: c.send_at,
          archive: c.archive,
          archive_template_id: c.archive_template_id,
          archive_meta: c.archive_meta,
          media: (c.media ?? []).map((m) => m.id),
          ...(c.archive ? { archive_slug: slug } : {}),
        }),
      });
    },
    invalidate,
    success: (d) => t('globals.messages.created', { name: d.name }),
    onSuccess: (d) => {
      setCloning(null);
      void navigate({ to: '/campaigns/$id', params: { id: String(d.id) } });
    },
  });

  const setStatus = async (c: Campaign, status: CampaignStatus) => {
    const ok = await confirm({
      title: t(`campaigns.status.${status}` as string),
      description: status === 'scheduled' ? t('campaigns.confirmSchedule') : c.name,
      destructive: status === 'cancelled',
    });
    if (ok) changeStatus.mutate({ c, status });
  };

  const columns: Column<Campaign>[] = [
    {
      id: 'name',
      sortKey: 'name',
      header: t('globals.fields.name'),
      className: 'min-w-80',
      cell: (c) => (
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Link
              to="/campaigns/$id"
              params={{ id: String(c.id) }}
              data-testid="campaign-name"
              className={`font-medium hover:underline ${c.status === 'cancelled' ? 'text-muted-foreground' : ''}`}
            >
              {c.name}
            </Link>
            {c.type === 'optin' ? (
              <button
                type="button"
                onClick={() => onSearch({ type: 'optin' })}
                title={`${t('globals.buttons.filter')} ${t('lists.optin')}`}
              >
                <StatusBadge tone="success">
                  <UserCheck className="size-3" /> {t('lists.optin')}
                </StatusBadge>
              </button>
            ) : null}
          </div>
          <div className="text-muted-foreground truncate text-xs">{c.subject}</div>
          {c.tags?.length ? (
            <div className="mt-0.5 flex flex-wrap gap-x-2 text-xs">
              {c.tags.map((tag) => (
                <button
                  key={tag}
                  type="button"
                  className="text-primary hover:underline"
                  onClick={() => onSearch({ tag: [tag] })}
                >
                  #{tag}
                </button>
              ))}
            </div>
          ) : null}
          {c.lists?.length ? (
            <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5" data-testid="campaign-lists">
              {c.lists.slice(0, 3).map((l) => (
                <Link
                  key={l.id}
                  to="/subscribers/lists/$id"
                  params={{ id: String(l.id) }}
                  className="text-muted-foreground hover:text-foreground text-xs"
                >
                  {l.name}
                </Link>
              ))}
              {c.lists.length > 3 ? (
                <span
                  className="text-muted-foreground text-xs"
                  title={c.lists
                    .slice(3)
                    .map((l) => l.name)
                    .join(', ')}
                >
                  +{c.lists.length - 3}
                </span>
              ) : null}
            </div>
          ) : null}
        </div>
      ),
    },
    {
      id: 'status',
      header: t('globals.fields.status'),
      cell: (c) => (
        <div className="flex flex-col gap-1">
          <button
            type="button"
            onClick={() => onSearch({ status: [c.status] })}
            title={`${t('globals.buttons.filter')} ${t(`campaigns.status.${c.status}`)}`}
            className="w-fit"
          >
            <StatusBadge tone={statusTone(c.status)} dot>
              {t(`campaigns.status.${c.status}`)}
              {c.status === 'running' ? <Loader2 className="size-3 animate-spin" /> : null}
            </StatusBadge>
          </button>
          {c.status === 'scheduled' && c.send_at ? (
            <span
              className="text-muted-foreground flex items-center gap-1 text-xs"
              title={formatDateTime(c.send_at, config.lang)}
            >
              <Clock className="size-3" /> {formatDateTime(c.send_at, config.lang)}
            </span>
          ) : null}
        </div>
      ),
    },
    {
      id: 'stats',
      header: t('campaigns.stats'),
      cell: (c) => (
        <div className="flex min-w-32 flex-col gap-1 text-sm">
          {c.sent > 0 || c.status === 'running' ? (
            <div data-testid="campaign-sent">
              <span className="font-medium">{c.sent.toLocaleString()}</span>
              {c.to_send && c.status !== 'finished' ? (
                <span className="text-muted-foreground"> / {c.to_send.toLocaleString()}</span>
              ) : null}
              <span className="text-muted-foreground ml-1 text-xs">
                {t('campaigns.sent').toLowerCase()}
              </span>
            </div>
          ) : null}
          <Link
            to="/subscribers/bounces"
            search={{ campaign_id: c.id }}
            className="hover:underline"
          >
            {c.bounces.toLocaleString()}{' '}
            <span className="text-muted-foreground text-xs">
              {t('globals.terms.bounces').toLowerCase()}
            </span>
          </Link>
          {c.status === 'running' ? (
            <div className="flex items-center gap-2">
              <Progress
                value={progressPercent(c.sent, c.to_send)}
                className="h-1.5 w-24"
                aria-label={t('campaigns.progress')}
              />
              <span className="text-muted-foreground text-xs">
                {Math.round(c.rate ?? 0)} / {t('campaigns.rateMinuteShort')}
              </span>
            </div>
          ) : null}
        </div>
      ),
    },
    {
      id: 'analytics',
      header: t('globals.terms.analytics'),
      cell: (c) => (
        <div className="flex flex-col gap-1 text-sm">
          <div>
            {c.views.toLocaleString()}{' '}
            <span className="text-muted-foreground text-xs">
              {t('campaigns.views').toLowerCase()}
            </span>
          </div>
          <div>
            {c.clicks.toLocaleString()}{' '}
            <span className="text-muted-foreground text-xs">
              {t('campaigns.clicks').toLowerCase()}
            </span>
          </div>
        </div>
      ),
    },
    {
      id: 'created_at',
      sortKey: 'created_at',
      header: t('campaigns.timestamps'),
      cell: (c) => {
        const started = c.started_at && c.status !== 'draft' && c.status !== 'scheduled';
        return (
          <span
            className="text-muted-foreground text-sm"
            title={[
              `${t('globals.fields.createdAt')}: ${formatDateTime(c.created_at, config.lang)}`,
              c.send_at
                ? `${t('campaigns.status.scheduled')}: ${formatDateTime(c.send_at, config.lang)}`
                : '',
              c.started_at
                ? `${t('campaigns.startedAt')}: ${formatDateTime(c.started_at, config.lang)}`
                : '',
            ]
              .filter(Boolean)
              .join('\n')}
          >
            {started
              ? `${formatDate(c.started_at, config.lang)} · ${t('campaigns.startedAt').toLowerCase()}`
              : formatDate(c.created_at, config.lang)}
          </span>
        );
      },
    },
    {
      id: 'actions',
      header: <span className="sr-only">{t('globals.buttons.more')}</span>,
      className: 'w-12 text-right',
      cell: (c) => {
        const a = campaignActions(c);
        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" aria-label={t('globals.buttons.more')}>
                <MoreHorizontal />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                data-testid="btn-preview"
                onClick={() =>
                  setPreview({ title: c.name, path: `/api/campaigns/${c.id}/preview` })
                }
              >
                <Eye /> {t('campaigns.preview')}
              </DropdownMenuItem>
              {!readonly && canSend ? (
                <>
                  {a.canStart ? (
                    <DropdownMenuItem
                      data-testid="btn-start"
                      onClick={() => setStatus(c, 'running')}
                    >
                      <Send /> {t('campaigns.start')}
                    </DropdownMenuItem>
                  ) : null}
                  {a.canSchedule ? (
                    <DropdownMenuItem
                      data-testid="btn-schedule"
                      onClick={() => setStatus(c, 'scheduled')}
                    >
                      <Clock /> {t('campaigns.schedule')}
                    </DropdownMenuItem>
                  ) : null}
                  {a.canPause ? (
                    <DropdownMenuItem
                      data-testid="btn-pause"
                      onClick={() => setStatus(c, 'paused')}
                    >
                      <Pause /> {t('campaigns.pause')}
                    </DropdownMenuItem>
                  ) : null}
                  {a.canResume ? (
                    <DropdownMenuItem
                      data-testid="btn-resume"
                      onClick={() => setStatus(c, 'running')}
                    >
                      <Send /> {t('campaigns.send')}
                    </DropdownMenuItem>
                  ) : null}
                  {a.canCancel ? (
                    <DropdownMenuItem
                      variant="destructive"
                      data-testid="btn-cancel"
                      onClick={() => setStatus(c, 'cancelled')}
                    >
                      <XCircle /> {t('globals.buttons.cancel')}
                    </DropdownMenuItem>
                  ) : null}
                </>
              ) : null}
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild data-testid="btn-edit">
                <Link to="/campaigns/$id" params={{ id: String(c.id) }}>
                  <Pencil /> {t('globals.buttons.edit')}
                </Link>
              </DropdownMenuItem>
              {!readonly && canManage ? (
                <DropdownMenuItem data-testid="btn-clone" onClick={() => setCloning(c)}>
                  <Copy /> {t('globals.buttons.clone')}
                </DropdownMenuItem>
              ) : null}
              {can('campaigns:get_analytics') ? (
                <DropdownMenuItem asChild data-testid="btn-analytics">
                  <Link to="/campaigns/analytics" search={{ id: [c.id] }}>
                    <BarChart2 /> {t('globals.terms.analytics')}
                  </Link>
                </DropdownMenuItem>
              ) : null}
              {!readonly && canManage ? (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    variant="destructive"
                    data-testid="btn-delete"
                    onClick={async () => {
                      const ok = await confirm({
                        title: t('globals.buttons.delete'),
                        description: t('campaigns.confirmDelete', { name: c.name }),
                        confirmLabel: t('globals.buttons.delete'),
                        destructive: true,
                      });
                      if (ok) del.mutate(c);
                    }}
                  >
                    <Trash2 /> {t('globals.buttons.delete')}
                  </DropdownMenuItem>
                </>
              ) : null}
            </DropdownMenuContent>
          </DropdownMenu>
        );
      },
    },
  ];

  return (
    <>
      {!readonly && canManage ? (
        <BulkBar
          count={selected.size}
          total={total}
          allMatching={allMatching}
          onSelectAllMatching={selectAllMatching}
          onClear={clear}
        >
          <Button
            variant="destructive"
            size="sm"
            data-testid="btn-delete-campaigns"
            onClick={async () => {
              const ok = await confirm({
                title: t('globals.buttons.delete'),
                description: t('globals.messages.confirmDelete', {
                  num: count,
                  name: t.tc('globals.terms.campaign', count).toLowerCase(),
                }),
                confirmLabel: `${t('globals.buttons.delete')} ${count}`,
                destructive: true,
              });
              if (ok) delMany.mutate();
            }}
          >
            <Trash2 /> {t('globals.buttons.delete')} {count}
          </Button>
        </BulkBar>
      ) : null}
      {error ? (
        <p className="text-destructive text-sm">{error.message}</p>
      ) : (
        <DataTable
          columns={columns}
          rows={rows}
          getRowId={(c) => c.id}
          loading={isPending}
          rowTestId="campaign-row"
          rowAttrs={(c) => ({ 'data-status': c.status, 'data-campaign-id': String(c.id) })}
          selection={!readonly && canManage ? { selected, onChange: setSelected } : undefined}
          selectAllLabel={t('globals.buttons.toggleSelect')}
          selectRowLabel={(c) => c.name}
          serverSort={{
            state: search.order_by ? { id: search.order_by, dir: search.order ?? 'asc' } : null,
            onChange: (s) =>
              onSearch({ order_by: s?.id as CampaignsSearch['order_by'], order: s?.dir }, false),
          }}
          empty={<EmptyState icon={Send} title={t('globals.messages.emptyState')} />}
        />
      )}
      <Pagination
        page={search.page ?? 1}
        perPage={data?.per_page ?? 20}
        total={total}
        onPage={(page) => onSearch({ page }, false)}
      />
      <PreviewDialog source={preview} onClose={() => setPreview(null)} />
      <PromptDialog
        open={cloning !== null}
        title={t('globals.buttons.clone')}
        initial={cloning ? t('campaigns.copyOf', { name: cloning.name }) : ''}
        confirmLabel={t('globals.buttons.clone')}
        busy={clone.isPending}
        onClose={() => setCloning(null)}
        onSubmit={(name) => cloning && clone.mutate({ from: cloning, name })}
      />
    </>
  );
}
