import { useT } from '@/components/app-context';
import {
  FieldNumber,
  FieldSelect,
  FieldSwitch,
  FieldText,
  Row,
  SettingsCard,
  useBind,
  useSettings,
} from '@/components/settings/fields';
import type { BounceMailbox } from '@/lib/settings';

const TYPES = ['soft', 'hard', 'complaint'] as const;

function Mailbox() {
  const t = useT();
  const { form, update } = useSettings();
  const m = form['bounce.mailboxes'][0]!;
  const set = <K extends keyof BounceMailbox>(key: K, v: BounceMailbox[K]) =>
    update((d) => (d['bounce.mailboxes'][0]![key] = v));

  return (
    <>
      <SettingsCard block="bounces.mailbox" className="border-0 bg-transparent p-0">
        <FieldSwitch
          label={t('settings.bounces.enableMailbox')}
          value={m.enabled}
          onChange={(v) => set('enabled', v)}
          testId="btn-enable-bounce-mailbox"
        />
      </SettingsCard>
      {m.enabled ? (
        <SettingsCard block="bounces.mailbox">
          <FieldSelect
            label={t('settings.bounces.type')}
            options={[{ value: 'pop', label: 'POP' }]}
            value={m.type}
            onChange={(v) => set('type', v)}
          />
          <div className="grid gap-4 sm:grid-cols-[2fr_1fr]">
            <FieldText
              label={t('settings.mailserver.host')}
              hint={t('settings.mailserver.hostHelp')}
              maxLength={200}
              placeholder="bounce.yourmailserver.net"
              value={m.host}
              onChange={(v) => set('host', v)}
            />
            <FieldNumber
              label={t('settings.mailserver.port')}
              hint={t('settings.mailserver.portHelp')}
              min={1}
              max={65535}
              placeholder="25"
              value={m.port}
              onChange={(v) => set('port', v)}
            />
          </div>
          <FieldSelect
            label={t('settings.mailserver.authProtocol')}
            options={[
              { value: 'none', label: 'none' },
              { value: 'userpass', label: 'userpass' },
            ]}
            value={m.auth_protocol}
            onChange={(v) => set('auth_protocol', v)}
          />
          <FieldText
            label={t('settings.mailserver.username')}
            maxLength={200}
            placeholder="mysmtp"
            disabled={m.auth_protocol === 'none'}
            value={m.username}
            onChange={(v) => set('username', v)}
          />
          <FieldText
            label={t('settings.mailserver.password')}
            hint={t('settings.mailserver.passwordHelp')}
            type="password"
            maxLength={200}
            disabled={m.auth_protocol === 'none'}
            value={m.password}
            onChange={(v) => set('password', v)}
          />
          <Row>
            <FieldSwitch
              label={t('settings.mailserver.tls')}
              hint={t('settings.mailserver.tlsHelp')}
              value={m.tls_enabled}
              onChange={(v) => set('tls_enabled', v)}
            />
            <FieldSwitch
              label={t('settings.mailserver.skipTLS')}
              hint={t('settings.mailserver.skipTLSHelp')}
              disabled={!m.tls_enabled}
              value={m.tls_skip_verify}
              onChange={(v) => set('tls_skip_verify', v)}
            />
          </Row>
          <FieldText
            label={t('settings.bounces.scanInterval')}
            hint={t('settings.bounces.scanIntervalHelp')}
            maxLength={10}
            placeholder="15m"
            value={m.scan_interval}
            onChange={(v) => set('scan_interval', v)}
          />
        </SettingsCard>
      ) : null}
    </>
  );
}

function Webhooks() {
  const t = useT();
  const bind = useBind();
  const { form, update } = useSettings();
  const azure = form['bounce.azure'];
  const postmark = form['bounce.postmark'];
  const forward = form['bounce.forwardemail'];
  const letter = form['bounce.lettermint'];

  return (
    <>
      <SettingsCard block="bounces.ses" title={t('settings.bounces.enableSES')}>
        <FieldSwitch
          label={t('globals.buttons.enable')}
          testId="btn-enable-bounce-ses"
          {...bind('bounce.ses_enabled')}
        />
      </SettingsCard>

      <SettingsCard block="bounces.azure" title={t('settings.bounces.enableAzure')}>
        <FieldSwitch
          label={t('globals.buttons.enable')}
          value={azure.enabled}
          onChange={(v) => update((d) => (d['bounce.azure'].enabled = v))}
        />
        {azure.enabled ? (
          <>
            <FieldText
              label={t('settings.bounces.azureSharedSecret')}
              hint={t('settings.bounces.azureSharedSecretHelp')}
              type="password"
              value={azure.shared_secret}
              onChange={(v) => update((d) => (d['bounce.azure'].shared_secret = v))}
            />
            <FieldText
              label={t('settings.bounces.azureSharedSecretHeader')}
              hint={t('settings.bounces.azureSharedSecretHeaderHelp')}
              value={azure.shared_secret_header}
              onChange={(v) => update((d) => (d['bounce.azure'].shared_secret_header = v))}
            />
          </>
        ) : null}
      </SettingsCard>

      <SettingsCard block="bounces.sendgrid" title={t('settings.bounces.enableSendgrid')}>
        <FieldSwitch label={t('globals.buttons.enable')} {...bind('bounce.sendgrid_enabled')} />
        {form['bounce.sendgrid_enabled'] ? (
          <FieldText
            label={t('settings.bounces.sendgridKey')}
            hint={t('globals.messages.passwordChange')}
            type="password"
            {...bind('bounce.sendgrid_key')}
          />
        ) : null}
      </SettingsCard>

      <SettingsCard block="bounces.postmark" title={t('settings.bounces.enablePostmark')}>
        <FieldSwitch
          label={t('globals.buttons.enable')}
          value={postmark.enabled}
          onChange={(v) => update((d) => (d['bounce.postmark'].enabled = v))}
        />
        {postmark.enabled ? (
          <>
            <FieldText
              label={t('settings.bounces.postmarkUsername')}
              hint={t('settings.bounces.postmarkUsernameHelp')}
              value={postmark.username}
              onChange={(v) => update((d) => (d['bounce.postmark'].username = v))}
            />
            <FieldText
              label={t('settings.bounces.postmarkPassword')}
              hint={t('globals.messages.passwordChange')}
              type="password"
              value={postmark.password}
              onChange={(v) => update((d) => (d['bounce.postmark'].password = v))}
            />
          </>
        ) : null}
      </SettingsCard>

      <SettingsCard block="bounces.forwardemail" title={t('settings.bounces.enableForwardemail')}>
        <FieldSwitch
          label={t('globals.buttons.enable')}
          value={forward.enabled}
          onChange={(v) => update((d) => (d['bounce.forwardemail'].enabled = v))}
        />
        {forward.enabled ? (
          <FieldText
            label={t('settings.bounces.forwardemailKey')}
            hint={t('globals.messages.passwordChange')}
            type="password"
            value={forward.key}
            onChange={(v) => update((d) => (d['bounce.forwardemail'].key = v))}
          />
        ) : null}
      </SettingsCard>

      <SettingsCard block="bounces.lettermint" title={t('settings.bounces.enableLettermint')}>
        <FieldSwitch
          label={t('globals.buttons.enable')}
          value={letter.enabled}
          onChange={(v) => update((d) => (d['bounce.lettermint'].enabled = v))}
        />
        {letter.enabled ? (
          <FieldText
            label={t('settings.bounces.lettermintKey')}
            hint={t('globals.messages.passwordChange')}
            type="password"
            value={letter.key}
            onChange={(v) => update((d) => (d['bounce.lettermint'].key = v))}
          />
        ) : null}
      </SettingsCard>
    </>
  );
}

export function BouncesTab() {
  const t = useT();
  const bind = useBind();
  const { form, update } = useSettings();

  return (
    <>
      <SettingsCard block="bounces.enable" className="border-0 bg-transparent p-0">
        <FieldSwitch label={t('settings.bounces.enable')} {...bind('bounce.enabled')} />
      </SettingsCard>

      {form['bounce.enabled'] ? (
        <>
          {TYPES.map((typ) => (
            <SettingsCard key={typ} block={`bounces.${typ}`} title={t(`bounces.${typ}`)}>
              <Row>
                <FieldNumber
                  label={t('settings.bounces.count')}
                  hint={t('settings.bounces.countHelp')}
                  min={1}
                  max={1000}
                  placeholder="3"
                  value={form['bounce.actions'][typ].count}
                  onChange={(v) => update((d) => (d['bounce.actions'][typ].count = v))}
                />
                <FieldSelect
                  label={t('settings.bounces.action')}
                  options={[
                    { value: 'none', label: t('globals.terms.none') },
                    { value: 'unsubscribe', label: t('email.unsub') },
                    { value: 'blocklist', label: t('settings.bounces.blocklist') },
                    { value: 'delete', label: t('globals.buttons.delete') },
                  ]}
                  value={form['bounce.actions'][typ].action}
                  onChange={(v) => update((d) => (d['bounce.actions'][typ].action = v))}
                />
              </Row>
            </SettingsCard>
          ))}

          <Mailbox />

          <SettingsCard block="bounces.webhooks" className="border-0 bg-transparent p-0">
            <FieldSwitch
              label={t('settings.bounces.enableWebhooks')}
              hint={
                <a
                  href="https://listmonk.app/docs/bounces"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline"
                >
                  {t('globals.buttons.learnMore')} &rarr;
                </a>
              }
              {...bind('bounce.webhooks_enabled')}
            />
          </SettingsCard>
          {form['bounce.webhooks_enabled'] ? <Webhooks /> : null}
        </>
      ) : null}
    </>
  );
}
