import { useQuery } from '@tanstack/react-query';
import { Link, createFileRoute, useNavigate } from '@tanstack/react-router';
import { FileText, MoreHorizontal, Trash2, UserX, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useApp, useCan, useT } from '@/components/app-context';
import { BulkBar } from '@/components/bulk-bar';
import { useConfirm } from '@/components/confirm-dialog';
import { DataTable, type Column } from '@/components/data-table';
import { EmptyState } from '@/components/empty-state';
import { PageHeader } from '@/components/page-header';
import { Pagination } from '@/components/pagination';
import { StatusBadge, type Tone } from '@/components/status-badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { UserAvatar } from '@/components/user-avatar';
import { useSelection } from '@/hooks/use-selection';
import { useApiMutation } from '@/hooks/use-api-mutation';
import { apiFetch } from '@/lib/api';
import { bouncesQuery, bouncesSearchSchema, type Bounce, type BouncesSearch } from '@/lib/bounces';
import { bulkQuery } from '@/lib/bulk';
import { formatDateTime } from '@/lib/format';
import { Inbox } from 'lucide-react';

export const Route = createFileRoute('/_app/subscribers/bounces')({
  head: () => ({ meta: [{ title: 'Bounces - listmonk' }] }),
  validateSearch: (s): BouncesSearch => bouncesSearchSchema.parse(s) as BouncesSearch,
  component: BouncesPage,
});

const TONE: Record<Bounce['type'], Tone> = { soft: 'warning', hard: 'danger', complaint: 'danger' };

function BouncesPage() {
  const t = useT();
  const can = useCan();
  const confirm = useConfirm();
  const { config } = useApp();
  const search = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  const { data, isPending, error } = useQuery(bouncesQuery(search));
  const { selected, allMatching, setSelected, selectAllMatching, clear } = useSelection(
    JSON.stringify(search),
  );
  const [meta, setMeta] = useState<Bounce | null>(null);
  const canManage = can('bounces:manage');

  const rows = useMemo(() => data?.results ?? [], [data]);
  const total = data?.total ?? 0;

  const go = (patch: Partial<BouncesSearch>, resetPage = true) =>
    void navigate({
      search: (prev) => ({ ...prev, ...(resetPage ? { page: undefined } : {}), ...patch }),
    });

  const filters = { campaign_id: search.campaign_id, source: search.source, type: search.type };
  const selection = { ids: [...selected], allMatching };
  const invalidate = [['bounces']];

  const del = useApiMutation({
    mutationFn: (b: Bounce) => apiFetch(`/api/bounces/${b.id}`, { method: 'DELETE' }),
    invalidate,
    success: (_d, b) => t('globals.messages.deleted', { name: b.email }),
  });
  const delMany = useApiMutation({
    mutationFn: () =>
      apiFetch(`/api/bounces?${bulkQuery(selection, filters)}`, { method: 'DELETE' }),
    invalidate,
    success: () =>
      t('globals.messages.deletedCount', {
        num: allMatching ? total : selected.size,
        name: t.tc('globals.terms.bounce', allMatching ? total : selected.size),
      }),
    onSuccess: clear,
  });
  const blocklist = useApiMutation({
    mutationFn: () =>
      apiFetch(`/api/bounces/blocklist?${bulkQuery(selection, filters)}`, { method: 'PUT' }),
    invalidate,
    success: () => t('globals.messages.done'),
  });

  const count = allMatching ? total : selected.size;

  const columns: Column<Bounce>[] = [
    {
      id: 'email',
      sortKey: 'email',
      header: t('subscribers.email'),
      cell: (b) => (
        <div className="flex items-center gap-3">
          <UserAvatar
            name={b.subscriber_name || b.email}
            className={b.subscriber_status === 'blocklisted' ? 'opacity-50' : ''}
          />
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-1.5">
              <Link
                to="/subscribers/$id"
                params={{ id: String(b.subscriber_id) }}
                className="font-medium hover:underline"
              >
                {b.email}
              </Link>
              {b.subscriber_status !== 'enabled' ? (
                <StatusBadge tone="danger" dot>
                  {t(`subscribers.status.${b.subscriber_status}`)}
                </StatusBadge>
              ) : null}
            </div>
            {b.subscriber_name ? (
              <div className="text-muted-foreground truncate text-xs">{b.subscriber_name}</div>
            ) : null}
          </div>
        </div>
      ),
    },
    {
      id: 'campaign',
      header: t('globals.terms.campaign'),
      cell: (b) =>
        b.campaign ? (
          <button
            type="button"
            className="text-left hover:underline"
            onClick={() => go({ campaign_id: b.campaign!.id })}
          >
            {b.campaign.name}
          </button>
        ) : (
          <span className="text-muted-foreground">—</span>
        ),
    },
    {
      id: 'source',
      sortKey: 'source',
      header: t('bounces.source'),
      cell: (b) => (
        <button
          type="button"
          className="text-muted-foreground hover:underline"
          onClick={() => go({ source: b.source })}
        >
          {b.source}
        </button>
      ),
    },
    {
      id: 'type',
      sortKey: 'type',
      header: t('globals.fields.type'),
      cell: (b) => (
        <button type="button" onClick={() => go({ type: b.type })}>
          <StatusBadge tone={TONE[b.type]}>{t(`bounces.${b.type}`)}</StatusBadge>
        </button>
      ),
    },
    {
      id: 'created_at',
      sortKey: 'created_at',
      header: t('globals.fields.createdAt'),
      cell: (b) => (
        <span className="text-muted-foreground">{formatDateTime(b.created_at, config.lang)}</span>
      ),
    },
    {
      id: 'actions',
      header: <span className="sr-only">{t('globals.buttons.more')}</span>,
      className: 'w-12 text-right',
      cell: (b) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" aria-label={t('globals.buttons.more')}>
              <MoreHorizontal />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem data-testid="btn-meta" onClick={() => setMeta(b)}>
              <FileText /> {t('globals.buttons.view')}
            </DropdownMenuItem>
            {canManage ? (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  variant="destructive"
                  data-testid="btn-delete"
                  onClick={async () => {
                    if (
                      await confirm({
                        title: t('globals.buttons.delete'),
                        description: t('globals.messages.confirm'),
                        confirmLabel: t('globals.buttons.delete'),
                        destructive: true,
                      })
                    )
                      del.mutate(b);
                  }}
                >
                  <Trash2 /> {t('globals.buttons.delete')}
                </DropdownMenuItem>
              </>
            ) : null}
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ];

  const chips: { label: string; clear: Partial<BouncesSearch> }[] = [
    ...(search.source ? [{ label: search.source, clear: { source: undefined } }] : []),
    ...(search.type ? [{ label: t(`bounces.${search.type}`), clear: { type: undefined } }] : []),
    ...(search.campaign_id
      ? [{ label: `#${search.campaign_id}`, clear: { campaign_id: undefined } }]
      : []),
  ];

  return (
    <>
      <PageHeader
        title={t('globals.terms.bounces')}
        description={isPending ? undefined : String(total)}
      />
      {chips.length > 0 ? (
        <div className="mb-4 flex flex-wrap items-center gap-2">
          {chips.map((c) => (
            <Button key={c.label} variant="secondary" size="sm" onClick={() => go(c.clear)}>
              {c.label} <X />
            </Button>
          ))}
        </div>
      ) : null}

      {canManage ? (
        <BulkBar
          count={selected.size}
          total={total}
          allMatching={allMatching}
          onSelectAllMatching={selectAllMatching}
          onClear={clear}
        >
          {can('bounces:manage') ? (
            <>
              <Button
                variant="outline"
                size="sm"
                data-testid="btn-manage-blocklist"
                onClick={async () => {
                  if (
                    await confirm({
                      title: t('import.blocklist'),
                      description: t('subscribers.confirmBlocklist', {
                        num: allMatching ? t('globals.terms.all') : count,
                      }),
                    })
                  )
                    blocklist.mutate();
                }}
              >
                <UserX /> {t('import.blocklist')}
              </Button>
              <Button
                variant="destructive"
                size="sm"
                data-testid="btn-delete-bounces"
                onClick={async () => {
                  const ok = await confirm({
                    title: t('globals.buttons.delete'),
                    description: t('globals.messages.confirmDelete', {
                      num: count,
                      name: t.tc('globals.terms.bounce', count).toLowerCase(),
                    }),
                    confirmLabel: `${t('globals.buttons.delete')} ${count}`,
                    destructive: true,
                  });
                  if (ok) delMany.mutate();
                }}
              >
                <Trash2 /> {t('globals.buttons.delete')}
              </Button>
            </>
          ) : null}
        </BulkBar>
      ) : null}

      {error ? (
        <p className="text-destructive text-sm">{error.message}</p>
      ) : (
        <DataTable
          columns={columns}
          rows={rows}
          getRowId={(b) => b.id}
          loading={isPending}
          rowTestId="bounce-row"
          selection={canManage ? { selected, onChange: setSelected } : undefined}
          selectAllLabel={t('globals.buttons.toggleSelect')}
          selectRowLabel={(b) => b.email}
          serverSort={{
            state: search.order_by ? { id: search.order_by, dir: search.order ?? 'asc' } : null,
            onChange: (s) =>
              go({ order_by: s?.id as BouncesSearch['order_by'], order: s?.dir }, false),
          }}
          empty={<EmptyState icon={Inbox} title={t('globals.messages.emptyState')} />}
        />
      )}
      <Pagination
        page={search.page ?? 1}
        perPage={data?.per_page ?? 20}
        total={total}
        onPage={(page) => go({ page }, false)}
      />

      <Dialog open={meta !== null} onOpenChange={(o) => !o && setMeta(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{meta?.email}</DialogTitle>
          </DialogHeader>
          <pre
            className="bg-muted max-h-96 overflow-auto rounded-lg p-4 text-xs"
            data-testid="bounce-meta"
          >
            {JSON.stringify(meta?.meta ?? {}, null, 2)}
          </pre>
          <DialogFooter>
            <Button variant="outline" onClick={() => setMeta(null)}>
              {t('globals.buttons.close')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
