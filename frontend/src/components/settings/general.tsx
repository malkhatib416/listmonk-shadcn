import { useApp, useT } from '@/components/app-context';
import { TagInput } from '@/components/tag-input';
import {
  FieldSelect,
  FieldSwitch,
  FieldText,
  SettingsCard,
  useBind,
} from '@/components/settings/fields';

export function GeneralTab() {
  const t = useT();
  const { config } = useApp();
  const bind = useBind();
  const langs = (config.langs as { code: string; name: string }[] | undefined) ?? [];
  const emails = bind('app.notify_emails');

  return (
    <>
      <SettingsCard block="general.site" title={t('settings.general.name')}>
        <FieldText
          label={t('settings.general.siteName')}
          maxLength={300}
          required
          {...bind('app.site_name')}
        />
        <FieldText
          label={t('settings.general.rootURL')}
          hint={t('settings.general.rootURLHelp')}
          type="url"
          pattern="https?://.*"
          maxLength={300}
          required
          placeholder="https://listmonk.yoursite.com"
          {...bind('app.root_url')}
        />
        <FieldText
          label={t('settings.general.logoURL')}
          hint={t('settings.general.logoURLHelp')}
          type="url"
          pattern="https?://.*"
          maxLength={300}
          placeholder="https://listmonk.yoursite.com/logo.png"
          {...bind('app.logo_url')}
        />
        <FieldText
          label={t('settings.general.faviconURL')}
          hint={t('settings.general.faviconURLHelp')}
          type="url"
          pattern="https?://.*"
          maxLength={300}
          placeholder="https://listmonk.yoursite.com/favicon.png"
          {...bind('app.favicon_url')}
        />
        <FieldSelect
          label={t('settings.general.language')}
          hint={
            <a
              href="https://listmonk.app/docs/i18n/#additional-language-packs"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline"
            >
              {t('globals.buttons.more')} &rarr;
            </a>
          }
          options={langs.map((l) => ({ value: l.code, label: l.name }))}
          value={bind('app.lang').value}
          onChange={bind('app.lang').onChange}
        />
      </SettingsCard>

      <SettingsCard block="general.email" title={t('subscribers.email')}>
        <FieldText
          label={t('settings.general.fromEmail')}
          hint={t('settings.general.fromEmailHelp')}
          pattern="((.+?)\s)?<(.+?)@(.+?)>"
          maxLength={300}
          placeholder="Listmonk <noreply@listmonk.yoursite.com>"
          {...bind('app.from_email')}
        />
        <div className="flex flex-col gap-2">
          <label htmlFor="notify-emails" className="text-sm font-medium">
            {t('settings.general.adminNotifEmails')}
          </label>
          <TagInput
            id="notify-emails"
            type="email"
            value={emails.value}
            onChange={emails.onChange}
            placeholder="you@yoursite.com"
          />
          <p className="text-muted-foreground text-xs">
            {t('settings.general.adminNotifEmailsHelp')}
          </p>
        </div>
      </SettingsCard>

      <SettingsCard block="general.subscription" title={t.tc('globals.terms.subscriptions', 2)}>
        <FieldSwitch
          label={t('settings.general.enablePublicSubPage')}
          hint={t('settings.general.enablePublicSubPageHelp')}
          {...bind('app.enable_public_subscription_page')}
        />
        <FieldSwitch
          label={t('settings.general.sendOptinConfirm')}
          hint={t('settings.general.sendOptinConfirmHelp')}
          {...bind('app.send_optin_confirmation')}
        />
        <FieldSwitch
          label={t('settings.general.showOptinPage')}
          hint={t('settings.general.showOptinPageHelp')}
          {...bind('app.show_optin_page')}
        />
      </SettingsCard>

      <SettingsCard block="general.archive" title={t('campaigns.archive')}>
        <FieldSwitch
          label={t('settings.general.enablePublicArchive')}
          hint={t('settings.general.enablePublicArchiveHelp')}
          {...bind('app.enable_public_archive')}
        />
        <FieldSwitch
          label={t('settings.general.enablePublicArchiveRSSContent')}
          hint={t('settings.general.enablePublicArchiveRSSContentHelp')}
          {...bind('app.enable_public_archive_rss_content')}
        />
      </SettingsCard>

      <SettingsCard block="general.updates">
        <FieldSwitch
          label={t('settings.general.checkUpdates')}
          hint={t('settings.general.checkUpdatesHelp')}
          {...bind('app.check_updates')}
        />
      </SettingsCard>
    </>
  );
}
