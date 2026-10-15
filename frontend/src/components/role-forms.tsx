import { useQuery } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { AlertTriangle, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { useApp, useCan, useT } from '@/components/app-context';
import { PageHeader } from '@/components/page-header';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
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
import { useApiMutation } from '@/hooks/use-api-mutation';
import { apiFetch } from '@/lib/api';
import { listsMinimalQuery } from '@/lib/lists';
import {
  HIGH_RISK_PERMISSIONS,
  LIST_PERMS,
  SUPER_ADMIN_ROLE_ID,
  availableLists,
  defaultUserPerms,
  listRolesQuery,
  toggleAllPerms,
  togglePerm,
  userRolesQuery,
  type ListPerm,
  type ListRoleFull,
  type UserRoleFull,
} from '@/lib/roles';

const DOCS = 'https://listmonk.app/docs/roles-and-permissions';

function Card({ title, children }: { title?: string; children: React.ReactNode }) {
  return (
    <section className="bg-card flex flex-col gap-5 rounded-xl border p-6">
      {title ? <h2 className="text-sm font-semibold">{title}</h2> : null}
      {children}
    </section>
  );
}

function NameField({
  value,
  onChange,
  disabled,
}: {
  value: string;
  onChange: (v: string) => void;
  disabled: boolean;
}) {
  const t = useT();
  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor="role-name">{t('globals.fields.name')}</Label>
      <Input
        id="role-name"
        name="name"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        maxLength={200}
        required
        disabled={disabled}
      />
    </div>
  );
}

function FormFooter({ id, canSave, saving }: { id?: number; canSave: boolean; saving: boolean }) {
  const t = useT();
  return (
    <div className="flex items-center justify-between">
      <div className="text-muted-foreground flex items-center gap-4 text-sm">
        {id ? (
          <span>
            {t('globals.fields.id')} {id}
          </span>
        ) : null}
        <a href={DOCS} target="_blank" rel="noopener noreferrer" className="hover:text-foreground">
          {t('globals.buttons.learnMore')}
        </a>
      </div>
      {canSave ? (
        <Button type="submit" disabled={saving} data-testid="btn-save">
          {t('globals.buttons.save')}
        </Button>
      ) : null}
    </div>
  );
}

// ---- User role ----------------------------------------------------------

export function UserRoleForm({ id }: { id?: number }) {
  const t = useT();
  const { config } = useApp();
  const can = useCan();
  const navigate = useNavigate();
  const { data: roles } = useQuery(userRolesQuery);
  const role: UserRoleFull | undefined = id ? roles?.find((r) => r.id === id) : undefined;

  if (id && !roles) return <Skeleton className="h-64 max-w-3xl" />;
  if (id && !role)
    return (
      <p className="text-destructive text-sm">
        {t('globals.messages.notFound', { name: t('users.role') })}
      </p>
    );

  const groups = config.permissions;
  const disabled = !can('roles:manage') || role?.id === SUPER_ADMIN_ROLE_ID;
  return (
    <UserRoleFormBody
      key={role?.id ?? 'new'}
      role={role}
      groups={groups}
      disabled={disabled}
      navigate={navigate}
    />
  );
}

function UserRoleFormBody({
  role,
  groups,
  disabled,
  navigate,
}: {
  role?: UserRoleFull;
  groups: { group: string; permissions: string[] }[];
  disabled: boolean;
  navigate: ReturnType<typeof useNavigate>;
}) {
  const t = useT();
  const [name, setName] = useState(role?.name ?? '');
  const [perms, setPerms] = useState<string[]>(role ? role.permissions : defaultUserPerms(groups));

  const save = useApiMutation({
    mutationFn: () =>
      apiFetch<UserRoleFull>(role ? `/api/roles/users/${role.id}` : '/api/roles/users', {
        method: role ? 'PUT' : 'POST',
        body: JSON.stringify({ name, permissions: perms }),
      }),
    invalidate: [['roles'], ['users']],
    onSuccess: (r) => {
      toast.success(
        t(role ? 'globals.messages.updated' : 'globals.messages.created', { name: r.name }),
      );
      if (!role) void navigate({ to: '/users/roles' });
    },
  });

  return (
    <>
      <PageHeader title={role ? role.name : t('users.newUserRole')} />
      <form
        className="flex max-w-3xl flex-col gap-6"
        onSubmit={(e) => {
          e.preventDefault();
          if (!disabled) save.mutate();
        }}
      >
        <Card>
          <NameField value={name} onChange={setName} disabled={disabled} />
        </Card>
        <Card>
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold">{t('users.perms')}</h2>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={disabled}
              onClick={() => setPerms(toggleAllPerms(perms, groups))}
            >
              {t('globals.buttons.toggleSelect')}
            </Button>
          </div>
          <div className="flex flex-col divide-y">
            {groups.map((g) => (
              <fieldset
                key={g.group}
                className="grid gap-3 py-4 first:pt-0 last:pb-0 sm:grid-cols-[10rem_1fr]"
              >
                <legend className="sr-only">{t(`globals.terms.${g.group}`)}</legend>
                <div className="text-sm font-medium" aria-hidden>
                  {t(`globals.terms.${g.group}`)}
                </div>
                <div className="flex flex-col gap-2.5">
                  {g.permissions.map((p) => {
                    const risky = HIGH_RISK_PERMISSIONS.includes(p);
                    return (
                      <div key={p} className="flex items-center gap-2">
                        <Checkbox
                          id={`perm-${p}`}
                          checked={perms.includes(p)}
                          disabled={disabled}
                          onCheckedChange={() => setPerms(togglePerm(perms, p))}
                        />
                        <Label
                          htmlFor={`perm-${p}`}
                          className={
                            risky
                              ? 'text-danger-foreground font-mono text-[13px]'
                              : 'font-mono text-[13px]'
                          }
                        >
                          {p}
                        </Label>
                        {risky ? (
                          <a
                            href={`${DOCS}/#${p === 'users:manage' ? ':~:text=users:manage' : 'subscriberssql_query'}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-danger-foreground"
                            aria-label="Warning: high risk permission"
                          >
                            <AlertTriangle className="size-4" />
                          </a>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              </fieldset>
            ))}
          </div>
        </Card>
        <FormFooter id={role?.id} canSave={!disabled} saving={save.isPending} />
      </form>
    </>
  );
}

// ---- List role ----------------------------------------------------------

export function ListRoleForm({ id }: { id?: number }) {
  const t = useT();
  const can = useCan();
  const navigate = useNavigate();
  const { data: roles } = useQuery(listRolesQuery);
  const { data: lists } = useQuery(listsMinimalQuery);
  const role: ListRoleFull | undefined = id ? roles?.find((r) => r.id === id) : undefined;

  if ((id && !roles) || !lists) return <Skeleton className="h-64 max-w-3xl" />;
  if (id && !role)
    return (
      <p className="text-destructive text-sm">
        {t('globals.messages.notFound', { name: t('users.role') })}
      </p>
    );

  return (
    <ListRoleFormBody
      key={role?.id ?? 'new'}
      role={role}
      allLists={lists}
      disabled={!can('roles:manage')}
      navigate={navigate}
    />
  );
}

function ListRoleFormBody({
  role,
  allLists,
  disabled,
  navigate,
}: {
  role?: ListRoleFull;
  allLists: { id: number; name: string }[];
  disabled: boolean;
  navigate: ReturnType<typeof useNavigate>;
}) {
  const t = useT();
  const [name, setName] = useState(role?.name ?? '');
  const [chosen, setChosen] = useState<ListPerm[]>(
    (role?.lists ?? []).map((l) => ({ id: l.id, name: l.name, permissions: [...l.permissions] })),
  );
  const free = availableLists(allLists, chosen);
  const [cur, setCur] = useState<string>('');
  const curId = free.some((l) => String(l.id) === cur) ? cur : String(free[0]?.id ?? '');

  const save = useApiMutation({
    mutationFn: () =>
      apiFetch<ListRoleFull>(role ? `/api/roles/lists/${role.id}` : '/api/roles/lists', {
        method: role ? 'PUT' : 'POST',
        body: JSON.stringify({
          name,
          lists: chosen.map((l) => ({ id: l.id, permissions: l.permissions })),
        }),
      }),
    invalidate: [['roles'], ['users']],
    onSuccess: (r) => {
      toast.success(
        t(role ? 'globals.messages.updated' : 'globals.messages.created', { name: r.name }),
      );
      if (!role) void navigate({ to: '/users/roles/lists' });
    },
  });

  const add = () => {
    const l = free.find((x) => String(x.id) === curId);
    if (l) setChosen([...chosen, { id: l.id, name: l.name, permissions: [...LIST_PERMS] }]);
  };
  const setPerm = (id: number, perm: string) =>
    setChosen(
      chosen.map((l) => (l.id === id ? { ...l, permissions: togglePerm(l.permissions, perm) } : l)),
    );

  return (
    <>
      <PageHeader title={role ? role.name : t('users.newListRole')} />
      <form
        className="flex max-w-3xl flex-col gap-6"
        onSubmit={(e) => {
          e.preventDefault();
          if (!disabled) save.mutate();
        }}
      >
        <Card title={t.tc('users.listRole', 1)}>
          <NameField value={name} onChange={setName} disabled={disabled} />
        </Card>
        <Card title={t('globals.terms.lists')}>
          <div className="flex items-end gap-2">
            <div className="flex flex-1 flex-col gap-2">
              <Label>{t.tc('globals.terms.list', 1)}</Label>
              <Select value={curId} onValueChange={setCur} disabled={disabled || free.length === 0}>
                <SelectTrigger className="w-full" aria-label={t.tc('globals.terms.list', 1)}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {free.map((l) => (
                    <SelectItem key={l.id} value={String(l.id)}>
                      {l.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button
              type="button"
              variant="outline"
              onClick={add}
              disabled={disabled || !curId}
              data-testid="btn-add-list"
            >
              <Plus /> {t('globals.buttons.add')}
            </Button>
          </div>
          {chosen.length === 0 ? (
            <p className="text-muted-foreground py-4 text-center text-sm">
              {t('globals.messages.emptyState')}
            </p>
          ) : (
            <ul className="divide-y rounded-lg border" data-testid="role-lists">
              {chosen.map((l) => (
                <li
                  key={l.id}
                  className="flex items-center gap-4 px-4 py-3"
                  data-testid="role-list-row"
                >
                  <span className="flex-1 truncate text-sm font-medium">{l.name}</span>
                  {LIST_PERMS.map((perm) => (
                    <div key={perm} className="flex items-center gap-2">
                      <Checkbox
                        id={`${l.id}-${perm}`}
                        checked={l.permissions.includes(perm)}
                        disabled={disabled}
                        onCheckedChange={() => setPerm(l.id, perm)}
                        data-perm={perm}
                      />
                      <Label htmlFor={`${l.id}-${perm}`} className="text-sm font-normal">
                        {t(perm === 'list:get' ? 'globals.buttons.view' : 'globals.buttons.manage')}
                      </Label>
                    </div>
                  ))}
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    disabled={disabled}
                    aria-label={`${t('globals.buttons.delete')} ${l.name}`}
                    onClick={() => setChosen(chosen.filter((x) => x.id !== l.id))}
                  >
                    <Trash2 />
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </Card>
        <FormFooter id={role?.id} canSave={!disabled} saving={save.isPending} />
      </form>
    </>
  );
}
