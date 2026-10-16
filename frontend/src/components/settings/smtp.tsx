import { Plus, Send, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { useT } from '@/components/app-context';
import { useConfirm } from '@/components/confirm-dialog';
import { TagInput } from '@/components/tag-input';
import {
  FieldArea,
  FieldNumber,
  FieldSelect,
  FieldSwitch,
  FieldText,
  Row,
  SettingsCard,
  SubCard,
  useSettings,
} from '@/components/settings/fields';
import { RepeatBox, useOpenBoxes } from '@/components/settings/repeat-box';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { apiFetch } from '@/lib/api';
import {
  SMTP_PRESETS,
  addSmtp,
  fillSmtp,
  hasDummy,
  smtpTestPayload,
  type SmtpPreset,
  type SmtpRow,
} from '@/lib/settings';

function focusSoon(id: string) {
  window.setTimeout(() => document.getElementById(id)?.focus(), 0);
}

function TestBox({ n, row }: { n: number; row: SmtpRow }) {
  const t = useT();
  const { form, update } = useSettings();
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const run = async () => {
    // A masked password cannot be tested; the user has to type the real one.
    if (!row.host || !row.port || (row.auth_protocol !== 'none' && hasDummy(row.password))) {
      toast.warning(t('settings.smtp.testEnterEmail'));
      update((d) => (d.smtp[n]!.password = ''));
      focusSoon(`smtp-password-${n}`);
      return;
    }
    const p = smtpTestPayload(row, email);
    if (!p.ok) {
      setError(p.detail);
      return;
    }
    setError('');
    setBusy(true);
    try {
      await apiFetch('/api/settings/smtp/test', {
        method: 'POST',
        body: JSON.stringify(p.payload),
      });
      toast.success(t('campaigns.testSent'));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <SubCard>
      <p className="text-sm">
        <strong>{t('settings.general.fromEmail')}</strong>: {form['app.from_email']}
      </p>
      <div className="flex flex-col gap-2">
        <Label htmlFor={`smtp-test-${n}`}>{t('settings.smtp.toEmail')}</Label>
        <div className="flex gap-2">
          <Input
            id={`smtp-test-${n}`}
            type="email"
            placeholder="email@site.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onKeyDown={(e) => {
              // Enter would submit the whole settings form.
              if (e.key === 'Enter') {
                e.preventDefault();
                void run();
              }
            }}
          />
          <Button type="button" disabled={busy || !email} onClick={() => void run()}>
            {t('settings.smtp.sendTest')}
          </Button>
        </div>
      </div>
      {error ? <Textarea readOnly rows={4} value={error} aria-label="Error" /> : null}
    </SubCard>
  );
}

function ServerBox({
  n,
  row,
  boxes,
}: {
  n: number;
  row: SmtpRow;
  boxes: ReturnType<typeof useOpenBoxes>;
}) {
  const t = useT();
  const confirm = useConfirm();
  const { form, update } = useSettings();
  const [testing, setTesting] = useState(false);
  const off = !row.enabled;
  const set = <K extends keyof SmtpRow>(key: K, v: SmtpRow[K]) =>
    update((d) => (d.smtp[n]![key] = v));

  const remove = async () => {
    if (!(await confirm({ title: t('globals.messages.confirm') }))) return;
    update((d) => d.smtp.splice(n, 1));
    boxes.remove(n);
  };

  return (
    <RepeatBox
      testId="smtp-server"
      index={n}
      title={row.name || row.host}
      open={boxes.isOpen(n)}
      onOpenChange={boxes.setOpen.bind(null, n)}
      disabled={off}
      controls={
        <>
          <FieldSwitch
            label={t('globals.buttons.enabled')}
            value={row.enabled}
            onChange={(v) => set('enabled', v)}
            testId="btn-enable-smtp"
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={off}
            data-testid="btn-test-smtp"
            onClick={() => {
              setTesting((v) => !v);
              boxes.setOpen(n, true);
            }}
          >
            <Send /> {t('settings.smtp.testConnection')}
          </Button>
          {form.smtp.length > 1 ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="text-destructive"
              data-testid="btn-delete-smtp"
              onClick={() => void remove()}
            >
              <Trash2 /> {t('globals.buttons.delete')}
            </Button>
          ) : null}
        </>
      }
    >
      {testing ? <TestBox n={n} row={row} /> : null}

      <SubCard title={t('settings.mailserver.host')} disabled={off}>
        <div className="grid gap-4 sm:grid-cols-[3fr_1fr]">
          <FieldText
            label={t('settings.mailserver.host')}
            hint={t('settings.mailserver.hostHelp')}
            id={`smtp-host-${n}`}
            maxLength={200}
            placeholder="smtp.yourmailserver.net"
            value={row.host}
            onChange={(v) => set('host', v)}
          />
          <FieldNumber
            label={t('settings.mailserver.port')}
            hint={t('settings.mailserver.portHelp')}
            min={1}
            max={65535}
            placeholder="25"
            value={row.port}
            onChange={(v) => set('port', v)}
          />
        </div>
        <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs">
          {(Object.keys(SMTP_PRESETS) as SmtpPreset[]).map((k) => (
            <button
              key={k}
              type="button"
              className="text-primary hover:underline"
              onClick={() => {
                update((d) => (d.smtp[n] = fillSmtp(d.smtp[n]!, k)));
                focusSoon(`smtp-username-${n}`);
              }}
            >
              {SMTP_PRESETS[k].label}
            </button>
          ))}
        </div>
      </SubCard>

      <SubCard title={t('settings.mailserver.authProtocol')} disabled={off}>
        <FieldSelect
          label={t('settings.mailserver.authProtocol')}
          options={[
            { value: 'login', label: 'LOGIN' },
            { value: 'cram', label: 'CRAM' },
            { value: 'plain', label: 'PLAIN' },
            { value: 'none', label: 'None' },
          ]}
          value={row.auth_protocol}
          onChange={(v) => set('auth_protocol', v)}
        />
        <div className="flex flex-col gap-2">
          <Label htmlFor={`smtp-username-${n}`}>{t('settings.mailserver.username')}</Label>
          <Input
            id={`smtp-username-${n}`}
            maxLength={200}
            placeholder="mysmtp"
            disabled={row.auth_protocol === 'none'}
            value={row.username}
            onChange={(e) => set('username', e.target.value)}
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor={`smtp-password-${n}`}>{t('settings.mailserver.password')}</Label>
          <Input
            id={`smtp-password-${n}`}
            type="password"
            maxLength={200}
            disabled={row.auth_protocol === 'none'}
            value={row.password}
            onChange={(e) => set('password', e.target.value)}
          />
          <p className="text-muted-foreground text-xs">{t('settings.mailserver.passwordHelp')}</p>
        </div>
      </SubCard>

      <SubCard title={t('settings.mailserver.tls')} disabled={off}>
        <FieldText
          label={t('settings.smtp.heloHost')}
          hint={t('settings.smtp.heloHostHelp')}
          maxLength={200}
          value={row.hello_hostname}
          onChange={(v) => set('hello_hostname', v)}
        />
        <Row>
          <FieldSelect
            label={t('settings.mailserver.tls')}
            hint={t('settings.mailserver.tlsHelp')}
            options={[
              { value: 'none', label: t('globals.states.off') },
              { value: 'STARTTLS', label: 'STARTTLS' },
              { value: 'TLS', label: 'SSL/TLS' },
            ]}
            value={row.tls_type}
            onChange={(v) => set('tls_type', v)}
          />
          <FieldSwitch
            label={t('settings.mailserver.skipTLS')}
            hint={t('settings.mailserver.skipTLSHelp')}
            disabled={row.tls_type === 'none'}
            value={row.tls_skip_verify}
            onChange={(v) => set('tls_skip_verify', v)}
          />
        </Row>
      </SubCard>

      <SubCard title={t('settings.connection')} disabled={off}>
        <FieldNumber
          label={t('settings.mailserver.maxConns')}
          hint={t('settings.mailserver.maxConnsHelp')}
          min={1}
          max={65535}
          placeholder="25"
          value={row.max_conns}
          onChange={(v) => set('max_conns', v)}
        />
        <FieldText
          label={t('settings.mailserver.idleTimeout')}
          hint={t('settings.mailserver.idleTimeoutHelp')}
          maxLength={10}
          placeholder="15s"
          value={row.idle_timeout}
          onChange={(v) => set('idle_timeout', v)}
        />
        <FieldText
          label={t('settings.mailserver.waitTimeout')}
          hint={t('settings.mailserver.waitTimeoutHelp')}
          maxLength={10}
          placeholder="5s"
          value={row.wait_timeout}
          onChange={(v) => set('wait_timeout', v)}
        />
        <Row>
          <FieldNumber
            label={t('settings.smtp.retries')}
            hint={t('settings.smtp.retriesHelp')}
            min={1}
            max={1000}
            placeholder="2"
            value={row.max_msg_retries}
            onChange={(v) => set('max_msg_retries', v)}
          />
          <FieldText
            label={t('settings.smtp.retryDelay')}
            hint={t('settings.smtp.retryDelayHelp')}
            maxLength={10}
            placeholder="0s"
            value={row.msg_retry_delay}
            onChange={(v) => set('msg_retry_delay', v)}
          />
        </Row>
      </SubCard>

      <SubCard title={t('globals.fields.name')} disabled={off}>
        <FieldText
          label={t('globals.fields.name')}
          hint={t('settings.mailserver.nameHelp')}
          maxLength={100}
          placeholder="email-primary"
          value={row.name}
          onChange={(v) => set('name', v)}
        />
        <div className="flex flex-col gap-2">
          <Label htmlFor={`smtp-from-${n}`}>{t('settings.smtp.fromAddresses')}</Label>
          <TagInput
            id={`smtp-from-${n}`}
            maxLength={320}
            value={row.from_addresses}
            onChange={(v) => set('from_addresses', v)}
            placeholder="user@example.com, anothersite.com"
          />
          <p className="text-muted-foreground text-xs">{t('settings.smtp.fromAddressesHelp')}</p>
        </div>
      </SubCard>

      {row.email_headers.length === 0 && !row.showHeaders ? (
        <div>
          <button
            type="button"
            className="text-primary inline-flex items-center gap-1.5 text-sm hover:underline"
            disabled={off}
            onClick={() => set('showHeaders', true)}
          >
            <Plus className="size-4" /> {t('settings.smtp.setCustomHeaders')}
          </button>
        </div>
      ) : (
        <FieldArea
          label={t('settings.smtp.setCustomHeaders')}
          hint={t('settings.smtp.customHeadersHelp')}
          rows={4}
          mono
          disabled={off}
          placeholder='[{"X-Custom": "value"}]'
          value={row.strEmailHeaders}
          onChange={(v) => set('strEmailHeaders', v)}
        />
      )}
    </RepeatBox>
  );
}

export function SmtpTab() {
  const t = useT();
  const { form, update } = useSettings();
  const boxes = useOpenBoxes('smtp');

  return (
    <>
      <SettingsCard
        block="smtp.servers"
        className="flex flex-col gap-4 border-0 bg-transparent p-0"
      >
        {form.smtp.map((row, n) => (
          <ServerBox key={n} n={n} row={row} boxes={boxes} />
        ))}
      </SettingsCard>
      <div>
        <Button
          type="button"
          onClick={() => {
            update((d) => d.smtp.push(addSmtp()));
            boxes.setOpen(form.smtp.length, true);
            focusSoon(`smtp-host-${form.smtp.length}`);
          }}
        >
          <Plus /> {t('globals.buttons.addNew')}
        </Button>
      </div>
    </>
  );
}
