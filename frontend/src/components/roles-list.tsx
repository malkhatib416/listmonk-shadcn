import { useQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import {
  Copy,
  ListChecks,
  MoreHorizontal,
  Pencil,
  Plus,
  Search,
  ShieldCheck,
  Trash2,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { useApp, useCan, useT } from '@/components/app-context';
import { useConfirm } from '@/components/confirm-dialog';
import { DataTable, type Column } from '@/components/data-table';
import { EmptyState } from '@/components/empty-state';
import { PageHeader } from '@/components/page-header';
import { PromptDialog } from '@/components/prompt-dialog';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { useApiMutation } from '@/hooks/use-api-mutation';
import { apiFetch } from '@/lib/api';
import { formatDate } from '@/lib/format';
import {
  SUPER_ADMIN_ROLE_ID,
  listRolesQuery,
  userRolesQuery,
  type ListRoleFull,
  type UserRoleFull,
} from '@/lib/roles';

type Role = UserRoleFull | ListRoleFull;
type Kind = 'user' | 'list';

const API = { user: '/api/roles/users', list: '/api/roles/lists' } as const;

// The list of user roles or list roles (same shape, different endpoint and form).
export function RolesList({ kind }: { kind: Kind }) {
  const t = useT();
  const can = useCan();
  const confirm = useConfirm();
  const { config } = useApp();
  const canManage = can('roles:manage');
  const userRoles = useQuery({ ...userRolesQuery, enabled: kind === 'user' });
  const listRoles = useQuery({ ...listRolesQuery, enabled: kind === 'list' });
  const { isPending, error } = kind === 'user' ? userRoles : listRoles;
  const data: Role[] | undefined = kind === 'user' ? userRoles.data : listRoles.data;
  const [query, setQuery] = useState('');
  const [cloning, setCloning] = useState<Role | null>(null);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (data ?? []).filter((r) => !q || r.name.toLowerCase().includes(q));
  }, [data, query]);

  const invalidate = [['roles']];
  const del = useApiMutation({
    mutationFn: (r: Role) => apiFetch(`/api/roles/${r.id}`, { method: 'DELETE' }),
    invalidate,
    success: (_d, r) => t('globals.messages.deleted', { name: r.name }),
  });
  const clone = useApiMutation({
    mutationFn: ({ role, name }: { role: Role; name: string }) =>
      apiFetch(API[kind], {
        method: 'POST',
        body: JSON.stringify(
          kind === 'list'
            ? {
                name,
                lists: ((role as ListRoleFull).lists ?? []).map((l) => ({
                  id: l.id,
                  permissions: l.permissions,
                })),
              }
            : { name, permissions: (role as UserRoleFull).permissions },
        ),
      }),
    invalidate,
    success: (_d, v) => t('globals.messages.created', { name: v.name }),
    onSuccess: () => setCloning(null),
  });

  const base = kind === 'user' ? '/users/roles' : '/users/roles/lists';
  const toEdit = kind === 'user' ? '/users/roles/$id' : '/users/roles/lists/$id';
  const RoleIcon = kind === 'user' ? ShieldCheck : ListChecks;
  const icon = <RoleIcon className="size-4" />;

  const columns: Column<Role>[] = [
    {
      id: 'name',
      header: t.tc('users.role', 1),
      compare: (a, b) => a.name.localeCompare(b.name),
      cell: (r) => (
        <div className="flex items-center gap-3">
          <span className="bg-info text-info-foreground flex size-8 items-center justify-center rounded-full">
            {icon}
          </span>
          <Link
            to={toEdit}
            params={{ id: String(r.id) }}
            className={
              r.id === SUPER_ADMIN_ROLE_ID && kind === 'user'
                ? 'font-semibold hover:underline'
                : 'font-medium hover:underline'
            }
          >
            {r.name}
          </Link>
        </div>
      ),
    },
    {
      id: 'created_at',
      header: t('globals.fields.createdAt'),
      compare: (a, b) => a.created_at.localeCompare(b.created_at),
      cell: (r) => (
        <span className="text-muted-foreground">{formatDate(r.created_at, config.lang)}</span>
      ),
    },
    {
      id: 'updated_at',
      header: t('globals.fields.updatedAt'),
      compare: (a, b) => a.updated_at.localeCompare(b.updated_at),
      cell: (r) => (
        <span className="text-muted-foreground">{formatDate(r.updated_at, config.lang)}</span>
      ),
    },
    ...(canManage
      ? [
          {
            id: 'actions',
            header: <span className="sr-only">{t('globals.buttons.more')}</span>,
            className: 'w-12 text-right',
            cell: (r: Role) => (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" aria-label={t('globals.buttons.more')}>
                    <MoreHorizontal />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem asChild data-testid="btn-edit">
                    <Link to={toEdit} params={{ id: String(r.id) }}>
                      <Pencil /> {t('globals.buttons.edit')}
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem data-testid="btn-clone" onClick={() => setCloning(r)}>
                    <Copy /> {t('globals.buttons.clone')}
                  </DropdownMenuItem>
                  {r.id !== SUPER_ADMIN_ROLE_ID || kind === 'list' ? (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        variant="destructive"
                        data-testid="btn-delete"
                        onClick={async () => {
                          const ok = await confirm({
                            title: t('globals.buttons.delete'),
                            description: t('globals.messages.confirm'),
                            confirmLabel: t('globals.buttons.delete'),
                            destructive: true,
                          });
                          if (ok) del.mutate(r);
                        }}
                      >
                        <Trash2 /> {t('globals.buttons.delete')}
                      </DropdownMenuItem>
                    </>
                  ) : null}
                </DropdownMenuContent>
              </DropdownMenu>
            ),
          } satisfies Column<Role>,
        ]
      : []),
  ];

  return (
    <>
      <PageHeader
        title={t(kind === 'user' ? 'users.userRoles' : 'users.listRoles')}
        description={isPending ? undefined : String(data?.length ?? 0)}
        actions={
          canManage ? (
            <Button asChild data-testid="btn-new">
              <Link to={`${base}/new` as '/users/roles/new'}>
                <Plus /> {t('globals.buttons.new')}
              </Link>
            </Button>
          ) : null
        }
      />
      <div className="relative mb-4 w-full sm:w-72">
        <Search className="text-muted-foreground absolute top-1/2 left-3 size-4 -translate-y-1/2" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t('globals.buttons.search')}
          aria-label={t('globals.buttons.search')}
          data-testid="query"
          className="pl-9"
        />
      </div>
      {error ? (
        <p className="text-destructive text-sm">{error.message}</p>
      ) : (
        <DataTable
          columns={columns}
          rows={rows}
          getRowId={(r) => r.id}
          loading={isPending}
          rowTestId="role-row"
          empty={<EmptyState icon={RoleIcon} title={t('globals.messages.emptyState')} />}
        />
      )}

      <PromptDialog
        open={cloning !== null}
        title={t('globals.buttons.clone')}
        initial={cloning ? t('campaigns.copyOf', { name: cloning.name }) : ''}
        confirmLabel={t('globals.buttons.clone')}
        busy={clone.isPending}
        onClose={() => setCloning(null)}
        onSubmit={(name) => cloning && clone.mutate({ role: cloning, name })}
      />
    </>
  );
}
