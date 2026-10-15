import { useQuery } from '@tanstack/react-query';
import { Link, createFileRoute, useNavigate } from '@tanstack/react-router';
import { Code2, MoreHorizontal, Pencil, Plus, Search, Trash2, UserRound, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useApp, useCan, useT } from '@/components/app-context';
import { useConfirm } from '@/components/confirm-dialog';
import { DataTable, type Column, type RowId } from '@/components/data-table';
import { EmptyState } from '@/components/empty-state';
import { PageHeader } from '@/components/page-header';
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
import { UserAvatar } from '@/components/user-avatar';
import { useApiMutation } from '@/hooks/use-api-mutation';
import { apiFetch } from '@/lib/api';
import { formatDate, formatDateTime } from '@/lib/format';
import {
  filterUsers,
  userLabel,
  usersQuery,
  usersSearchSchema,
  type User,
  type UsersSearch,
} from '@/lib/users';

export const Route = createFileRoute('/_app/users/')({
  head: () => ({ meta: [{ title: 'Users - listmonk' }] }),
  validateSearch: (s): UsersSearch => usersSearchSchema.parse(s) as UsersSearch,
  component: UsersPage,
});

const ALL = 'all';

function UsersPage() {
  const t = useT();
  const can = useCan();
  const confirm = useConfirm();
  const { config } = useApp();
  const search = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  const { data, isPending, error } = useQuery(usersQuery);
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<Set<RowId>>(new Set());
  const canManage = can('users:manage');

  const setFilter = (patch: Partial<UsersSearch>) => {
    setSelected(new Set());
    void navigate({ search: (prev) => ({ ...prev, ...patch }) });
  };

  const users = useMemo(() => data ?? [], [data]);
  const roles = useMemo(() => uniqueBy(users.map((u) => u.user_role)), [users]);
  const listRoles = useMemo(
    () => uniqueBy(users.flatMap((u) => (u.list_role ? [u.list_role] : []))),
    [users],
  );

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return filterUsers(users, search).filter(
      (u) => !q || [u.username, u.name, u.email ?? ''].some((v) => v.toLowerCase().includes(q)),
    );
  }, [users, search, query]);

  const del = useApiMutation({
    mutationFn: (u: User) => apiFetch(`/api/users/${u.id}`, { method: 'DELETE' }),
    invalidate: [['users']],
    success: (_d, u) => t('globals.messages.deleted', { name: userLabel(u) }),
  });
  const delMany = useApiMutation({
    mutationFn: (ids: number[]) => {
      const q = new URLSearchParams(ids.map((id) => ['id', String(id)]));
      return apiFetch(`/api/users?${q}`, { method: 'DELETE' });
    },
    invalidate: [['users']],
    success: (_d, ids) =>
      t('globals.messages.deletedCount', {
        num: ids.length,
        name: t.tc('globals.terms.user', ids.length),
      }),
    onSuccess: () => setSelected(new Set()),
  });

  const onDelete = async (u: User) => {
    const ok = await confirm({
      title: t('globals.buttons.delete'),
      description: t('globals.messages.confirm'),
      confirmLabel: t('globals.buttons.delete'),
      destructive: true,
    });
    if (ok) del.mutate(u);
  };

  const onDeleteSelected = async () => {
    const ids = [...selected].map(Number);
    const ok = await confirm({
      title: t('globals.buttons.delete'),
      description: t('globals.messages.confirmDelete', {
        num: ids.length,
        name: t.tc('globals.terms.user', ids.length).toLowerCase(),
      }),
      confirmLabel: `${t('globals.buttons.delete')} ${ids.length}`,
      destructive: true,
    });
    if (ok) delMany.mutate(ids);
  };

  const columns: Column<User>[] = [
    {
      id: 'username',
      header: t('users.username'),
      compare: (a, b) => a.username.localeCompare(b.username),
      cell: (u) => (
        <div className="flex items-center gap-3">
          <UserAvatar
            name={userLabel(u)}
            src={u.avatar}
            className={u.status === 'disabled' ? 'opacity-50' : ''}
          />
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-1.5">
              {canManage ? (
                <Link
                  to="/users/$id"
                  params={{ id: String(u.id) }}
                  className={
                    u.status === 'disabled'
                      ? 'text-muted-foreground font-medium'
                      : 'font-medium hover:underline'
                  }
                >
                  {u.username}
                </Link>
              ) : (
                <span className="font-medium">{u.username}</span>
              )}
              {u.type === 'api' ? (
                <StatusBadge tone="info">
                  <Code2 className="size-3" /> {t('users.type.api')}
                </StatusBadge>
              ) : null}
              {u.status === 'disabled' ? (
                <StatusBadge tone="danger" dot>
                  {t('users.status.disabled')}
                </StatusBadge>
              ) : null}
            </div>
            {u.name && u.name !== u.username ? (
              <div className="text-muted-foreground truncate text-xs">{u.name}</div>
            ) : null}
          </div>
        </div>
      ),
    },
    {
      id: 'email',
      header: t('subscribers.email'),
      compare: (a, b) => (a.email ?? '').localeCompare(b.email ?? ''),
      cell: (u) => <span className="text-muted-foreground">{u.email ?? '—'}</span>,
    },
    {
      id: 'user_role',
      header: t.tc('users.userRole', 1),
      compare: (a, b) => a.user_role.name.localeCompare(b.user_role.name),
      cell: (u) => (
        <button
          type="button"
          className="hover:underline"
          onClick={() => setFilter({ user_role_id: u.user_role.id })}
        >
          {u.user_role.name}
        </button>
      ),
    },
    {
      id: 'list_role',
      header: t.tc('users.listRole', 2),
      cell: (u) =>
        u.list_role ? (
          <button
            type="button"
            className="hover:underline"
            onClick={() => setFilter({ list_role_id: u.list_role!.id })}
          >
            {u.list_role.name}
          </button>
        ) : (
          <span className="text-muted-foreground">—</span>
        ),
    },
    {
      id: 'created_at',
      header: t('globals.fields.createdAt'),
      compare: (a, b) => a.created_at.localeCompare(b.created_at),
      cell: (u) => (
        <span className="text-muted-foreground">{formatDate(u.created_at, config.lang)}</span>
      ),
    },
    {
      id: 'loggedin_at',
      header: t('users.lastLogin'),
      compare: (a, b) => (a.loggedin_at ?? '').localeCompare(b.loggedin_at ?? ''),
      cell: (u) => (
        <span className="text-muted-foreground">{formatDateTime(u.loggedin_at, config.lang)}</span>
      ),
    },
    ...(canManage
      ? [
          {
            id: 'actions',
            header: <span className="sr-only">{t('globals.buttons.more')}</span>,
            className: 'w-12 text-right',
            cell: (u: User) => (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" aria-label={t('globals.buttons.more')}>
                    <MoreHorizontal />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem asChild data-testid="btn-edit">
                    <Link to="/users/$id" params={{ id: String(u.id) }}>
                      <Pencil /> {t('globals.buttons.edit')}
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    variant="destructive"
                    data-testid="btn-delete"
                    onClick={() => onDelete(u)}
                  >
                    <Trash2 /> {t('globals.buttons.delete')}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ),
          } satisfies Column<User>,
        ]
      : []),
  ];

  const hasFilters = Object.keys(search).length > 0 || query !== '';

  return (
    <>
      <PageHeader
        title={`${t('globals.terms.users')}`}
        description={isPending ? undefined : `${rows.length} / ${users.length}`}
        actions={
          canManage ? (
            <Button asChild data-testid="btn-new">
              <Link to="/users/new">
                <Plus /> {t('globals.buttons.new')}
              </Link>
            </Button>
          ) : null
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="relative w-full sm:w-64">
          <Search className="text-muted-foreground absolute top-1/2 left-3 size-4 -translate-y-1/2" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t('globals.buttons.search')}
            aria-label={t('globals.buttons.search')}
            className="pl-9"
          />
        </div>
        <FilterSelect
          label={t('users.type')}
          value={search.type}
          onChange={(v) => setFilter({ type: v as User['type'] | undefined })}
          options={[
            ['user', t('users.type.user')],
            ['api', t('users.type.api')],
          ]}
        />
        <FilterSelect
          label={t('globals.fields.status')}
          value={search.status}
          onChange={(v) => setFilter({ status: v as User['status'] | undefined })}
          options={[
            ['enabled', t('users.status.enabled')],
            ['disabled', t('users.status.disabled')],
          ]}
        />
        <FilterSelect
          label={t.tc('users.userRole', 1)}
          value={search.user_role_id ? String(search.user_role_id) : undefined}
          onChange={(v) => setFilter({ user_role_id: v ? Number(v) : undefined })}
          options={roles.map((r) => [String(r.id), r.name])}
        />
        <FilterSelect
          label={t.tc('users.listRole', 1)}
          value={search.list_role_id ? String(search.list_role_id) : undefined}
          onChange={(v) => setFilter({ list_role_id: v ? Number(v) : undefined })}
          options={listRoles.map((r) => [String(r.id), r.name])}
        />
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

        {canManage && selected.size > 0 ? (
          <div className="ml-auto flex items-center gap-3">
            <span className="text-muted-foreground text-sm">
              {t('globals.messages.numSelected', { num: selected.size })}
            </span>
            <Button
              variant="destructive"
              size="sm"
              data-testid="btn-delete-users"
              onClick={onDeleteSelected}
            >
              <Trash2 /> {t('globals.buttons.delete')} {selected.size}
            </Button>
          </div>
        ) : null}
      </div>

      {error ? (
        <p className="text-destructive text-sm">{error.message}</p>
      ) : (
        <DataTable
          columns={columns}
          rows={rows}
          getRowId={(u) => u.id}
          loading={isPending}
          rowTestId="user-row"
          selection={canManage ? { selected, onChange: setSelected } : undefined}
          selectAllLabel={t('globals.buttons.toggleSelect')}
          selectRowLabel={(u) => userLabel(u)}
          empty={<EmptyState icon={UserRound} title={t('globals.messages.emptyState')} />}
        />
      )}
    </>
  );
}

function uniqueBy<T extends { id: number }>(xs: T[]): T[] {
  return [...new Map(xs.map((x) => [x.id, x])).values()].sort((a, b) =>
    String((a as { name?: string }).name).localeCompare(String((b as { name?: string }).name)),
  );
}

function FilterSelect({
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
