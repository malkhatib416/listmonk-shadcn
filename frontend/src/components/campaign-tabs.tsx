import { Check, ExternalLink, Paperclip, Plus, X } from 'lucide-react';
import { useState } from 'react';
import { useApp, useT } from '@/components/app-context';
import { EmptyState } from '@/components/empty-state';
import { Field, Section } from '@/components/form-field';
import { ListPicker } from '@/components/list-picker';
import { StatusBadge } from '@/components/status-badge';
import { TagInput } from '@/components/tag-input';
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
import { Textarea } from '@/components/ui/textarea';
import {
  canArchive,
  type CampaignDetail,
  type CampaignFormValues,
  type ContentType,
  type MediaRef,
} from '@/lib/campaign-form';
import { fileExt } from '@/lib/media';
import type { Template } from '@/lib/templates';

export interface TabProps {
  form: CampaignFormValues;
  patch: (p: Partial<CampaignFormValues>) => void;
  // The saved campaign, or null while creating.
  campaign: CampaignDetail | null;
  // Status allows editing (always true for a new campaign).
  editable: boolean;
  templates: Template[];
}

export const CONTENT_TYPES: ContentType[] = ['richtext', 'html', 'markdown', 'plain', 'visual'];

export function FormatSelect({
  id,
  value,
  onChange,
  disabled,
}: {
  id?: string;
  value: ContentType;
  onChange: (v: ContentType) => void;
  disabled?: boolean;
}) {
  const t = useT();
  return (
    <Select value={value} onValueChange={(v) => onChange(v as ContentType)} disabled={disabled}>
      <SelectTrigger id={id} className="w-full" data-testid="content-type">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {CONTENT_TYPES.map((c) => (
          <SelectItem key={c} value={c}>
            {t(`campaigns.contentType.${c}`)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export function TemplateSelect({
  value,
  onChange,
  templates,
  disabled,
  id,
  allowNone,
}: {
  value: number | null;
  onChange: (id: number | null) => void;
  templates: Template[];
  disabled?: boolean;
  id?: string;
  allowNone?: boolean;
}) {
  const t = useT();
  return (
    <Select
      value={value === null ? 'none' : String(value)}
      onValueChange={(v) => onChange(v === 'none' ? null : Number(v))}
      disabled={disabled}
    >
      <SelectTrigger id={id} className="w-full">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {allowNone ? <SelectItem value="none">{t('globals.terms.none')}</SelectItem> : null}
        {templates.map((tpl) => (
          <SelectItem key={tpl.id} value={String(tpl.id)}>
            {tpl.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

// ---- Campaign -----------------------------------------------------------

export function CampaignTab({
  form,
  patch,
  campaign,
  editable,
  onToggleSendLater,
  scheduleActions,
  footer,
}: TabProps & {
  onToggleSendLater: (on: boolean) => void;
  scheduleActions: React.ReactNode;
  footer: React.ReactNode;
}) {
  const t = useT();
  const { config } = useApp();
  const isNew = !campaign;
  const headersOn = form.headersStr.trim() !== '' && form.headersStr.trim() !== '[]';
  // The switch starts on when the campaign already has headers.
  const [showHeaders, setShowHeaders] = useState(headersOn);

  return (
    <div className="flex flex-col gap-4">
      <Section title={t.tc('globals.terms.campaign', 1)}>
        <Field label={t('globals.fields.name')} htmlFor="c-name">
          <Input
            id="c-name"
            name="name"
            maxLength={200}
            value={form.name}
            onChange={(e) => patch({ name: e.target.value })}
            disabled={!editable}
            required
          />
        </Field>
        <Field label={t('campaigns.subject')} htmlFor="c-subject">
          <Input
            id="c-subject"
            name="subject"
            maxLength={5000}
            value={form.subject}
            onChange={(e) => patch({ subject: e.target.value })}
            disabled={!editable}
            required
          />
        </Field>
        <Field label={t('globals.terms.tags')} htmlFor="c-tags">
          <TagInput
            id="c-tags"
            value={form.tags}
            onChange={(tags) => patch({ tags })}
            placeholder={t('globals.terms.tags')}
            disabled={!editable}
          />
        </Field>
      </Section>

      <Section title={t('globals.terms.lists')}>
        <ListPicker
          value={form.lists}
          onChange={(lists) => patch({ lists })}
          placeholder={t('campaigns.sendToLists')}
          disabled={!editable}
        />
      </Section>

      <Section title={t.tc('globals.terms.messenger', 1)}>
        <Field label={t('campaigns.fromAddress')} htmlFor="c-from">
          <Input
            id="c-from"
            name="from_email"
            maxLength={200}
            value={form.from_email}
            onChange={(e) => patch({ from_email: e.target.value })}
            placeholder={t('campaigns.fromAddressPlaceholder')}
            disabled={!editable}
            required
          />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t.tc('globals.terms.messenger', 1)} htmlFor="c-messenger">
            <Select
              value={form.messenger}
              onValueChange={(messenger) => patch({ messenger })}
              disabled={!editable}
            >
              <SelectTrigger id="c-messenger" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {config.messengers.map((m) => (
                  <SelectItem key={m} value={m}>
                    {m}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label={t('campaigns.format')} htmlFor="c-format">
            <FormatSelect
              id="c-format"
              value={form.content_type}
              onChange={(content_type) => patch({ content_type })}
              disabled={!isNew}
            />
          </Field>
        </div>
      </Section>

      <Section title={t('campaigns.schedule')}>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex flex-col gap-3">
            <Label className="gap-3 font-normal">
              <Switch
                checked={form.sendLater}
                onCheckedChange={onToggleSendLater}
                disabled={!editable}
                data-testid="send-later"
              />
              {t('campaigns.sendLater')}
            </Label>
            {form.sendLater ? (
              <Field label={t('campaigns.dateAndTime')} htmlFor="c-send-at">
                <Input
                  id="c-send-at"
                  type="datetime-local"
                  name="send_at"
                  value={form.sendAtLocal}
                  onChange={(e) => patch({ sendAtLocal: e.target.value })}
                  disabled={!editable}
                />
              </Field>
            ) : null}
          </div>
          {scheduleActions}
        </div>
      </Section>

      <Section title={t('settings.smtp.customHeaders')}>
        <Label className="gap-3 font-normal">
          <Switch
            checked={showHeaders}
            onCheckedChange={setShowHeaders}
            disabled={!editable}
            data-testid="custom-headers"
          />
          {t('settings.smtp.customHeaders')}
        </Label>
        {showHeaders ? (
          <Field label={t('settings.smtp.customHeaders')} hint={t('campaigns.customHeadersHelp')}>
            <Textarea
              name="headers"
              aria-label={t('settings.smtp.customHeaders')}
              value={form.headersStr}
              onChange={(e) => patch({ headersStr: e.target.value })}
              disabled={!editable}
              placeholder='[{"X-Custom": "value"}]'
              className="font-mono"
              rows={5}
            />
          </Field>
        ) : null}
      </Section>
      {footer}
    </div>
  );
}

// ---- Attributes ---------------------------------------------------------

export function AttribsTab({ form, patch, editable }: TabProps) {
  const t = useT();
  return (
    <Section title={t('globals.terms.attribs')}>
      <Field label={t('globals.terms.attribs')} hint={t('campaigns.attribsHelp')}>
        <Textarea
          aria-label={t('globals.terms.attribs')}
          value={form.attribsStr}
          onChange={(e) => patch({ attribsStr: e.target.value })}
          disabled={!editable}
          rows={15}
          className="font-mono"
        />
      </Field>
    </Section>
  );
}

// ---- Attachments --------------------------------------------------------

export function AttachmentsTab({ form, patch, editable, onAdd }: TabProps & { onAdd: () => void }) {
  const t = useT();
  const remove = (m: MediaRef) => patch({ media: form.media.filter((x) => x !== m) });
  return (
    <Section className="attachments">
      {form.media.length === 0 ? (
        <EmptyState icon={Paperclip} title={t('globals.messages.emptyState')} />
      ) : (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {form.media.map((m) => (
            <li
              key={m.id || m.filename}
              data-testid="media-item"
              className="bg-background relative flex flex-col overflow-hidden rounded-lg border"
            >
              <div className="bg-muted flex aspect-[4/3] items-center justify-center overflow-hidden">
                {m.thumb_url ? (
                  <img src={m.thumb_url} alt="" className="size-full object-cover" />
                ) : (
                  <span className="text-muted-foreground text-xs font-medium">
                    {fileExt(m.filename)}
                  </span>
                )}
              </div>
              <div className="flex items-center justify-between gap-1 px-2 py-1.5 text-xs">
                <span className="filename truncate" title={m.filename}>
                  {m.filename}
                </span>
                {m.id ? null : <StatusBadge tone="danger">missing</StatusBadge>}
              </div>
              {editable ? (
                <Button
                  type="button"
                  variant="secondary"
                  size="icon"
                  className="absolute top-1.5 right-1.5 size-6"
                  aria-label={`${t('globals.buttons.delete')} ${m.filename}`}
                  onClick={() => remove(m)}
                >
                  <X className="size-3.5" />
                </Button>
              ) : null}
            </li>
          ))}
        </ul>
      )}
      <div className="flex justify-center">
        <Button type="button" onClick={onAdd} disabled={!editable} data-testid="attach">
          <Plus /> {t('campaigns.addAttachments')}
        </Button>
      </div>
    </Section>
  );
}

// ---- Archive ------------------------------------------------------------

export function ArchiveTab({
  form,
  patch,
  campaign,
  templates,
  editable,
  canManage,
  saving,
  onSave,
  onPreview,
}: TabProps & {
  canManage: boolean;
  saving: boolean;
  onSave: () => void;
  onPreview: () => void;
}) {
  const t = useT();
  const { config } = useApp();
  const allowed = campaign ? canArchive(campaign.status, campaign.type) : false;
  const slug = form.archive_slug || campaign?.uuid || '';
  const url = `${config.root_url}/archive/${slug}`;
  const metaEmpty = form.archiveMetaStr.trim() === '' || form.archiveMetaStr.trim() === '{}';

  return (
    <div className="flex flex-col gap-4">
      <Section>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex flex-col gap-1.5">
            <Label className="gap-3 font-normal">
              <Switch
                checked={form.archive}
                onCheckedChange={(archive) => patch({ archive })}
                disabled={!allowed}
                data-testid="archive-toggle"
              />
              {t('campaigns.archiveEnable')}
            </Label>
            <p className="text-muted-foreground text-xs">{t('campaigns.archiveHelp')}</p>
          </div>
          {canManage && !editable && allowed ? (
            <Button type="button" onClick={onSave} disabled={saving} data-testid="save-archive">
              <Check /> {t('globals.buttons.saveChanges')}
            </Button>
          ) : null}
        </div>
      </Section>

      {form.archive ? (
        <>
          <Section title={t('campaigns.archive')}>
            <div className="flex items-end gap-2">
              <div className="flex-1">
                <Field label={t.tc('globals.terms.template', 1)} htmlFor="c-arch-tpl">
                  <TemplateSelect
                    id="c-arch-tpl"
                    value={form.archive_template_id}
                    onChange={(archive_template_id) => patch({ archive_template_id })}
                    templates={templates}
                    disabled={!allowed || form.content_type === 'visual'}
                  />
                </Field>
              </div>
              <Button
                type="button"
                variant="outline"
                onClick={onPreview}
                data-testid="archive-preview"
              >
                {t('campaigns.preview')}
              </Button>
            </div>
            <Field
              label={t('campaigns.archiveSlug')}
              htmlFor="c-arch-slug"
              hint={t('campaigns.archiveSlugHelp')}
            >
              <Input
                id="c-arch-slug"
                name="archive_slug"
                maxLength={200}
                value={form.archive_slug}
                onChange={(e) => patch({ archive_slug: e.target.value })}
                disabled={!allowed}
              />
            </Field>
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary inline-flex items-center gap-1.5 text-sm hover:underline"
            >
              <ExternalLink className="size-3.5" /> {url}
            </a>
          </Section>

          <Section title={t('campaigns.archiveMeta')}>
            <Field label={t('campaigns.archiveMeta')} hint={t('campaigns.archiveMetaHelp')}>
              <Textarea
                name="archive_meta"
                aria-label={t('campaigns.archiveMeta')}
                value={form.archiveMetaStr}
                onChange={(e) => patch({ archiveMetaStr: e.target.value })}
                disabled={!allowed}
                rows={12}
                className="font-mono"
              />
            </Field>
            {metaEmpty && allowed ? (
              <div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    patch({
                      archiveMetaStr: JSON.stringify(
                        {
                          email: 'email@domain.com',
                          name: t('globals.fields.name'),
                          attribs: {},
                        },
                        null,
                        4,
                      ),
                    })
                  }
                >
                  {t('templates.makeDefault')}
                </Button>
              </div>
            ) : null}
          </Section>
        </>
      ) : null}
    </div>
  );
}
