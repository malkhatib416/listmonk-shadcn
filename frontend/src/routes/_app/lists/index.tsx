import { useQuery } from '@tanstack/react-query';
import { Link, createFileRoute, useNavigate } from '@tanstack/react-router';
import {
  BarChart2,
  Eye,
  EyeOff,
  ListChecks,
  MoreHorizontal,
  Pencil,
  Plus,
  Search,
  Send,
  Trash2,
  Upload,
  UserCheck,
  UserX,
  X,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { useApp, useCan, useT } from '@/components/app-context';
import { BulkBar } from '@/components/bulk-bar';
import { useConfirm } from '@/components/confirm-dialog';
import { DataTable, type Column } from '@/components/data-table';
import { EmptyState } from '@/components/empty-state';
import { PageHeader } from '@/components/page-header';
import { Pagination } from '@/components/pagination';
import { StatusBadge } from '@/components/status-badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useApiMutation } from '@/hooks/use-api-mutation';
import { useSelection } from '@/hooks/use-selection';
import { apiFetch } from '@/lib/api';
import { hardHref } from '@/lib/basepath';
import { bulkQuery } from '@/lib/bulk';
import { formatDate } from '@/lib/format';
import {
  breakdownStatuses,
  listsQuery,
  listsSearchSchema,
  type List,
  type ListsSearch,
} from '@/lib/lists';
import { canManageList } from '@/lib/permissions';

export const Route = createFileRoute('/_app/lists/')({
  head: () => ({ meta: [{ title: 'Lists - listmonk' }] }),
  validateSearch: (s): ListsSearch => listsSearchSchema.parse(s) as ListsSearch,
  component: ListsPage,
});

const ALL = 'all';
const STATUS_COLOR: Record<string, string> = {
  confirmed: 'bg-success-foreground',
  unconfirmed: 'bg-warning-foreground',
  unsubscribed: 'bg-danger-foreground',
};

function Breakdown({ list }: { list: List }) {
  const t = useT();
  const total = Math.max(list.subscriber_count, 1);
  const parts = breakdownStatuses(list.optin).map((s) => ({
    status: s,
    count: list.subscriber_statuses?.[s] ?? 0,
  }));
  return (
    <div className="flex min-w-36 flex-col gap-1.5">
      <div className="bg-muted flex h-1.5 overflow-hidden rounded-full" aria-label={list.name}>
        {parts.map((p) => (
          <div
            key={p.status}
            className={STATUS_COLOR[p.status]}
            style={{ width: `${(p.count / total) * 100}%` }}
            title={`${t(`subscribers.status.${p.status}`)} ${p.count}`}
          />
        ))}
      </div>
      <div className="text-muted-foreground flex gap-3 text-xs">
        {parts.map((p) => (
          <span
            key={p.status}
            className="flex items-center gap-1"
            title={t(`subscribers.status.${p.status}`)}
          >
            <span className={`size-1.5 rounded-full ${STATUS_COLOR[p.status]}`} />
            {p.count.toLocaleString()}
          </span>
        ))}
      </div>
    </div>
  );
}

function ListsPage() {
  const t = useT();
  const can = useCan();
  const confirm = useConfirm();
  const { config, user } = useApp();
  const search = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  const { data, isPending, error } = useQuery(listsQuery(search));
  const { selected, allMatching, setSelected, selectAllMatching, clear } = useSelection(
    JSON.stringify(search),
  );
  const [query, setQuery] = useState(search.query ?? '');

  const rows = useMemo(() => data?.results ?? [], [data]);
  const total = data?.total ?? 0;
  const go = (patch: Partial<ListsSearch>, resetPage = true) =>
    void navigate({
      search: (prev) => ({ ...prev, ...(resetPage ? { page: undefined } : {}), ...patch }),
    });

  const filters = {
    query: search.query,
    type: search.type,
    optin: search.optin,
    status: search.status ?? 'active',
    tag: search.tag,
  };
  const invalidate = [['lists']];

  const del = useApiMutation({
    mutationFn: (l: List) => apiFetch(`/api/lists/${l.id}`, { method: 'DELETE' }),
    invalidate,
    success: (_d, l) => t('globals.messages.deleted', { name: l.name }),
  });
  const delMany = useApiMutation({
    mutationFn: () =>
      apiFetch(`/api/lists?${bulkQuery({ ids: [...selected], allMatching }, filters)}`, {
        method: 'DELETE',
      }),
    invalidate,
    success: () => {
      const n = allMatching ? total : selected.size;
      return t('globals.messages.deletedCount', { num: n, name: t.tc('globals.terms.list', n) });
    },
    onSuccess: clear,
  });
  const optinCampaign = useApiMutation({
    mutationFn: (l: List) =>
      apiFetch<{ id: number }>('/api/campaigns', {
        method: 'POST',
        body: JSON.stringify({
          name: t('lists.optinTo', { name: l.name }),
          subject: t('lists.confirmSub', { name: l.name }),
          lists: [l.id],
          from_email: config.from_email,
          content_type: 'richtext',
          messenger: 'email',
          type: 'optin',
        }),
      }),
    onSuccess: (c) => {
      void navigate({ to: '/campaigns/$id', params: { id: String(c.id) }, hash: 'tab=content' });
    },
  });

  const count = allMatching ? total : selected.size;
  const canCampaign = can('campaigns:manage', 'campaigns:manage_all');
  const canSubs = can('subscribers:get', 'subscribers:get_all');

  const columns: Column<List>[] = [
    {
      id: 'name',
      sortKey: 'name',
      header: t('globals.fields.name'),
      cell: (l) => (
        <div className="flex items-center gap-3">
          <span
            className={`flex size-8 shrink-0 items-center justify-center rounded-lg ${
              l.status === 'archived'
                ? 'bg-muted text-muted-foreground'
                : 'bg-info text-info-foreground'
            }`}
          >
            <ListChecks className="size-4" />
          </span>
          <div className="min-w-0">
            <Link
              to="/lists/$id"
              params={{ id: String(l.id) }}
              className="font-medium hover:underline"
            >
              {l.name}
            </Link>
            {l.status === 'archived' ? (
              <StatusBadge className="ml-2">{t('lists.archived')}</StatusBadge>
            ) : null}
            {l.description ? (
              <div
                className="text-muted-foreground max-w-xs truncate text-xs"
                title={l.description}
              >
                {l.description}
              </div>
            ) : null}
            {l.tags?.length ? (
              <div className="mt-0.5 flex flex-wrap gap-x-2 text-xs">
                {l.tags.map((tag) => (
                  <button
                    key={tag}
                    type="button"
                    className="text-primary hover:underline"
                    title={`${t('globals.buttons.filter')} ${tag}`}
                    onClick={() => go({ tag: [tag] })}
                  >
                    #{tag}
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        </div>
      ),
    },
    {
      id: 'type',
      sortKey: 'type',
      header: t('globals.fields.type'),
      cell: (l) => (
        <div className="flex flex-wrap gap-1">
          <button
            type="button"
            onClick={() => go({ type: l.type })}
            title={`${t('globals.buttons.filter')} ${t(`lists.types.${l.type}`)}`}
          >
            <StatusBadge tone={l.type === 'public' ? 'info' : 'neutral'}>
              {l.type === 'public' ? <Eye className="size-3" /> : <EyeOff className="size-3" />}
              {t(`lists.types.${l.type}`)}
            </StatusBadge>
          </button>
          <button
            type="button"
            onClick={() => go({ optin: l.optin })}
            title={`${t('globals.buttons.filter')} ${t(`lists.optins.${l.optin}`)}`}
          >
            <StatusBadge tone={l.optin === 'double' ? 'success' : 'neutral'}>
              {l.optin === 'double' ? (
                <UserCheck className="size-3" />
              ) : (
                <UserX className="size-3" />
              )}
              {t(`lists.optins.${l.optin}`)}
            </StatusBadge>
          </button>
        </div>
      ),
    },
    {
      id: 'subscriber_count',
      sortKey: 'subscriber_count',
      header: t('globals.terms.subscribers'),
      cell: (l) => (
        <div className="flex flex-col gap-1.5">
          {canSubs ? (
            <a
              href={hardHref(window._LM_ROOT, `/admin/subscribers/lists/${l.id}`)}
              className="w-fit font-medium hover:underline"
              data-testid="subscriber-total"
              title={`${t('globals.buttons.view')} ${t('globals.terms.subscribers')}`}
            >
              {l.subscriber_count.toLocaleString()}
            </a>
          ) : (
            <span className="font-medium" data-testid="subscriber-total">
              {l.subscriber_count.toLocaleString()}
            </span>
          )}
          <Breakdown list={l} />
        </div>
      ),
    },
    {
      id: 'created_at',
      sortKey: 'created_at',
      header: t('globals.fields.createdAt'),
      cell: (l) => (
        <span className="text-muted-foreground">{formatDate(l.created_at, config.lang)}</span>
      ),
    },
    {
      id: 'actions',
      header: <span className="sr-only">{t('globals.buttons.more')}</span>,
      className: 'w-12 text-right',
      cell: (l) => {
        const manage = canManageList(user, l.id);
        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" aria-label={t('globals.buttons.more')}>
                <MoreHorizontal />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem asChild data-testid="btn-view">
                <Link to="/lists/$id" params={{ id: String(l.id) }}>
                  <Eye /> {t('globals.buttons.view')}
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild data-testid="btn-analytics">
                <Link to="/lists/analytics" search={{ id: [l.id] }}>
                  <BarChart2 /> {t('globals.terms.analytics')}
                </Link>
              </DropdownMenuItem>
              {manage || can('subscribers:import') || canCampaign ? (
                <DropdownMenuSeparator />
              ) : null}
              {manage ? (
                <DropdownMenuItem asChild data-testid="btn-edit">
                  <Link to="/lists/$id/edit" params={{ id: String(l.id) }}>
                    <Pencil /> {t('globals.buttons.edit')}
                  </Link>
                </DropdownMenuItem>
              ) : null}
              {can('subscribers:import') ? (
                <DropdownMenuItem asChild data-testid="btn-import">
                  <Link to="/subscribers/import" search={{ list_id: [l.id] }}>
                    <Upload /> {t('menu.import')}
                  </Link>
                </DropdownMenuItem>
              ) : null}
              {manage ? (
                <DropdownMenuItem
                  variant="destructive"
                  data-testid="btn-delete"
                  onClick={async () => {
                    const ok = await confirm({
                      title: t('globals.buttons.delete'),
                      description: t('lists.confirmDelete'),
                      confirmLabel: t('globals.buttons.delete'),
                      destructive: true,
                    });
                    if (ok) del.mutate(l);
                  }}
                >
                  <Trash2 /> {t('globals.buttons.delete')}
                </DropdownMenuItem>
              ) : null}
              {canCampaign ? (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild data-testid="btn-campaign">
                    <Link to="/campaigns/new" search={{ list_id: [l.id] }}>
                      <Send /> {t('campaigns.newCampaign')}
                    </Link>
                  </DropdownMenuItem>
                  {l.optin === 'double' ? (
                    <DropdownMenuItem
                      data-testid="btn-send-optin-campaign"
                      onClick={async () => {
                        if (
                          await confirm({
                            title: t('lists.sendOptinCampaign'),
                            description: l.name,
                          })
                        )
                          optinCampaign.mutate(l);
                      }}
                    >
                      <Send /> {t('lists.sendOptinCampaign')}
                    </DropdownMenuItem>
                  ) : null}
                </>
              ) : null}
            </DropdownMenuContent>
          </DropdownMenu>
        );
      },
    },
  ];

  const hasFilters = !!(search.type || search.optin || search.tag || search.status || search.query);

  return (
    <>
      <PageHeader
        title={t('globals.terms.lists')}
        description={isPending ? undefined : String(total)}
        actions={
          can('lists:manage_all') ? (
            <Button asChild data-testid="btn-new">
              <Link to="/lists/new">
                <Plus /> {t('globals.buttons.new')}
              </Link>
            </Button>
          ) : null
        }
      />
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <form
          className="relative w-full sm:w-64"
          onSubmit={(e) => {
            e.preventDefault();
            go({ query: query.trim() || undefined });
          }}
        >
          <Search className="text-muted-foreground absolute top-1/2 left-3 size-4 -translate-y-1/2" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t('globals.buttons.search')}
            aria-label={t('globals.buttons.search')}
            data-testid="query"
            className="pl-9"
          />
        </form>
        <Filter
          label={t('globals.fields.type')}
          value={search.type}
          onChange={(v) => go({ type: v as List['type'] | undefined })}
          options={[
            ['public', t('lists.types.public')],
            ['private', t('lists.types.private')],
          ]}
        />
        <Filter
          label={t('lists.optin')}
          value={search.optin}
          onChange={(v) => go({ optin: v as List['optin'] | undefined })}
          options={[
            ['single', t('lists.optins.single')],
            ['double', t('lists.optins.double')],
          ]}
        />
        <Filter
          label={t('globals.fields.status')}
          value={search.status}
          onChange={(v) => go({ status: v as List['status'] | undefined })}
          options={[
            ['active', t('globals.buttons.enabled')],
            ['archived', t('lists.archived')],
          ]}
        />
        {search.tag?.map((tag) => (
          <Button
            key={tag}
            variant="secondary"
            size="sm"
            data-testid="btn-remove-filter"
            onClick={() => {
              const rest = (search.tag ?? []).filter((x) => x !== tag);
              go({ tag: rest.length ? rest : undefined });
            }}
          >
            #{tag} <X />
          </Button>
        ))}
        {hasFilters ? (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setQuery('');
              void navigate({ search: {} });
            }}
          >
            <X /> {t('globals.buttons.clear')}
          </Button>
        ) : null}
      </div>

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
          data-testid="btn-delete-lists"
          onClick={async () => {
            const ok = await confirm({
              title: t('globals.buttons.delete'),
              description: t('globals.messages.confirmDelete', {
                num: count,
                name: t.tc('globals.terms.list', count).toLowerCase(),
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

      {error ? (
        <p className="text-destructive text-sm">{error.message}</p>
      ) : (
        <DataTable
          columns={columns}
          rows={rows}
          getRowId={(l) => l.id}
          loading={isPending}
          rowTestId="list-row"
          selection={{ selected, onChange: setSelected }}
          selectAllLabel={t('globals.buttons.toggleSelect')}
          selectRowLabel={(l) => l.name}
          serverSort={{
            state: search.order_by ? { id: search.order_by, dir: search.order ?? 'asc' } : null,
            onChange: (s) =>
              go({ order_by: s?.id as ListsSearch['order_by'], order: s?.dir }, false),
          }}
          empty={<EmptyState icon={ListChecks} title={t('globals.messages.emptyState')} />}
        />
      )}
      <Pagination
        page={search.page ?? 1}
        perPage={data?.per_page ?? 20}
        total={total}
        onPage={(page) => go({ page }, false)}
      />
    </>
  );
}

function Filter({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string | undefined;
  onChange: (v: string | undefined) => void;
  options: [string, string][];
}) {
  return (
    <Select value={value ?? ALL} onValueChange={(v) => onChange(v === ALL ? undefined : v)}>
      <SelectTrigger className="w-auto min-w-32 gap-2" aria-label={label}>
        <span className="text-muted-foreground">{label}:</span>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={ALL}>—</SelectItem>
        {options.map(([v, l]) => (
          <SelectItem key={v} value={v}>
            {l}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
