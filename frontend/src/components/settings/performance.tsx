import { ExternalLink } from 'lucide-react';
import { useT } from '@/components/app-context';
import {
  FieldNumber,
  FieldSwitch,
  FieldText,
  SettingsCard,
  useBind,
  useSettings,
} from '@/components/settings/fields';

export function PerformanceTab() {
  const t = useT();
  const bind = useBind();
  const { form } = useSettings();

  return (
    <>
      <SettingsCard block="performance.main" title={t('settings.performance.name')}>
        <FieldNumber
          label={t('settings.performance.concurrency')}
          hint={t('settings.performance.concurrencyHelp')}
          min={1}
          max={10000}
          placeholder="5"
          {...bind('app.concurrency')}
        />
        <FieldNumber
          label={t('settings.performance.messageRate')}
          hint={t('settings.performance.messageRateHelp')}
          min={1}
          max={100000}
          placeholder="5"
          {...bind('app.message_rate')}
        />
        <FieldNumber
          label={t('settings.performance.batchSize')}
          hint={t('settings.performance.batchSizeHelp')}
          min={1}
          max={100000}
          placeholder="1000"
          {...bind('app.batch_size')}
        />
        <FieldNumber
          label={t('settings.performance.maxErrThreshold')}
          hint={t('settings.performance.maxErrThresholdHelp')}
          min={0}
          max={100000}
          placeholder="1999"
          {...bind('app.max_send_errors')}
        />
      </SettingsCard>

      <SettingsCard block="performance.sliding" title={t('settings.performance.slidingWindow')}>
        <FieldSwitch
          label={t('globals.buttons.enable')}
          hint={t('settings.performance.slidingWindowHelp')}
          {...bind('app.message_sliding_window')}
        />
        <FieldNumber
          label={t('settings.performance.slidingWindowRate')}
          hint={t('settings.performance.slidingWindowRateHelp')}
          min={1}
          max={10000000}
          placeholder="25"
          disabled={!form['app.message_sliding_window']}
          {...bind('app.message_sliding_window_rate')}
        />
        <FieldText
          label={t('settings.performance.slidingWindowDuration')}
          hint={t('settings.performance.slidingWindowDurationHelp')}
          placeholder="1h"
          maxLength={10}
          disabled={!form['app.message_sliding_window']}
          {...bind('app.message_sliding_window_duration')}
        />
      </SettingsCard>

      <SettingsCard block="performance.cache" title={t('settings.performance.cacheSlowQueries')}>
        <FieldSwitch
          label={t('globals.buttons.enable')}
          hint={t('settings.performance.cacheSlowQueriesHelp')}
          {...bind('app.cache_slow_queries')}
        />
        <FieldText
          label={t('settings.maintenance.cron')}
          hint={
            <a
              href="https://listmonk.app/docs/maintenance/performance/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary inline-flex items-center gap-1 hover:underline"
            >
              <ExternalLink className="size-3" /> {t('globals.buttons.learnMore')}
            </a>
          }
          placeholder="0 3 * * *"
          disabled={!form['app.cache_slow_queries']}
          {...bind('app.cache_slow_queries_interval')}
        />
      </SettingsCard>
    </>
  );
}
