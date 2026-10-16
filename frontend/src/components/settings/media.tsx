import { TagInput } from '@/components/tag-input';
import { useT } from '@/components/app-context';
import {
  FieldSelect,
  FieldText,
  SettingsCard,
  useBind,
  useSettings,
} from '@/components/settings/fields';
import { deriveS3URL } from '@/lib/settings';

export function MediaTab() {
  const t = useT();
  const bind = useBind();
  const { form, set } = useSettings();
  const provider = form['upload.provider'];
  const ext = bind('upload.extensions');
  const region = (v: string) => {
    set('upload.s3.aws_default_region', v);
    set('upload.s3.url', deriveS3URL(form['upload.s3.url'], v));
  };

  return (
    <>
      <SettingsCard block="media.extensions" title={t('settings.media.upload.extensions')}>
        <TagInput
          value={ext.value}
          onChange={ext.onChange}
          placeholder="jpg, png, gif .."
          id="upload-extensions"
        />
      </SettingsCard>

      <SettingsCard block="media.provider" title={t('settings.media.provider')}>
        <FieldSelect
          label={t('settings.media.provider')}
          options={[
            { value: 'filesystem', label: 'filesystem' },
            { value: 's3', label: 's3' },
          ]}
          value={provider}
          onChange={bind('upload.provider').onChange}
          testId="upload-provider"
        />
      </SettingsCard>

      {provider === 'filesystem' ? (
        <SettingsCard block="media.filesystem" title="Filesystem">
          <FieldText
            label={t('settings.media.upload.path')}
            hint={t('settings.media.upload.pathHelp')}
            maxLength={200}
            placeholder="/home/listmonk/uploads"
            required
            {...bind('upload.filesystem.upload_path')}
          />
          <FieldText
            label={t('settings.media.upload.uri')}
            hint={t('settings.media.upload.uriHelp')}
            maxLength={200}
            placeholder="/uploads"
            pattern="^\/(.+?)"
            required
            {...bind('upload.filesystem.upload_uri')}
          />
        </SettingsCard>
      ) : (
        <SettingsCard block="media.s3" title="S3">
          <FieldText
            label={t('settings.media.s3.region')}
            maxLength={200}
            placeholder="ap-south-1"
            name="upload.s3.aws_default_region"
            value={form['upload.s3.aws_default_region']}
            onChange={region}
          />
          <FieldText
            label={t('settings.media.s3.key')}
            maxLength={200}
            {...bind('upload.s3.aws_access_key_id')}
          />
          <FieldText
            label={t('settings.media.s3.secret')}
            hint={t('globals.messages.passwordChange')}
            type="password"
            maxLength={200}
            {...bind('upload.s3.aws_secret_access_key')}
          />
          <FieldSelect
            label={t('settings.media.s3.bucketType')}
            options={[
              { value: 'private', label: t('settings.media.s3.bucketTypePrivate') },
              { value: 'public', label: t('settings.media.s3.bucketTypePublic') },
            ]}
            value={form['upload.s3.bucket_type']}
            onChange={bind('upload.s3.bucket_type').onChange}
          />
          <FieldText
            label={t('settings.media.s3.bucket')}
            maxLength={200}
            {...bind('upload.s3.bucket')}
          />
          <FieldText
            label={t('settings.media.s3.bucketPath')}
            hint={t('settings.media.s3.bucketPathHelp')}
            maxLength={200}
            placeholder="/"
            {...bind('upload.s3.bucket_path')}
          />
          <FieldText
            label={t('settings.media.s3.uploadExpiry')}
            hint={t('settings.media.s3.uploadExpiryHelp')}
            maxLength={10}
            placeholder="14d"
            {...bind('upload.s3.expiry')}
          />
          <FieldText
            label={t('settings.media.s3.url')}
            hint={t('settings.media.s3.urlHelp')}
            type="url"
            pattern="https?://.*"
            maxLength={200}
            placeholder="https://s3.$region.amazonaws.com"
            required
            {...bind('upload.s3.url')}
          />
          <FieldText
            label={t('settings.media.s3.publicURL')}
            hint={t('settings.media.s3.publicURLHelp')}
            maxLength={200}
            pattern="(https?://.*|/.+)"
            placeholder="https://files.yourdomain.com"
            {...bind('upload.s3.public_url')}
          />
        </SettingsCard>
      )}
    </>
  );
}
