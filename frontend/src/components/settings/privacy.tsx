import { useState } from 'react';
import { useT } from '@/components/app-context';
import {
  FieldArea,
  FieldSwitch,
  SettingsCard,
  useBind,
  useSettings,
} from '@/components/settings/fields';
import { countLines } from '@/lib/settings';
import { cn } from '@/lib/utils';

export function PrivacyTab() {
  const t = useT();
  const bind = useBind();
  const { form } = useSettings();
  const [list, setList] = useState<'blocklist' | 'allowlist'>('blocklist');
  const key = list === 'blocklist' ? 'privacy.domain_blocklist' : 'privacy.domain_allowlist';

  return (
    <>
      <SettingsCard block="privacy.tracking" title={t('settings.privacy.name')}>
        <FieldSwitch
          label={t('settings.privacy.disableTracking')}
          hint={t('settings.privacy.disableTrackingHelp')}
          {...bind('privacy.disable_tracking')}
        />
        <FieldSwitch
          label={t('settings.privacy.individualSubTracking')}
          hint={t('settings.privacy.individualSubTrackingHelp')}
          disabled={form['privacy.disable_tracking']}
          {...bind('privacy.individual_tracking')}
        />
        <FieldSwitch
          label={t('settings.privacy.recordOptinIP')}
          hint={t('settings.privacy.recordOptinIPHelp')}
          {...bind('privacy.record_optin_ip')}
        />
        <FieldSwitch
          label={t('settings.privacy.listUnsubHeader')}
          hint={t('settings.privacy.listUnsubHeaderHelp')}
          {...bind('privacy.unsubscribe_header')}
        />
      </SettingsCard>

      <SettingsCard block="privacy.permissions" title={t('users.perms')}>
        <FieldSwitch
          label={t('settings.privacy.allowBlocklist')}
          hint={t('settings.privacy.allowBlocklistHelp')}
          {...bind('privacy.allow_blocklist')}
        />
        <FieldSwitch
          label={t('settings.privacy.allowPrefs')}
          hint={t('settings.privacy.allowPrefsHelp')}
          {...bind('privacy.allow_preferences')}
        />
        <FieldSwitch
          label={t('settings.privacy.allowExport')}
          hint={t('settings.privacy.allowExportHelp')}
          {...bind('privacy.allow_export')}
        />
        <FieldSwitch
          label={t('settings.privacy.allowWipe')}
          hint={t('settings.privacy.allowWipeHelp')}
          {...bind('privacy.allow_wipe')}
        />
      </SettingsCard>

      <SettingsCard block="privacy.domains" title={t('settings.privacy.domainBlocklist')}>
        <div role="tablist" className="flex gap-1 border-b">
          {(['blocklist', 'allowlist'] as const).map((l) => (
            <button
              key={l}
              type="button"
              role="tab"
              aria-selected={list === l}
              onClick={() => setList(l)}
              className={cn(
                '-mb-px border-b-2 px-3 py-2 text-sm font-medium',
                list === l
                  ? 'border-primary text-foreground'
                  : 'text-muted-foreground hover:text-foreground border-transparent',
              )}
            >
              {t(
                l === 'blocklist'
                  ? 'settings.privacy.domainBlocklist'
                  : 'settings.privacy.domainAllowlist',
              )}{' '}
              (
              {countLines(
                form[l === 'blocklist' ? 'privacy.domain_blocklist' : 'privacy.domain_allowlist'],
              )}
              )
            </button>
          ))}
        </div>
        <FieldArea
          key={list}
          label={t(
            list === 'blocklist'
              ? 'settings.privacy.domainBlocklist'
              : 'settings.privacy.domainAllowlist',
          )}
          hint={t(
            list === 'blocklist'
              ? 'settings.privacy.domainBlocklistHelp'
              : 'settings.privacy.domainAllowlistHelp',
          )}
          rows={8}
          mono
          {...bind(key)}
        />
      </SettingsCard>
    </>
  );
}
