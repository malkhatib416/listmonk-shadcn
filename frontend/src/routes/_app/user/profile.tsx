import { zodResolver } from '@hookform/resolvers/zod';
import { useQueryClient } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';
import { CheckCircle2, Copy } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';
import { useApp, useT } from '@/components/app-context';
import { PageHeader } from '@/components/page-header';
import { StatusBadge } from '@/components/status-badge';
import { Button } from '@/components/ui/button';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { UserAvatar } from '@/components/user-avatar';
import { useApiMutation } from '@/hooks/use-api-mutation';
import { apiFetch } from '@/lib/api';
import { userLabel } from '@/lib/users';

export const Route = createFileRoute('/_app/user/profile')({
  head: () => ({ meta: [{ title: 'Profile - listmonk' }] }),
  component: ProfilePage,
});

const schema = z
  .object({
    name: z.string().max(200),
    email: z.string().max(200),
    password: z.string().max(200),
    password2: z.string().max(200),
  })
  .superRefine((v, ctx) => {
    if (v.password && v.password.length < 8) {
      ctx.addIssue({
        code: 'custom',
        path: ['password'],
        message: 'globals.messages.invalidFields',
      });
    }
    if (v.password !== v.password2) {
      ctx.addIssue({ code: 'custom', path: ['password2'], message: 'users.passwordMismatch' });
    }
  });
type Values = z.infer<typeof schema>;

function ProfilePage() {
  const t = useT();
  const { user } = useApp();
  const qc = useQueryClient();
  const isAPI = user.type === 'api';
  const passwordLogin = user.password_login ?? false;

  const form = useForm<Values>({
    resolver: zodResolver(schema),
    values: { name: user.name ?? '', email: user.email ?? '', password: '', password2: '' },
  });

  const save = useApiMutation({
    mutationFn: (v: Values) =>
      apiFetch<{ username: string }>('/api/profile', {
        method: 'PUT',
        body: JSON.stringify({
          name: v.name,
          email: v.email,
          ...(v.password ? { password: v.password, password2: v.password2 } : {}),
        }),
      }),
    invalidate: [['bootstrap']],
    success: (d) => t('globals.messages.updated', { name: d.username }),
    onSuccess: () => form.reset({ ...form.getValues(), password: '', password2: '' }),
  });

  return (
    <>
      <PageHeader
        title={t('users.profile')}
        actions={
          <div className="flex items-center gap-3">
            <StatusBadge tone="info">{user.user_role.name}</StatusBadge>
            <UserAvatar name={userLabel(user)} src={user.avatar} className="size-10" />
          </div>
        }
      />
      <div className="flex max-w-2xl flex-col gap-6">
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit((v) => save.mutate(v))}
            className="bg-card flex flex-col gap-5 rounded-xl border p-6"
            noValidate
          >
            <p className="text-muted-foreground text-sm">@{user.username}</p>
            {!isAPI ? (
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('subscribers.email')}</FormLabel>
                    <FormControl>
                      <Input {...field} type="email" maxLength={200} disabled={!passwordLogin} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            ) : null}
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('globals.fields.name')}</FormLabel>
                  <FormControl>
                    <Input {...field} maxLength={200} />
                  </FormControl>
                </FormItem>
              )}
            />
            {passwordLogin ? (
              <div className="grid gap-5 sm:grid-cols-2">
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
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            ) : null}
            <div className="flex justify-end">
              <Button type="submit" disabled={save.isPending} data-cy="btn-save">
                {t('globals.buttons.save')}
              </Button>
            </div>
          </form>
        </Form>

        {passwordLogin ? (
          <TwoFactor
            userId={user.id}
            enabled={user.twofa_type === 'totp'}
            onChanged={() => qc.invalidateQueries({ queryKey: ['bootstrap'] })}
          />
        ) : null}
      </div>
    </>
  );
}

function TwoFactor({
  userId,
  enabled,
  onChanged,
}: {
  userId: number;
  enabled: boolean;
  onChanged: () => unknown;
}) {
  const t = useT();
  const [setup, setSetup] = useState<{ qr: string; secret: string } | null>(null);
  const [code, setCode] = useState('');
  const [disabling, setDisabling] = useState(false);
  const [password, setPassword] = useState('');

  const begin = useApiMutation({
    mutationFn: () => apiFetch<{ qr: string; secret: string }>(`/api/users/${userId}/twofa/totp`),
    onSuccess: setSetup,
  });
  const confirmTotp = useApiMutation({
    mutationFn: () =>
      apiFetch(`/api/users/${userId}/twofa`, {
        method: 'PUT',
        body: JSON.stringify({ secret: setup?.secret, code }),
      }),
    success: () => t('users.twoFAEnabled'),
    onSuccess: () => {
      setSetup(null);
      setCode('');
      void onChanged();
    },
  });
  const disable = useApiMutation({
    mutationFn: () =>
      apiFetch(`/api/users/${userId}/twofa`, {
        method: 'DELETE',
        body: JSON.stringify({ password }),
      }),
    success: () => t('globals.messages.done'),
    onSuccess: () => {
      setDisabling(false);
      setPassword('');
      void onChanged();
    },
  });

  const toggle = (on: boolean) => {
    if (enabled) setDisabling(!on);
    else if (on) begin.mutate();
    else {
      setSetup(null);
      setCode('');
    }
  };

  return (
    <section className="bg-card flex flex-col gap-4 rounded-xl border p-6">
      <div className="flex items-center justify-between gap-4">
        <h2 className="flex items-center gap-2 text-sm font-semibold">
          {enabled ? <CheckCircle2 className="text-success-foreground size-4" /> : null}
          {enabled ? t('users.twoFAEnabled') : t('users.twoFA')}
        </h2>
        <Switch
          aria-label={t('users.twoFA')}
          checked={enabled ? !disabling : setup !== null}
          onCheckedChange={toggle}
        />
      </div>
      <p className="text-muted-foreground text-sm">
        {enabled ? t('users.twoFAEnabledDesc', { type: 'TOTP' }) : t('users.twoFANotEnabled')}
      </p>

      {disabling ? (
        <form
          className="flex flex-col gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            if (password) disable.mutate();
          }}
        >
          <label className="flex flex-col gap-2 text-sm font-medium">
            {t('users.password')}
            <Input
              type="password"
              minLength={8}
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </label>
          <div className="flex gap-2">
            <Button type="submit" variant="destructive" disabled={disable.isPending}>
              {t('globals.buttons.disable')}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setDisabling(false);
                setPassword('');
              }}
            >
              {t('globals.buttons.cancel')}
            </Button>
          </div>
        </form>
      ) : null}

      {setup ? (
        <div className="flex flex-col gap-4">
          <figure className="flex flex-col gap-2">
            <img
              className="size-44 rounded-lg border bg-white p-2"
              src={`data:image/png;base64,${setup.qr}`}
              alt="QR code"
            />
            <figcaption className="text-muted-foreground text-xs">
              {t('users.totpScanQR')}
            </figcaption>
          </figure>
          <div className="flex flex-col gap-2">
            <span className="text-sm font-medium">{t('users.totpSecret')}</span>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className="w-fit font-mono"
              onClick={() => {
                void navigator.clipboard?.writeText(setup.secret);
                toast.success(t('globals.messages.copied'));
              }}
            >
              {setup.secret} <Copy />
            </Button>
          </div>
          <form
            className="flex flex-col gap-3"
            onSubmit={(e) => {
              e.preventDefault();
              if (/^\d{6}$/.test(code)) confirmTotp.mutate();
              else toast.error(t('globals.messages.invalidValue'));
            }}
          >
            <label className="flex flex-col gap-2 text-sm font-medium">
              {t('users.totpCode')}
              <Input
                value={code}
                onChange={(e) => setCode(e.target.value)}
                maxLength={6}
                pattern="[0-9]{6}"
                placeholder="000000"
                inputMode="numeric"
                required
                className="w-40 font-mono tracking-widest"
              />
            </label>
            <div className="flex gap-2">
              <Button type="submit" disabled={confirmTotp.isPending}>
                {t('globals.buttons.enable')}
              </Button>
              <Button type="button" variant="outline" onClick={() => toggle(false)}>
                {t('globals.buttons.cancel')}
              </Button>
            </div>
          </form>
        </div>
      ) : null}
    </section>
  );
}
