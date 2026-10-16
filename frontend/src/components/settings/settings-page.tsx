import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useRouterState } from '@tanstack/react-router';
import { Loader2, Save, Search } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { toast } from 'sonner';
import { useApp, useCan, useT } from '@/components/app-context';
import { AppearanceTab } from '@/components/settings/appearance';
import { BouncesTab } from '@/components/settings/bounces';
import { SettingsProvider, type SettingsCtx } from '@/components/settings/fields';
import { GeneralTab } from '@/components/settings/general';
import { MediaTab } from '@/components/settings/media';
import { MessengersTab } from '@/components/settings/messengers';
import { PerformanceTab } from '@/components/settings/performance';
import { PrivacyTab } from '@/components/settings/privacy';
import { SecurityTab } from '@/components/settings/security';
import { SmtpTab } from '@/components/settings/smtp';
import { PageHeader } from '@/components/page-header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { apiFetch } from '@/lib/api';
import { waitForRestart } from '@/lib/restart';
import {
  SETTINGS_TABS,
  buildSettingsPayload,
  matchingBlocks,
  normalizeSettings,
  type SettingsApi,
  type SettingsForm,
  type SettingsTab,
} from '@/lib/settings';
import { cn } from '@/lib/utils';

const LABELS: Record<SettingsTab, string> = {
  general: 'settings.general.name',
  performance: 'settings.performance.name',
  privacy: 'settings.privacy.name',
  security: 'settings.security.name',
  media: 'settings.media.title',
  smtp: 'settings.smtp.name',
  bounces: 'settings.bounces.name',
  messengers: 'settings.messengers.name',
  appearance: 'settings.appearance.name',
};

const BODIES: Record<SettingsTab, () => React.ReactNode> = {
  general: () => <GeneralTab />,
  performance: () => <PerformanceTab />,
  privacy: () => <PrivacyTab />,
  security: () => <SecurityTab />,
  media: () => <MediaTab />,
  smtp: () => <SmtpTab />,
  bounces: () => <BouncesTab />,
  messengers: () => <MessengersTab />,
  appearance: () => <AppearanceTab />,
};

const tabFromHash = (hash: string | undefined): SettingsTab => {
  const tab = new URLSearchParams((hash ?? '').replace(/^#/, '')).get('tab');
  return SETTINGS_TABS.find((x) => x === tab) ?? 'general';
};

export function SettingsPage() {
  // gcTime 0: the form is seeded once, so reopening must fetch the current settings.
  const q = useQuery({
    queryKey: ['settings'],
    queryFn: () => apiFetch<SettingsApi>('/api/settings'),
    gcTime: 0,
  });
  const [seed, setSeed] = useState(0);
  if (q.error) return <p className="text-destructive text-sm">{q.error.message}</p>;
  if (!q.data) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-96" />
      </div>
    );
  }
  return (
    <SettingsEditor
      key={seed}
      initial={q.data}
      onSaved={async () => {
        await q.refetch();
        setSeed((s) => s + 1);
      }}
    />
  );
}

function SettingsEditor({
  initial,
  onSaved,
}: {
  initial: SettingsApi;
  onSaved: () => Promise<void>;
}) {
  const t = useT();
  const can = useCan();
  const { config } = useApp();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const canManage = can('settings:manage');
  const [form, setForm] = useState<SettingsForm>(() => normalizeSettings(initial));
  const [query, setQuery] = useState('');
  const [restarting, setRestarting] = useState(false);
  const hash = useRouterState({ select: (s) => s.location.hash });
  const active = tabFromHash(hash);
  const match = matchingBlocks(query);

  const ctx: SettingsCtx = {
    form,
    set: (key, value) => setForm((f) => ({ ...f, [key]: value })),
    update: (fn) =>
      setForm((f) => {
        const d = structuredClone(f);
        fn(d);
        return d;
      }),
    match,
    canManage,
  };

  const visible = match ? SETTINGS_TABS.filter((x) => match.tabs.has(x)) : SETTINGS_TABS;
  const shown = match ? visible : [active];

  const selectTab = (tab: SettingsTab) => {
    setQuery('');
    void navigate({ to: '.', hash: `tab=${tab}`, replace: true, resetScroll: false });
  };

  const save = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    // Every tab is in the DOM (hidden ones included), so the browser's required/pattern
    // checks cover the whole form. Show the tab of the first problem and report it there.
    const f = e.currentTarget;
    const bad = [...f.elements].find(
      (el) => (el as HTMLInputElement).willValidate && !(el as HTMLInputElement).validity.valid,
    );
    if (bad) {
      const tab = bad.closest('[data-tab]')?.getAttribute('data-tab') as SettingsTab | null;
      if (tab && (match || tab !== active)) selectTab(tab);
      requestAnimationFrame(() => f.reportValidity());
      return;
    }
    const r = buildSettingsPayload(form);
    if (!r.ok) {
      if (r.kind === 'dummy') {
        toast.warning(t('globals.messages.passwordChangeFull', { name: r.name }));
      } else {
        toast.error(`smtp #${r.index + 1}: ${r.detail}`);
      }
      return;
    }
    setRestarting(true);
    try {
      // The request returns at once and the backend then restarts; wait for it to answer.
      await apiFetch('/api/settings', { method: 'PUT', body: JSON.stringify(r.payload) });
      await waitForRestart();
      await qc.invalidateQueries({ queryKey: ['bootstrap'] });
      toast.success(t('globals.messages.updated', { name: t('settings.title') }));
      await onSaved();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setRestarting(false);
    }
  };

  return (
    <SettingsProvider value={ctx}>
      <form onSubmit={(e) => void save(e)} noValidate>
        <PageHeader
          title={`${t('settings.title')}${config.version ? ` (${config.version})` : ''}`}
          actions={
            <>
              <div className="relative">
                <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" />
                <Input
                  type="search"
                  aria-label={t('globals.buttons.search')}
                  placeholder={t('globals.buttons.search')}
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  className="w-56 pl-9"
                  data-testid="settings-search"
                />
              </div>
              {canManage ? (
                <Button type="submit" disabled={restarting} data-testid="btn-save">
                  {restarting ? <Loader2 className="animate-spin" /> : <Save />}{' '}
                  {t('globals.buttons.save')}
                </Button>
              ) : null}
            </>
          }
        />

        <div className="flex flex-col gap-6 md:flex-row">
          <div
            role="tablist"
            aria-orientation="vertical"
            className="flex shrink-0 gap-1 overflow-x-auto md:w-48 md:flex-col"
          >
            {visible.map((tab) => (
              <button
                key={tab}
                type="button"
                role="tab"
                aria-selected={!match && active === tab}
                onClick={() => selectTab(tab)}
                className={cn(
                  'rounded-md px-3 py-2 text-left text-sm font-medium whitespace-nowrap transition-colors',
                  !match && active === tab
                    ? 'bg-accent text-accent-foreground'
                    : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground',
                )}
              >
                {t(LABELS[tab])}
              </button>
            ))}
          </div>
          <fieldset disabled={!canManage} className="flex min-w-0 flex-1 flex-col gap-6">
            {SETTINGS_TABS.map((tab) => (
              <div
                key={tab}
                role="tabpanel"
                aria-label={t(LABELS[tab])}
                data-tab={tab}
                hidden={!shown.includes(tab)}
                className="flex flex-col gap-6"
              >
                {BODIES[tab]()}
              </div>
            ))}
          </fieldset>
        </div>
      </form>
    </SettingsProvider>
  );
}
