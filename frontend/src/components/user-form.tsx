import { zodResolver } from '@hookform/resolvers/zod';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { Copy } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { toast } from 'sonner';
import { useCan, useT } from '@/components/app-context';
import { PageHeader } from '@/components/page-header';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
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
import { listRolesQuery, userRolesQuery } from '@/lib/roles';
import {
  userFormDefaults,
  userFormSchema,
  userPayload,
  type UserFormValues,
} from '@/lib/user-form';
import { userLabel, type User } from '@/lib/users';

const NONE = 'none';

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="bg-card rounded-xl border p-6">
      <h2 className="mb-4 text-sm font-semibold">{title}</h2>
      <div className="flex flex-col gap-5">{children}</div>
    </section>
  );
}

// The add / edit form for a user (existing = edit).
export function UserForm({ user }: { user?: User }) {
  const t = useT();
  const can = useCan();
  const navigate = useNavigate();
  const isNew = !user;
  const canSave = can('users:manage');
  const roles = useQuery(userRolesQuery).data ?? [];
  const listRoles = useQuery(listRolesQuery).data ?? [];
  const [token, setToken] = useState<{ value: string; name: string } | null>(null);

  const schema = useMemo(() => userFormSchema(isNew), [isNew]);
  const form = useForm<UserFormValues>({
    resolver: zodResolver(schema),
    values: userFormDefaults(user, roles[0]?.id),
  });
  const type = useWatch({ control: form.control, name: 'type' });
  const passwordLogin = useWatch({ control: form.control, name: 'password_login' });

  const goToList = () => void navigate({ to: '/users', search: {} });

  const save = useApiMutation({
    mutationFn: async (v: UserFormValues) =>
      isNew
        ? apiFetch<User & { password?: string }>('/api/users', {
            method: 'POST',
            body: JSON.stringify(userPayload(v)),
          })
        : apiFetch<User>(`/api/users/${user.id}`, {
            method: 'PUT',
            body: JSON.stringify(userPayload(v)),
          }),
    invalidate: [['users']],
    onSuccess: (u) => {
      if (isNew && u.type === 'api') {
        // The token is shown once; the list opens when the dialog is dismissed.
        setToken({ value: (u as { password?: string }).password ?? '', name: userLabel(u) });
        return;
      }
      toast.success(
        t(isNew ? 'globals.messages.created' : 'globals.messages.updated', { name: userLabel(u) }),
      );
      if (isNew) goToList();
    },
  });

  // Dismissing the one-time token dialog finishes the creation: toast, then the list.
  const closeToken = () => {
    const name = token?.name ?? '';
    setToken(null);
    toast.success(t('globals.messages.created', { name }));
    goToList();
  };

  const copy = (text: string) => {
    void navigator.clipboard?.writeText(text);
    toast.success(t('globals.messages.copied'));
  };

  return (
    <>
      <PageHeader
        title={isNew ? t('users.newUser') : userLabel(user)}
        actions={
          user ? (
            <UserAvatar name={userLabel(user)} src={user.avatar} className="size-10" />
          ) : undefined
        }
      />
      <Form {...form}>
        <form
          onSubmit={form.handleSubmit((v) => canSave && save.mutate(v))}
          className="flex max-w-2xl flex-col gap-6"
          noValidate
        >
          <Section title={t('users.profile')}>
            <FormField
              control={form.control}
              name="type"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('users.type')}</FormLabel>
                  <Select
                    value={field.value}
                    onValueChange={field.onChange}
                    disabled={!isNew || !canSave}
                  >
                    <FormControl>
                      <SelectTrigger className="w-full" data-testid="user-type">
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="user">{t('users.type.user')}</SelectItem>
                      <SelectItem value="api">{t('users.type.api')}</SelectItem>
                    </SelectContent>
                  </Select>
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="username"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('users.username')}</FormLabel>
                  <FormControl>
                    <Input {...field} autoComplete="off" maxLength={200} disabled={!canSave} />
                  </FormControl>
                  <FormDescription>{t('users.usernameHelp')}</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('globals.fields.name')}</FormLabel>
                  <FormControl>
                    <Input {...field} maxLength={200} disabled={!canSave} />
                  </FormControl>
                </FormItem>
              )}
            />
            {type !== 'api' ? (
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('subscribers.email')}</FormLabel>
                    <FormControl>
                      <Input {...field} type="email" maxLength={200} disabled={!canSave} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            ) : null}
            <FormField
              control={form.control}
              name="status"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('globals.fields.status')}</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange} disabled={!canSave}>
                    <FormControl>
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="enabled">{t('users.status.enabled')}</SelectItem>
                      <SelectItem value="disabled">{t('users.status.disabled')}</SelectItem>
                    </SelectContent>
                  </Select>
                </FormItem>
              )}
            />
          </Section>

          {type !== 'api' ? (
            <Section title={t('users.password')}>
              <FormField
                control={form.control}
                name="password_login"
                render={({ field }) => (
                  <FormItem className="flex items-center gap-2">
                    <FormControl>
                      <Checkbox
                        checked={field.value}
                        onCheckedChange={(c) => field.onChange(c === true)}
                        disabled={!canSave}
                        data-testid="password-login"
                      />
                    </FormControl>
                    <FormLabel className="mt-0!">{t('users.passwordEnable')}</FormLabel>
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('users.password')}</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        type="password"
                        autoComplete="new-password"
                        maxLength={200}
                        disabled={!passwordLogin || !canSave}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="password2"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('users.passwordRepeat')}</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        type="password"
                        autoComplete="new-password"
                        maxLength={200}
                        disabled={!passwordLogin || !canSave}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </Section>
          ) : null}

          <Section title={t.tc('users.roles', 2)}>
            <FormField
              control={form.control}
              name="user_role_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t.tc('users.userRole', 1)}</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange} disabled={!canSave}>
                    <FormControl>
                      <SelectTrigger className="w-full" data-testid="user-role">
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {roles.map((r) => (
                        <SelectItem key={r.id} value={String(r.id)}>
                          {r.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="list_role_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t.tc('users.listRole', 1)}</FormLabel>
                  <Select
                    value={field.value || NONE}
                    onValueChange={(v) => field.onChange(v === NONE ? '' : v)}
                    disabled={!canSave}
                  >
                    <FormControl>
                      <SelectTrigger className="w-full" data-testid="list-role">
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value={NONE}>— {t('globals.terms.none')} —</SelectItem>
                      {listRoles.map((r) => (
                        <SelectItem key={r.id} value={String(r.id)}>
                          {r.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </FormItem>
              )}
            />
          </Section>

          <div className="flex items-center justify-between">
            {user ? (
              <Button type="button" variant="ghost" size="sm" onClick={() => copy(String(user.id))}>
                <span className="text-muted-foreground">{t('globals.fields.id')}</span> {user.id}
                <Copy />
              </Button>
            ) : (
              <span />
            )}
            {canSave ? (
              <Button type="submit" disabled={save.isPending} data-testid="btn-save">
                {t('globals.buttons.save')}
              </Button>
            ) : null}
          </div>
        </form>
      </Form>

      <Dialog open={token !== null} onOpenChange={(open) => !open && closeToken()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('users.type.api')}</DialogTitle>
            <DialogDescription>{t('users.apiOneTimeToken')}</DialogDescription>
          </DialogHeader>
          <Button
            type="button"
            variant="secondary"
            className="h-auto w-full justify-between font-mono text-xs break-all whitespace-normal"
            onClick={() => token && copy(token.value)}
          >
            <span data-testid="api-token">{token?.value}</span>
            <Copy />
          </Button>
          <DialogFooter>
            <Button onClick={closeToken}>{t('globals.buttons.close')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
