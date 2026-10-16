import { useQuery, useQueryClient } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';
import { Loader2, Upload } from 'lucide-react';
import { useMemo, useRef, useState, type ReactNode } from 'react';
import { z } from 'zod';
import { useT } from '@/components/app-context';
import { useConfirm } from '@/components/confirm-dialog';
import { ListPicker } from '@/components/list-picker';
import { LogView } from '@/components/log-view';
import { PageHeader } from '@/components/page-header';
import { StatusBadge, type Tone } from '@/components/status-badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Switch } from '@/components/ui/switch';
import { useApiMutation } from '@/hooks/use-api-mutation';
import { apiFetch } from '@/lib/api';
import {
  canUpload,
  importLogsQuery,
  importParams,
  importStatusQuery,
  isDone,
  isRunning,
  progress,
  statusAfterModeChange,
  type ImportForm,
  type ImportMode,
} from '@/lib/import';
import { parseLogLines } from '@/lib/logs';

// ?list_id=1&list_id=2 pre-selects lists.
const searchSchema = z.object({
  list_id: z
    .union([z.coerce.number().int().positive(), z.array(z.coerce.number().int().positive())])
    .optional()
    .catch(undefined)
    .transform((v) => (v === undefined ? [] : Array.isArray(v) ? v : [v])),
});

export const Route = createFileRoute('/_app/subscribers/import')({
  head: () => ({ meta: [{ title: 'Import subscribers - listmonk' }] }),
  validateSearch: (s) => searchSchema.parse(s),
  component: ImportPage,
});

const STATUS_TONE: Record<string, Tone> = {
  finished: 'success',
  failed: 'danger',
  stopped: 'danger',
};

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="bg-card flex flex-col gap-5 rounded-xl border p-6">
      <h2 className="text-sm font-semibold">{title}</h2>
      {children}
    </section>
  );
}

function ImportPage() {
  const t = useT();
  const qc = useQueryClient();
  const confirm = useConfirm();
  const { list_id } = Route.useSearch();
  const { data: status } = useQuery(importStatusQuery);

  const [form, setForm] = useState<ImportForm>({
    mode: 'subscribe',
    subStatus: 'unconfirmed',
    delim: ',',
    lists: list_id,
    overwriteUserInfo: false,
    overwriteSubStatus: false,
    file: null,
  });
  const fileInput = useRef<HTMLInputElement>(null);
  const patch = (p: Partial<ImportForm>) => setForm((f) => ({ ...f, ...p }));

  const refresh = () => qc.invalidateQueries({ queryKey: ['import'] });

  const upload = useApiMutation({
    mutationFn: () => {
      const body = new FormData();
      body.set('params', JSON.stringify(importParams(form)));
      body.set('file', form.file as File);
      return apiFetch('/api/import/subscribers', { method: 'POST', body });
    },
    success: () => t('import.importStarted'),
    onSuccess: () => {
      void refresh();
    },
    // A failed upload clears the chosen file, as before.
  });
  const stop = useApiMutation({
    mutationFn: () => apiFetch('/api/import/subscribers', { method: 'DELETE' }),
    onSuccess: () => {
      void refresh();
    },
  });

  const showForm = !status || status.status === 'none' || status.status === '';
  const running = !!status && isRunning(status);
  const done = !!status && isDone(status);
  const { data: logs } = useQuery(importLogsQuery(!showForm, running));
  const lines = useMemo(
    () =>
      parseLogLines(
        (logs ?? '').split('\n').map((l) => l.replace(/\s+importer\.go:\d+:\s*/, ' *: ')),
      ),
    [logs],
  );

  const onUpload = async () => {
    if (form.mode === 'subscribe' && form.overwriteSubStatus) {
      if (!(await confirm({ title: t('import.title'), description: t('import.subscribeWarning') })))
        return;
    }
    upload.mutate(undefined, { onError: () => patch({ file: null }) });
  };

  return (
    <>
      <PageHeader title={t('import.title')} />
      {showForm ? (
        <form
          className="flex flex-col gap-6"
          onSubmit={(e) => {
            e.preventDefault();
            if (canUpload(form)) void onUpload();
          }}
        >
          <Section title={t('import.title')}>
            <div className="grid gap-8 sm:grid-cols-3">
              <fieldset className="flex flex-col gap-4">
                <legend className="mb-3 text-sm font-medium">{t('import.mode')}</legend>
                <RadioGroup
                  value={form.mode}
                  onValueChange={(m) =>
                    patch({
                      mode: m as ImportMode,
                      subStatus: statusAfterModeChange(m as ImportMode),
                    })
                  }
                  className="flex gap-6"
                >
                  <Opt
                    id="mode-subscribe"
                    value="subscribe"
                    testId="check-subscribe"
                    label={t('import.subscribe')}
                  />
                  <Opt
                    id="mode-blocklist"
                    value="blocklist"
                    testId="check-blocklist"
                    label={t('import.blocklist')}
                  />
                </RadioGroup>
                <Toggle
                  id="overwrite-user"
                  testId="overwrite-user-info"
                  checked={form.overwriteUserInfo}
                  onChange={(v) => patch({ overwriteUserInfo: v })}
                  label={t('import.overwriteUserInfo')}
                  hint={t('import.overwriteUserInfoHelp')}
                />
              </fieldset>
              <fieldset className="flex flex-col gap-4">
                <legend className="mb-3 text-sm font-medium">{t('globals.fields.status')}</legend>
                {form.mode === 'subscribe' ? (
                  <>
                    <RadioGroup
                      value={form.subStatus}
                      onValueChange={(v) => patch({ subStatus: v as ImportForm['subStatus'] })}
                      className="flex gap-6"
                    >
                      <Opt
                        id="st-unconfirmed"
                        value="unconfirmed"
                        testId="check-unconfirmed"
                        label={t('subscribers.status.unconfirmed')}
                      />
                      <Opt
                        id="st-confirmed"
                        value="confirmed"
                        testId="check-confirmed"
                        label={t('subscribers.status.confirmed')}
                      />
                    </RadioGroup>
                    <Toggle
                      id="overwrite-status"
                      testId="overwrite-sub-status"
                      checked={form.overwriteSubStatus}
                      onChange={(v) => patch({ overwriteSubStatus: v })}
                      label={t('import.overwriteSubStatus')}
                      hint={t('import.overwriteSubStatusHelp')}
                    />
                  </>
                ) : (
                  <RadioGroup value="unsubscribed" className="flex gap-6">
                    <Opt
                      id="st-unsub"
                      value="unsubscribed"
                      testId="check-unsubscribed"
                      label={t('subscribers.status.unsubscribed')}
                    />
                  </RadioGroup>
                )}
              </fieldset>
              <fieldset className="flex flex-col gap-2">
                <legend className="mb-3 text-sm font-medium">{t('import.csvDelim')}</legend>
                <Input
                  name="delim"
                  value={form.delim}
                  onChange={(e) => patch({ delim: e.target.value })}
                  placeholder=","
                  maxLength={1}
                  required
                  className="w-24 text-center font-mono"
                  aria-label={t('import.csvDelim')}
                />
                <p className="text-muted-foreground text-xs">{t('import.csvDelimHelp')}</p>
              </fieldset>
            </div>
          </Section>

          {form.mode === 'subscribe' ? (
            <Section title={t('globals.terms.lists')}>
              <ListPicker
                value={form.lists}
                onChange={(lists) => patch({ lists })}
                placeholder={t('import.listSubHelp')}
              />
            </Section>
          ) : null}

          <Section title={t('import.upload')}>
            <input
              ref={fileInput}
              type="file"
              name="file"
              accept=".csv,.zip"
              hidden
              data-testid="file-input"
              onChange={(e) => patch({ file: e.target.files?.[0] ?? null })}
            />
            <button
              type="button"
              onClick={() => fileInput.current?.click()}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                patch({ file: e.dataTransfer.files[0] ?? null });
              }}
              className="hover:bg-muted/50 flex flex-col items-center gap-2 rounded-xl border-2 border-dashed px-6 py-10 text-center transition-colors"
            >
              <Upload className="text-muted-foreground size-6" />
              <strong className="text-sm">{t('import.csvFile')}</strong>
              <span className="text-muted-foreground text-xs">
                {form.file ? form.file.name : t('import.csvFileHelp')}
              </span>
            </button>
          </Section>

          <div className="flex justify-end">
            <Button
              type="submit"
              data-testid="btn-upload"
              disabled={!canUpload(form) || upload.isPending}
            >
              <Upload /> {t('import.upload')}
            </Button>
          </div>

          <div className="text-sm">
            <h3 className="mb-1 font-medium">{t('import.instructions')}</h3>
            <p className="text-muted-foreground mb-3">{t('import.instructionsHelp')}</p>
            <h3 className="mb-1 font-medium">{t('import.csvExample')}</h3>
            <pre className="bg-muted overflow-auto rounded-lg p-4 font-mono text-xs">{`email,name,attributes
user1@mail.com,"User One","{""age"": 42, ""planet"": ""Mars""}"
user2@mail.com,"User Two","{""age"": 24, ""job"": ""Time Traveller""}"`}</pre>
          </div>
        </form>
      ) : status ? (
        <div className="flex flex-col gap-6">
          <section className="bg-card flex flex-col gap-4 rounded-xl border p-6">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <h2 className="text-sm font-semibold capitalize">{status.status}</h2>
                <StatusBadge tone={STATUS_TONE[status.status] ?? 'info'}>
                  {progress(status)}%
                </StatusBadge>
                {running ? <Loader2 className="text-muted-foreground size-4 animate-spin" /> : null}
              </div>
              {done ? (
                <Button
                  data-testid="btn-done"
                  disabled={stop.isPending}
                  onClick={() => stop.mutate()}
                >
                  {t('import.importDone')}
                </Button>
              ) : (
                <Button
                  variant="destructive"
                  data-testid="btn-stop"
                  disabled={stop.isPending || status.status === 'stopping'}
                  onClick={() => stop.mutate()}
                >
                  {t('import.stopImport')}
                </Button>
              )}
            </div>
            <Progress value={progress(status)} />
            <p className="text-muted-foreground text-sm">
              {t('import.recordsCount', { num: status.imported, total: status.total })}
            </p>
          </section>
          <section className="flex flex-col gap-3">
            <h2 className="text-sm font-semibold">{t('menu.logs')}</h2>
            <LogView lines={lines} />
          </section>
        </div>
      ) : null}
    </>
  );
}

function Opt({
  id,
  value,
  label,
  testId,
}: {
  id: string;
  value: string;
  label: string;
  testId: string;
}) {
  return (
    <div className="flex items-center gap-2">
      <RadioGroupItem id={id} value={value} data-testid={testId} />
      <Label htmlFor={id} className="font-normal">
        {label}
      </Label>
    </div>
  );
}

function Toggle({
  id,
  testId,
  checked,
  onChange,
  label,
  hint,
}: {
  id: string;
  testId: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  hint: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <Switch id={id} data-testid={testId} checked={checked} onCheckedChange={onChange} />
      <div className="flex flex-col gap-1">
        <Label htmlFor={id}>{label}</Label>
        <p className="text-muted-foreground text-xs">{hint}</p>
      </div>
    </div>
  );
}
