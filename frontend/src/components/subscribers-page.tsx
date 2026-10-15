import { useQuery } from '@tanstack/react-query';
import { Link, useNavigate } from '@tanstack/react-router';
import {
  Activity,
  CornerRightDown,
  Download,
  List as ListIcon,
  MoreHorizontal,
  Pencil,
  Plus,
  Search,
  SlidersHorizontal,
  Trash2,
  UserX,
  Users,
  X,
} from 'lucide-react';
import { useMemo, useState } from 'react';

import { useApp, useCan, useT } from '@/components/app-context';
import { BulkBar } from '@/components/bulk-bar';
import { useConfirm } from '@/components/confirm-dialog';
import { DataTable, type Column } from '@/components/data-table';
import { EmptyState } from '@/components/empty-state';
import { ManageListsDialog } from '@/components/manage-lists-dialog';
import { PageHeader } from '@/components/page-header';
import { Pagination } from '@/components/pagination';
import { StatusBadge, type Tone } from '@/components/status-badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { UserAvatar } from '@/components/user-avatar';
import { useApiMutation } from '@/hooks/use-api-mutation';
import { useSelection } from '@/hooks/use-selection';
import { apiFetch } from '@/lib/api';
import { hardHref } from '@/lib/basepath';
import { formatDate } from '@/lib/format';
import { listsMinimalQuery } from '@/lib/lists';
import {
  exportUrl,
  manageListsBody,
  queryBody,
  subscribersQuery,
  visibleLists,
  type ManageListsForm,
  type Subscriber,
  type SubscribersSearch,
} from '@/lib/subscribers';

const ALL = 'all';
const SUB_TONE: Record<string, Tone> = {
  confirmed: 'success',
  unconfirmed: 'warning',
  unsubscribed: 'danger',
};

// The subscribers table. With `fixedListId` it is the "subscribers of one list" view.
export function SubscribersPage({
  search,
  fixedListId,
}: {
  search: SubscribersSearch;
  fixedListId?: number;
}) {
  const t = useT();
  const can = useCan();
  const confirm = useConfirm();
  const { config } = useApp();
  const navigate = useNavigate();
  const effective: SubscribersSearch = fixedListId ? { ...search, list_id: [fixedListId] } : search;
  const { data, isPending, error } = useQuery(subscribersQuery(effective));
  const { data: allLists = [] } = useQuery(listsMinimalQuery);
  const { selected, allMatching, setSelected, selectAllMatching, clear } = useSelection(
    JSON.stringify(effective),
  );
  const [text, setText] = useState(search.search ?? '');
  const [sql, setSql] = useState(search.query ?? '');
  const [sqlOpen, setSqlOpen] = useState(false);
  const [manageOpen, setManageOpen] = useState(false);
  const canManage = can('subscribers:manage');

  const rows = useMemo(() => data?.results ?? [], [data]);
  const total = data?.total ?? 0;
  const currentList = fixedListId ? allLists.find((l) => l.id === fixedListId) : undefined;

  const go = (patch: Partial<SubscribersSearch>, resetPage = true) => {
    const next = { ...search, ...(resetPage ? { page: undefined } : {}), ...patch };
    void navigate(
      fixedListId
        ? { to: '/subscribers/lists/$id', params: { id: String(fixedListId) }, search: next }
        : { to: '/subscribers', search: next },
    );
  };

  const ids = [...selected].map(Number);
  const count = allMatching ? total : ids.length;
  const body = queryBody(effective);
  const invalidate = [['subscribers'], ['lists']];

  const del = useApiMutation({
    mutationFn: (s: Subscriber) => apiFetch(`/api/subscribers/${s.id}`, { method: 'DELETE' }),
    invalidate,
    success: (_d, s) => t('globals.messages.deleted', { name: s.email }),
  });
  const delMany = useApiMutation({
    mutationFn: () =>
      allMatching
        ? apiFetch('/api/subscribers/query/delete', { method: 'POST', body: JSON.stringify(body) })
        : apiFetch(`/api/subscribers?${new URLSearchParams(ids.map((i) => ['id', String(i)]))}`, {
            method: 'DELETE',
          }),
    invalidate,
    success: () => t('subscribers.subscribersDeleted', { num: count }),
    onSuccess: clear,
  });
  const blocklist = useApiMutation({
    mutationFn: () =>
      allMatching
        ? apiFetch('/api/subscribers/query/blocklist', {
            method: 'PUT',
            body: JSON.stringify(body),
          })
        : apiFetch('/api/subscribers/blocklist', { method: 'PUT', body: JSON.stringify({ ids }) }),
    invalidate,
    success: () => t('globals.messages.done'),
    onSuccess: clear,
  });
  const manage = useApiMutation({
    mutationFn: (f: ManageListsForm) =>
      allMatching
        ? apiFetch('/api/subscribers/query/lists', {
            method: 'PUT',
            body: JSON.stringify(manageListsBody(f, { query: body })),
          })
        : apiFetch('/api/subscribers/lists', {
            method: 'PUT',
            body: JSON.stringify(manageListsBody(f, { ids })),
          }),
    invalidate,
    success: () => t('subscribers.listChangeApplied'),
    onSuccess: () => {
      setManageOpen(false);
      clear();
    },
  });

  const onExport = async () => {
    const n = !allMatching && ids.length > 0 ? ids.length : total;
    if (
      !(await confirm({
        title: t('subscribers.export'),
        description: t('subscribers.confirmExport', { num: n }),
      }))
    )
      return;
    window.location.assign(exportUrl(window._LM_ROOT, effective, allMatching ? [] : ids));
  };

  const columns: Column<Subscriber>[] = [
    {
      id: 'email',
      sortKey: 'email',
      header: t('subscribers.email'),
      className: 'min-w-72',
      cell: (s) => {
        const { shown, hidden } = visibleLists(s.lists ?? [], 3);
        return (
          <div className="flex items-center gap-3">
            <UserAvatar
              name={s.name || s.email}
              className={s.status === 'blocklisted' ? 'opacity-50' : ''}
            />
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-1.5">
                <Link
                  to="/subscribers/$id"
                  params={{ id: String(s.id) }}
                  className="font-medium hover:underline"
                >
                  {s.email}
                </Link>
                {s.status !== 'enabled' ? (
                  <button
                    type="button"
                    onClick={() => go({ status: s.status })}
                    title={`${t('globals.buttons.filter')} ${t(`subscribers.status.${s.status}`)}`}
                  >
                    <StatusBadge tone="danger" dot>
                      {t(`subscribers.status.${s.status}`)}
                    </StatusBadge>
                  </button>
                ) : null}
              </div>
              {shown.length > 0 ? (
                <div className="mt-1 flex flex-wrap items-center gap-1.5" data-testid="sub-lists">
                  {shown.map((l) => (
                    <span
                      key={l.id}
                      className="text-muted-foreground flex items-center gap-1 text-xs"
                      title={`${l.name}: ${t(`subscribers.status.${l.subscription_status}`)}`}
                    >
                      <span
                        className={`size-1.5 rounded-full ${l.subscription_status === 'confirmed' ? 'bg-success-foreground' : l.subscription_status === 'unsubscribed' ? 'bg-danger-foreground' : 'bg-warning-foreground'}`}
                      />
                      {l.name}
                    </span>
                  ))}
                  {hidden.length > 0 ? (
                    <Link
                      to="/subscribers/$id/lists"
                      params={{ id: String(s.id) }}
                      className="text-primary text-xs hover:underline"
                      title={hidden.map((l) => l.name).join(', ')}
                    >
                      +{hidden.length}
                    </Link>
                  ) : null}
                </div>
              ) : null}
            </div>
          </div>
        );
      },
    },
    {
      id: 'name',
      sortKey: 'name',
      header: t('globals.fields.name'),
      cell: (s) => <span>{s.name}</span>,
    },
    {
      id: 'created_at',
      sortKey: 'created_at',
      header: t('globals.fields.createdAt'),
      cell: (s) => (
        <span className="text-muted-foreground">{formatDate(s.created_at, config.lang)}</span>
      ),
    },
    {
      id: 'updated_at',
      sortKey: 'updated_at',
      header: t('globals.fields.updatedAt'),
      cell: (s) => (
        <span className="text-muted-foreground">{formatDate(s.updated_at, config.lang)}</span>
      ),
    },
    {
      id: 'actions',
      header: <span className="sr-only">{t('globals.buttons.more')}</span>,
      className: 'w-12 text-right',
      cell: (s) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" aria-label={t('globals.buttons.more')}>
              <MoreHorizontal />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {canManage ? (
              <DropdownMenuItem asChild data-testid="btn-edit">
                <Link to="/subscribers/$id/edit" params={{ id: String(s.id) }}>
                  <Pencil /> {t('globals.buttons.edit')}
                </Link>
              </DropdownMenuItem>
            ) : null}
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link to="/subscribers/$id/lists" params={{ id: String(s.id) }}>
                <ListIcon /> {t.tc('globals.terms.lists', 2)}
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link to="/subscribers/$id" params={{ id: String(s.id) }}>
                <Activity /> {t('subscribers.activity')}
              </Link>
            </DropdownMenuItem>
            {can('bounces:get') ? (
              <DropdownMenuItem asChild>
                <Link to="/subscribers/$id/bounces" params={{ id: String(s.id) }}>
                  <CornerRightDown /> {t('globals.terms.bounces')}
                </Link>
              </DropdownMenuItem>
            ) : null}
            {canManage ? (
              <>
                <DropdownMenuItem asChild data-testid="btn-download">
                  <a href={hardHref(window._LM_ROOT, `/api/subscribers/${s.id}/export`)}>
                    <Download /> {t('subscribers.downloadData')}
                  </a>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  variant="destructive"
                  data-testid="btn-delete"
                  onClick={async () => {
                    const ok = await confirm({
                      title: t('globals.buttons.delete'),
                      description: t('subscribers.confirmDelete', { num: 1 }),
                      confirmLabel: t('globals.buttons.delete'),
                      destructive: true,
                    });
                    if (ok) del.mutate(s);
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

  const hasFilters = !!(
    search.search ||
    search.query ||
    search.status ||
    search.subscription_status ||
    (!fixedListId && search.list_id)
  );

  return (
    <>
      <PageHeader
        title={t('globals.terms.subscribers')}
        description={
          isPending ? undefined : (
            <>
              <span data-testid="total">{total}</span>
              {currentList ? ` · ${currentList.name}` : ''}
            </>
          )
        }
        actions={
          canManage ? (
            <Button asChild data-testid="btn-new">
              <Link to="/subscribers/new">
                <Plus /> {t('globals.buttons.new')}
              </Link>
            </Button>
          ) : null
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <form
          className="relative w-full sm:w-80"
          onSubmit={(e) => {
            e.preventDefault();
            go({ search: text.trim() || undefined, query: undefined });
          }}
        >
          <Search className="text-muted-foreground absolute top-1/2 left-3 size-4 -translate-y-1/2" />
          <Input
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={t('subscribers.queryPlaceholder')}
            aria-label={t('globals.buttons.search')}
            data-testid="search"
            disabled={!!search.query}
            className="pr-10 pl-9"
          />
          {can('subscribers:sql_query') ? (
            <Popover open={sqlOpen} onOpenChange={setSqlOpen}>
              <PopoverTrigger asChild>
                <Button
                  type="button"
                  variant={search.query ? 'secondary' : 'ghost'}
                  size="icon"
                  className="absolute top-1/2 right-1 size-7 -translate-y-1/2"
                  aria-label={t('subscribers.advancedQuery')}
                  data-testid="btn-advanced-search"
                >
                  <SlidersHorizontal />
                </Button>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-96" data-testid="query-editor">
                <form
                  className="flex flex-col gap-3"
                  onSubmit={(e) => {
                    e.preventDefault();
                    // The popover is portaled but React still bubbles the event to the
                    // search form it is rendered inside.
                    e.stopPropagation();
                    setSqlOpen(false);
                    go({ query: sql.trim() || undefined, search: undefined });
                  }}
                >
                  <Textarea
                    value={sql}
                    onChange={(e) => setSql(e.target.value)}
                    rows={6}
                    placeholder="subscribers.name LIKE '%user%' or subscribers.status='blocklisted'"
                    className="font-mono text-xs"
                    data-testid="query"
                    aria-label={t('subscribers.advancedQuery')}
                  />
                  <p className="text-muted-foreground text-xs">
                    {t('subscribers.advancedQueryHelp')}.{' '}
                    <a
                      className="text-primary hover:underline"
                      href="https://listmonk.app/docs/querying-and-segmentation"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      {t('globals.buttons.learnMore')}
                    </a>
                  </p>
                  <div className="flex justify-end gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      data-testid="btn-query-reset"
                      disabled={!sql.trim()}
                      onClick={() => setSql('')}
                    >
                      {t('subscribers.reset')}
                    </Button>
                    <Button type="submit" size="sm" data-testid="btn-query">
                      {t('subscribers.query')}
                    </Button>
                  </div>
                </form>
              </PopoverContent>
            </Popover>
          ) : null}
        </form>
        {fixedListId ? (
          <Button
            variant="secondary"
            size="sm"
            data-testid="btn-remove-filter"
            onClick={() =>
              void navigate({ to: '/subscribers', search: { ...search, page: undefined } })
            }
          >
            {currentList?.name ?? `#${fixedListId}`} <X />
          </Button>
        ) : (
          <Select
            value={search.list_id?.[0] ? String(search.list_id[0]) : ALL}
            onValueChange={(v) => go({ list_id: v === ALL ? undefined : [Number(v)] })}
          >
            <SelectTrigger
              className="w-auto min-w-36 gap-2"
              aria-label={t('globals.terms.list')}
              data-testid="filter-list"
            >
              <span className="text-muted-foreground">{t('globals.terms.list')}:</span>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>—</SelectItem>
              {allLists.map((l) => (
                <SelectItem key={l.id} value={String(l.id)}>
                  {l.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        <Select
          value={search.status ?? ALL}
          onValueChange={(v) => go({ status: v === ALL ? undefined : (v as Subscriber['status']) })}
        >
          <SelectTrigger className="w-auto min-w-32 gap-2" aria-label={t('globals.fields.status')}>
            <span className="text-muted-foreground">{t('globals.fields.status')}:</span>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>—</SelectItem>
            <SelectItem value="enabled">{t('subscribers.status.enabled')}</SelectItem>
            <SelectItem value="blocklisted">{t('subscribers.status.blocklisted')}</SelectItem>
          </SelectContent>
        </Select>
        <Select
          value={search.subscription_status ?? ALL}
          onValueChange={(v) =>
            go({
              subscription_status:
                v === ALL ? undefined : (v as SubscribersSearch['subscription_status']),
            })
          }
        >
          <SelectTrigger
            className="w-auto min-w-40 gap-2"
            aria-label={t.tc('globals.terms.subscriptions', 1)}
            data-testid="filter-sub-status"
          >
            <span className="text-muted-foreground">{t.tc('globals.terms.subscriptions', 1)}:</span>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>—</SelectItem>
            {(['unconfirmed', 'confirmed', 'unsubscribed'] as const).map((s) => (
              <SelectItem key={s} value={s}>
                {t(`subscribers.status.${s}`)}
              </SelectItem>
            ))}
            <SelectItem value="none">{t('dashboard.orphanSubs')}</SelectItem>
          </SelectContent>
        </Select>
        {hasFilters ? (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setText('');
              setSql('');
              go({
                search: undefined,
                query: undefined,
                status: undefined,
                subscription_status: undefined,
                ...(fixedListId ? {} : { list_id: undefined }),
              });
            }}
          >
            <X /> {t('globals.buttons.clear')}
          </Button>
        ) : null}
        {search.subscription_status && SUB_TONE[search.subscription_status] ? null : null}
      </div>

      <BulkBar
        count={selected.size}
        total={total}
        allMatching={allMatching}
        onSelectAllMatching={selectAllMatching}
        onClear={clear}
      >
        <Button variant="outline" size="sm" data-testid="btn-export-subscribers" onClick={onExport}>
          <Download /> {t('subscribers.export')}
        </Button>
        {canManage ? (
          <>
            <Button
              variant="outline"
              size="sm"
              data-testid="btn-manage-lists"
              onClick={() => setManageOpen(true)}
            >
              <ListIcon /> {t('subscribers.manageLists')}
            </Button>
            <Button
              variant="outline"
              size="sm"
              data-testid="btn-manage-blocklist"
              onClick={async () => {
                if (
                  await confirm({
                    title: t('import.blocklist'),
                    description: t('subscribers.confirmBlocklist', { num: count }),
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
              data-testid="btn-delete-subscribers"
              onClick={async () => {
                const ok = await confirm({
                  title: t('globals.buttons.delete'),
                  description: t('subscribers.confirmDelete', { num: count }),
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

      {error ? (
        <p className="text-destructive text-sm">{error.message}</p>
      ) : (
        <DataTable
          columns={columns}
          rows={rows}
          getRowId={(s) => s.id}
          loading={isPending}
          rowTestId="sub-row"
          rowAttrs={(s) => ({ 'data-status': s.status })}
          selection={{ selected, onChange: setSelected }}
          selectAllLabel={t('globals.buttons.toggleSelect')}
          selectRowLabel={(s) => s.email}
          serverSort={{
            state: search.order_by ? { id: search.order_by, dir: search.order ?? 'asc' } : null,
            onChange: (s) =>
              go({ order_by: s?.id as SubscribersSearch['order_by'], order: s?.dir }, false),
          }}
          empty={<EmptyState icon={Users} title={t('globals.messages.emptyState')} />}
        />
      )}
      <Pagination
        page={search.page ?? 1}
        perPage={data?.per_page ?? 20}
        total={total}
        onPage={(page) => go({ page }, false)}
      />

      <ManageListsDialog
        open={manageOpen}
        onClose={() => setManageOpen(false)}
        busy={manage.isPending}
        onSubmit={(f) => manage.mutate(f)}
      />
    </>
  );
}
