import { useQuery } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';
import { Download, Trash2 } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { toast } from 'sonner';
import { useCan, useT } from '@/components/app-context';
import { useConfirm } from '@/components/confirm-dialog';
import { PageHeader } from '@/components/page-header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { useApiMutation } from '@/hooks/use-api-mutation';
import { apiFetch } from '@/lib/api';
import { daysAgo, exportUrl, toRFC3339 } from '@/lib/maintenance';
import { waitForRestart } from '@/lib/restart';

export const Route = createFileRoute('/_app/settings/maintenance')({
  head: () => ({ meta: [{ title: 'Maintenance - listmonk' }] }),
  component: MaintenancePage,
});

interface DBSettings {
  vacuum: boolean;
  vacuum_cron_interval: string;
}

function Block({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="bg-card flex flex-col gap-5 rounded-xl border p-6">
      <h2 className="text-sm font-semibold">{title}</h2>
      {children}
    </section>
  );
}

function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <div className="flex min-w-48 flex-1 flex-col gap-2">
      <Label>{label}</Label>
      {children}
      {hint ? <p className="text-muted-foreground text-xs">{hint}</p> : null}
    </div>
  );
}

function Choice({
  value,
  onChange,
  options,
  label,
}: {
  value: string;
  onChange: (v: string) => void;
  options: [string, string][];
  label: string;
}) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="w-full" aria-label={label}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {options.map(([v, l]) => (
          <SelectItem key={v} value={v}>
            {l}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function MaintenancePage() {
  const t = useT();
  const can = useCan();
  const confirm = useConfirm();

  const [subscriberType, setSubscriberType] = useState('orphan');
  const [subscriptionDate, setSubscriptionDate] = useState(daysAgo(7));
  const [analyticsType, setAnalyticsType] = useState('all');
  const [analyticsDate, setAnalyticsDate] = useState(daysAgo(7));
  const [exportType, setExportType] = useState('views');
  const [exportDate, setExportDate] = useState(daysAgo(30));

  const subscriberOptions: [string, string][] = [
    ['orphan', t('dashboard.orphanSubs')],
    ['blocklisted', t('subscribers.status.blocklisted')],
  ];
  const analyticsOptions: [string, string][] = [
    ['all', t('globals.terms.all')],
    ['views', t('dashboard.campaignViews')],
    ['clicks', t('dashboard.linkClicks')],
  ];
  const label = (opts: [string, string][], v: string) => opts.find(([k]) => k === v)?.[1] ?? v;

  // Every delete states exactly what will go before it runs.
  const ask = (what: string, olderThan?: string) =>
    confirm({
      title: t('globals.buttons.delete'),
      description: olderThan ? `${what} — ${t('maintenance.olderThan')} ${olderThan}` : what,
      confirmLabel: t('globals.buttons.delete'),
      destructive: true,
    });

  const delSubscribers = useApiMutation({
    mutationFn: () =>
      apiFetch<{ count: number }>(`/api/maintenance/subscribers/${subscriberType}`, {
        method: 'DELETE',
      }),
    success: (d) =>
      t('globals.messages.deletedCount', {
        name: t.tc('globals.terms.subscribers', 2),
        num: d.count,
      }),
  });
  const delSubscriptions = useApiMutation({
    mutationFn: () =>
      apiFetch<{ count: number }>(
        `/api/maintenance/subscriptions/unconfirmed?before_date=${encodeURIComponent(toRFC3339(subscriptionDate))}`,
        { method: 'DELETE' },
      ),
    success: (d) =>
      t('globals.messages.deletedCount', {
        name: t.tc('globals.terms.subscriptions', 2),
        num: d.count,
      }),
  });
  const delAnalytics = useApiMutation({
    mutationFn: () =>
      apiFetch(
        `/api/maintenance/analytics/${analyticsType}?before_date=${encodeURIComponent(toRFC3339(analyticsDate))}`,
        {
          method: 'DELETE',
        },
      ),
    success: () => t('globals.messages.done'),
  });

  const exportHref = exportUrl(window._LM_ROOT, exportType, exportDate);

  return (
    <>
      <PageHeader title={t('maintenance.title')} description={t('maintenance.help')} />
      <div className="flex max-w-4xl flex-col gap-6">
        <Block title={t('globals.terms.subscribers')}>
          <div className="flex flex-wrap items-end gap-4">
            <Field label="Data" hint={t('maintenance.orphanHelp')}>
              <Choice
                label="Data"
                value={subscriberType}
                onChange={setSubscriberType}
                options={subscriberOptions}
              />
            </Field>
            <Button
              variant="destructive"
              data-cy="btn-delete-subscribers"
              disabled={delSubscribers.isPending}
              onClick={async () => {
                if (await ask(label(subscriberOptions, subscriberType))) delSubscribers.mutate();
              }}
            >
              <Trash2 /> {t('globals.buttons.delete')}
            </Button>
          </div>
        </Block>

        <Block title={t.tc('globals.terms.subscriptions', 2)}>
          <div className="flex flex-wrap items-end gap-4">
            <Field label="Data">
              <Choice
                label="Data"
                value="optin"
                onChange={() => {}}
                options={[['optin', t('maintenance.maintenance.unconfirmedOptins')]]}
              />
            </Field>
            <Field label={t('maintenance.olderThan')}>
              <Input
                type="date"
                value={subscriptionDate}
                onChange={(e) => setSubscriptionDate(e.target.value)}
                required
              />
            </Field>
            <Button
              variant="destructive"
              data-cy="btn-delete-subscriptions"
              disabled={delSubscriptions.isPending || !subscriptionDate}
              onClick={async () => {
                if (await ask(t('maintenance.maintenance.unconfirmedOptins'), subscriptionDate))
                  delSubscriptions.mutate();
              }}
            >
              <Trash2 /> {t('globals.buttons.delete')}
            </Button>
          </div>
        </Block>

        <Block title={t('globals.terms.analytics')}>
          <div className="flex flex-wrap items-end gap-4">
            <Field label="Data">
              <Choice
                label="Data"
                value={analyticsType}
                onChange={setAnalyticsType}
                options={analyticsOptions}
              />
            </Field>
            <Field label={t('maintenance.olderThan')}>
              <Input
                type="date"
                value={analyticsDate}
                onChange={(e) => setAnalyticsDate(e.target.value)}
                required
              />
            </Field>
            <Button
              variant="destructive"
              data-cy="btn-delete-analytics"
              disabled={delAnalytics.isPending || !analyticsDate}
              onClick={async () => {
                if (await ask(label(analyticsOptions, analyticsType), analyticsDate))
                  delAnalytics.mutate();
              }}
            >
              <Trash2 /> {t('globals.buttons.delete')}
            </Button>
          </div>
          <hr />
          <h3 className="text-sm font-medium">{t('subscribers.export')}</h3>
          <div className="flex flex-wrap items-end gap-4">
            <Field label="Data">
              <Choice
                label="Data"
                value={exportType}
                onChange={setExportType}
                options={[
                  ['views', t('dashboard.campaignViews')],
                  ['clicks', t('dashboard.linkClicks')],
                ]}
              />
            </Field>
            <Field label={t('analytics.fromDate')}>
              <Input
                type="date"
                value={exportDate}
                onChange={(e) => setExportDate(e.target.value)}
                required
              />
            </Field>
            <Button asChild data-cy="btn-export-analytics" aria-disabled={!exportHref}>
              <a href={exportHref ?? undefined}>
                <Download /> {t('subscribers.export')}
              </a>
            </Button>
          </div>
        </Block>

        {can('settings:manage') ? <DatabaseBlock /> : null}
      </div>
    </>
  );
}

function DatabaseBlock() {
  const t = useT();
  const { data } = useQuery({
    queryKey: ['maintenance', 'db'],
    queryFn: () => apiFetch<DBSettings>('/api/maintenance/db'),
  });
  const [edit, setEdit] = useState<Partial<DBSettings>>({});
  const vacuum = edit.vacuum ?? data?.vacuum ?? false;
  const cron = edit.vacuum_cron_interval ?? data?.vacuum_cron_interval ?? '0 2 * * *';

  const save = useApiMutation({
    mutationFn: async () => {
      await apiFetch('/api/settings/maintenance.db', {
        method: 'PUT',
        body: JSON.stringify({ vacuum, vacuum_cron_interval: cron }),
      });
      toast.success(t('globals.messages.updated', { name: t('settings.title') }));
      // Saving settings restarts the app.
      await waitForRestart();
    },
  });

  return (
    <form
      className="bg-card flex flex-col gap-5 rounded-xl border p-6"
      onSubmit={(e) => {
        e.preventDefault();
        save.mutate();
      }}
    >
      <h2 className="text-sm font-semibold">{t('maintenance.database.title')}</h2>
      <div>
        <h3 className="text-sm font-medium">Vacuum</h3>
        <p className="text-muted-foreground text-sm">{t('maintenance.database.vacuumHelp')}</p>
      </div>
      <div className="flex flex-wrap items-end gap-4">
        <div className="flex items-center gap-2 pb-2">
          <Switch
            id="vacuum"
            checked={vacuum}
            onCheckedChange={(c) => setEdit({ ...edit, vacuum: c })}
          />
          <Label htmlFor="vacuum">{t('globals.buttons.enabled')}</Label>
        </div>
        <Field label={t('settings.maintenance.cron')}>
          <Input
            placeholder="0 2 * * *"
            pattern="((\*|[0-9,\-\/]+)\s+){4}(\*|[0-9,\-\/]+)"
            disabled={!vacuum}
            value={cron}
            onChange={(e) => setEdit({ ...edit, vacuum_cron_interval: e.target.value })}
          />
        </Field>
        <Button type="submit" data-cy="btn-save-db" disabled={save.isPending}>
          {t('globals.buttons.save')}
        </Button>
      </div>
    </form>
  );
}
