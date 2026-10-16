import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useRouterState } from '@tanstack/react-router';
import { Check, Clock, Copy, Eye, Mail, Save, Send } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { useApp, useCan, useT } from '@/components/app-context';
import { AttachmentsTab, ArchiveTab, AttribsTab, CampaignTab } from '@/components/campaign-tabs';
import { ContentTab } from '@/components/campaign-content';
import { useConfirm } from '@/components/confirm-dialog';
import { PageHeader } from '@/components/page-header';
import { PreviewDialog, type PreviewSource } from '@/components/preview-dialog';
import { StatusBadge } from '@/components/status-badge';
import { TagInput } from '@/components/tag-input';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Skeleton } from '@/components/ui/skeleton';
import { MediaGallery } from '@/components/media-gallery';
import { useApiMutation } from '@/hooks/use-api-mutation';
import { apiFetch } from '@/lib/api';
import {
  buildPayload,
  campaignQuery,
  canArchive,
  parseArchiveMeta,
  canEdit,
  canSchedule,
  canStart,
  canUnschedule,
  formFromCampaign,
  tabFromHash,
  toLocalInput,
  type CampaignDetail,
  type CampaignFormValues,
  type CampaignTab as TabId,
  type ContentType,
} from '@/lib/campaign-form';
import { statusTone, type Campaign } from '@/lib/campaigns';
import { convert } from '@/lib/content';
import type { Media } from '@/lib/media';
import { templateQuery, templatesQuery, type Template } from '@/lib/templates';
import { cn } from '@/lib/utils';
import type { VisualEditorHandle } from '@/widgets/visual-editor';

const TAB_ICON_CLASS = 'size-4';

// The campaign page: loads the campaign (when editing) and the templates, then renders the editor.
export function CampaignEditor({ id, listIds }: { id?: number; listIds?: number[] }) {
  const can = useCan();
  // gcTime 0: the form is seeded once, so a reopened campaign must not start from a stale cache.
  const campaign = useQuery({ ...campaignQuery(id ?? 0), enabled: id !== undefined, gcTime: 0 });
  const templates = useQuery({ ...templatesQuery, enabled: can('templates:get') });

  if (id !== undefined && campaign.error) {
    return <p className="text-destructive text-sm">{campaign.error.message}</p>;
  }
  if ((id !== undefined && !campaign.data) || (can('templates:get') && !templates.data)) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-96" />
      </div>
    );
  }
  return (
    <Editor
      key={id ?? 'new'}
      campaign={campaign.data ?? null}
      templates={templates.data ?? []}
      listIds={listIds}
    />
  );
}

function Editor({
  campaign,
  templates,
  listIds,
}: {
  campaign: CampaignDetail | null;
  templates: Template[];
  listIds?: number[];
}) {
  const t = useT();
  const can = useCan();
  const { config } = useApp();
  const confirm = useConfirm();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const isNew = !campaign;
  const canManage = can('campaigns:manage', 'campaigns:manage_all');
  const canSend = can('campaigns:send');
  const status = campaign?.status ?? 'draft';
  const archivable = campaign ? canArchive(campaign.status, campaign.type) : false;
  const editable = canManage && (isNew || canEdit(status));

  const campaignTemplates = templates.filter((x) => x.type === 'campaign');
  const defaultTpl = campaignTemplates.find((x) => x.is_default) ?? campaignTemplates[0];
  const [form, setForm] = useState<CampaignFormValues>(() =>
    formFromCampaign(campaign, {
      fromEmail: String(config.from_email ?? ''),
      templateId: defaultTpl?.id ?? null,
      messenger: 'email',
      listIds,
    }),
  );
  const patch = (p: Partial<CampaignFormValues>) => setForm((f) => ({ ...f, ...p }));

  const hash = useRouterState({ select: (s) => s.location.hash });
  const tab: TabId = isNew ? 'campaign' : tabFromHash(hash);
  const setTab = (next: TabId) =>
    void navigate({ to: '.', hash: `tab=${next}`, replace: true, resetScroll: false });

  const [nonce, setNonce] = useState(0);
  const [preview, setPreview] = useState<PreviewSource | null>(null);
  const [mediaTarget, setMediaTarget] = useState<((m: Media) => void) | null>(null);
  const [testEmails, setTestEmails] = useState<string[]>([]);
  const [testOpen, setTestOpen] = useState(false);
  const visualRef = useRef<VisualEditorHandle>(null);

  const jsonError = (field: 'headers' | 'attribs' | 'archive_meta', detail: string) =>
    toast.error(field === 'attribs' ? `${t('subscribers.invalidJSON')}: ${detail}` : detail);

  // ---- Mutations --------------------------------------------------------

  const create = useApiMutation({
    mutationFn: (p: Record<string, unknown>) =>
      apiFetch<Campaign>('/api/campaigns', { method: 'POST', body: JSON.stringify(p) }),
    invalidate: [['campaigns']],
    success: (c) => t('globals.messages.created', { name: c.name }),
    onSuccess: (c) =>
      void navigate({ to: '/campaigns/$id', params: { id: String(c.id) }, hash: 'tab=content' }),
  });

  const save = useApiMutation({
    mutationFn: (p: object) =>
      apiFetch<CampaignDetail>(`/api/campaigns/${campaign!.id}`, {
        method: 'PUT',
        body: JSON.stringify(p),
      }),
    invalidate: [['campaigns']],
    success: (c) => t('globals.messages.updated', { name: c.name }),
    onSuccess: (c) => patch({ archive_slug: c.archive_slug || form.archive_slug }),
  });

  const setStatus = useApiMutation({
    mutationFn: (s: string) =>
      apiFetch(`/api/campaigns/${campaign!.id}/status`, {
        method: 'PUT',
        body: JSON.stringify({ status: s }),
      }),
    invalidate: [['campaigns']],
  });

  const test = useApiMutation({
    mutationFn: (p: object) =>
      apiFetch(`/api/campaigns/${campaign!.id}/test`, {
        method: 'POST',
        body: JSON.stringify({ ...p, id: campaign!.id, subscribers: testEmails }),
      }),
    success: () => t('campaigns.testSent'),
    onSuccess: () => setTestOpen(false),
  });

  const saveArchive = useApiMutation({
    mutationFn: (v: { meta: object }) =>
      apiFetch<CampaignDetail>(`/api/campaigns/${campaign!.id}/archive`, {
        method: 'PUT',
        body: JSON.stringify({
          archive: form.archive,
          archive_template_id: form.archive_template_id,
          archive_meta: v.meta,
          archive_slug: form.archive_slug,
        }),
      }),
    invalidate: [['campaigns']],
    success: () => t('globals.messages.done'),
    onSuccess: (c) => patch({ archive_slug: c.archive_slug || form.archive_slug }),
  });

  // ---- Actions ----------------------------------------------------------

  const payload = () => {
    const r = buildPayload(form);
    if (!r.ok) {
      jsonError(r.field, r.detail);
      return null;
    }
    return r.payload;
  };

  const onCreate = () => {
    const p = payload();
    if (!p) return;
    create.mutate({
      archive_slug: form.subject,
      name: p.name,
      subject: p.subject,
      lists: p.lists,
      from_email: p.from_email,
      content_type: p.content_type,
      messenger: p.messenger,
      type: 'regular',
      tags: p.tags,
      send_at: p.send_at,
      headers: p.headers,
      attribs: p.attribs,
      media: p.media,
    });
  };

  const onSave = async (): Promise<boolean> => {
    const p = payload();
    if (!p) return false;
    try {
      await save.mutateAsync(p);
      return true;
    } catch {
      return false;
    }
  };

  const onSaveArchive = () => {
    const r = parseArchiveMeta(form.archiveMetaStr);
    if (!r.ok) return jsonError('archive_meta', r.detail);
    saveArchive.mutate({ meta: r.meta });
  };

  const onStart = async () => {
    if (!campaign) return;
    const schedule = canSchedule(status, form.sendLater, form.sendAtLocal);
    if (!schedule && !canStart(status, form.sendLater)) return;
    const next = schedule ? 'scheduled' : 'running';
    const ok = await confirm({
      title: t(`campaigns.status.${next}`),
      description: schedule ? t('campaigns.confirmSchedule') : form.name,
    });
    // Sending needs only campaigns:send; the save in front of it needs manage rights.
    if (!ok || (editable && !(await onSave()))) return;
    try {
      await setStatus.mutateAsync(next);
    } catch {
      return;
    }
    toast.success(t('campaigns.statusChanged', { name: form.name, status: next }));
    void navigate({ to: '/campaigns' });
  };

  const onUnschedule = async () => {
    if (!(await confirm({ title: t('campaigns.unSchedule'), description: form.name }))) return;
    setStatus.mutate('draft');
  };

  const onTest = () => {
    const p = payload();
    if (p) test.mutate(p);
  };

  const onTypeChange = async (to: ContentType) => {
    const from = form.content_type;
    if (to === from) return;
    if (form.body.trim() && !(await confirm({ title: t('campaigns.confirmSwitchFormat') }))) {
      return;
    }
    const { body, bodySource } = convert(form.body, from, to);
    patch({
      content_type: to,
      body,
      body_source: bodySource,
      // Visual campaigns carry their own layout; leaving visual falls back to the default.
      ...(to === 'visual'
        ? { template_id: null }
        : from === 'visual'
          ? { template_id: defaultTpl?.id ?? null }
          : {}),
    });
    setNonce((n) => n + 1);
  };

  const onImportVisual = async (templateId: number) => {
    if (!(await confirm({ title: t('campaigns.confirmOverwriteContent') }))) return;
    try {
      const tpl = await qc.fetchQuery(templateQuery(templateId));
      patch({ body: tpl.body, body_source: tpl.body_source });
      setNonce((n) => n + 1);
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const onToggleSendLater = (on: boolean) => {
    // Prefill a schedule a week out when there is none yet.
    if (on && !form.sendAtLocal) {
      const d = new Date();
      d.setDate(d.getDate() + 7);
      d.setHours(0, 0, 0, 0);
      patch({ sendLater: true, sendAtLocal: toLocalInput(d.toISOString()) });
    } else patch({ sendLater: on });
  };

  const previewContent = () => {
    if (!campaign) return;
    setPreview({
      title: form.name,
      path: `/api/campaigns/${campaign.id}/preview`,
      method: 'POST',
      fields: {
        template_id: String(form.template_id ?? ''),
        content_type: form.content_type,
        archive_meta: '',
        body: form.body,
      },
    });
  };

  const previewArchive = () => {
    if (!campaign) return;
    setPreview({
      title: form.name,
      path: `/api/campaigns/${campaign.id}/preview/archive`,
      method: 'POST',
      fields: {
        template_id: String(form.archive_template_id ?? ''),
        content_type: form.content_type,
        archive_meta: form.archiveMetaStr,
        body: '',
      },
    });
  };

  // Ctrl/Cmd+S saves (or creates); F9 previews.
  const keys = useRef({ onCreate, onSave, onSaveArchive, previewContent });
  useEffect(() => {
    keys.current = { onCreate, onSave, onSaveArchive, previewContent };
  });
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const k = keys.current;
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        if (isNew) k.onCreate();
        else if (editable) void k.onSave();
        else if (canManage && archivable) k.onSaveArchive();
      } else if (e.key === 'F9' && !isNew) {
        e.preventDefault();
        k.previewContent();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isNew, editable, canManage, archivable]);

  const copy = (v: string) => {
    void navigator.clipboard?.writeText(v);
    toast.success(t('globals.messages.copied'));
  };

  // ---- Render -----------------------------------------------------------

  const tabProps = { form, patch, campaign, editable, templates };
  const busy = save.isPending || create.isPending;
  const attribsSet = form.attribsStr.trim() !== '' && form.attribsStr.trim() !== '{}';
  const TABS: { id: TabId; label: string; mark?: React.ReactNode }[] = [
    { id: 'campaign', label: t.tc('globals.terms.campaign', 1) },
    { id: 'content', label: t('campaigns.content') },
    {
      id: 'attribs',
      label: t('globals.terms.attribs'),
      mark: attribsSet ? <Check className={TAB_ICON_CLASS} /> : null,
    },
    {
      id: 'attachments',
      label: t('campaigns.attachments'),
      mark: form.media.length ? <span>({form.media.length})</span> : null,
    },
    {
      id: 'archive',
      label: t('campaigns.archive'),
      mark: form.archive ? <Check className={TAB_ICON_CLASS} /> : null,
    },
  ];

  return (
    <div>
      <PageHeader
        title={isNew ? t('campaigns.newCampaign') : form.name || campaign.name}
        description={
          campaign ? (
            <span className="inline-flex items-center gap-2" data-testid="campaign-status">
              <StatusBadge tone={statusTone(campaign.status)}>
                {t(`campaigns.status.${campaign.status}`)}
              </StatusBadge>
              {campaign.type === 'optin' ? <StatusBadge>{t('lists.optin')}</StatusBadge> : null}
            </span>
          ) : undefined
        }
        actions={
          campaign ? (
            <>
              {canManage ? (
                <Popover open={testOpen} onOpenChange={setTestOpen}>
                  <PopoverTrigger asChild>
                    <Button variant="outline" data-testid="btn-test">
                      <Mail /> {t('campaigns.sendTest')}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent
                    align="end"
                    className="flex w-96 flex-col gap-3"
                    id="campaign-test"
                  >
                    <TagInput
                      value={testEmails}
                      onChange={setTestEmails}
                      placeholder={t('campaigns.testEmails')}
                      type="email"
                    />
                    <p className="text-muted-foreground text-xs">{t('campaigns.sendTestHelp')}</p>
                    <div className="flex justify-end">
                      <Button onClick={onTest} disabled={test.isPending}>
                        <Send /> {t('campaigns.send')}
                      </Button>
                    </div>
                  </PopoverContent>
                </Popover>
              ) : null}
              <Button variant="outline" onClick={previewContent} data-testid="btn-preview">
                <Eye /> {t('campaigns.preview')}
              </Button>
              {editable ? (
                <Button onClick={() => void onSave()} disabled={busy} data-testid="btn-save">
                  <Save /> {t('globals.buttons.saveChanges')}
                </Button>
              ) : null}
            </>
          ) : undefined
        }
      />

      <div className="mb-6 flex gap-1 overflow-x-auto border-b" role="tablist">
        {TABS.map((x) => (
          <button
            key={x.id}
            type="button"
            role="tab"
            id={`tab-${x.id}`}
            aria-selected={tab === x.id}
            disabled={isNew && x.id !== 'campaign'}
            onClick={() => setTab(x.id)}
            className={cn(
              'inline-flex items-center gap-2 border-b-2 px-3 py-2 text-sm font-medium whitespace-nowrap transition-colors disabled:opacity-40',
              tab === x.id
                ? 'border-primary text-foreground'
                : 'text-muted-foreground hover:text-foreground border-transparent',
            )}
          >
            {x.label}
            {x.mark}
          </button>
        ))}
      </div>

      <div role="tabpanel" aria-labelledby={`tab-${tab}`}>
        {tab === 'campaign' ? (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (isNew) onCreate();
              else if (editable) void onSave();
            }}
          >
            <CampaignTab
              {...tabProps}
              onToggleSendLater={onToggleSendLater}
              scheduleActions={
                campaign && canSend ? (
                  <div className="flex gap-2">
                    {canSchedule(status, form.sendLater, form.sendAtLocal) ? (
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => void onStart()}
                        data-testid="btn-schedule"
                      >
                        <Clock /> {t('campaigns.schedule')}
                      </Button>
                    ) : null}
                    {canUnschedule(status) ? (
                      <Button
                        type="button"
                        variant="outline"
                        className="text-destructive"
                        onClick={() => void onUnschedule()}
                        data-testid="btn-unschedule"
                      >
                        <Clock /> {t('campaigns.unSchedule')}
                      </Button>
                    ) : null}
                  </div>
                ) : null
              }
              footer={
                isNew ? (
                  <div className="flex justify-end">
                    <Button type="submit" disabled={busy || !canManage} data-testid="btn-continue">
                      {t('campaigns.continue')}
                    </Button>
                  </div>
                ) : (
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        onClick={() => copy(String(campaign.id))}
                      >
                        <span className="text-muted-foreground">{t('globals.fields.id')}</span>{' '}
                        {campaign.id} <Copy />
                      </Button>
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        onClick={() => copy(campaign.uuid)}
                      >
                        <span className="text-muted-foreground">{t('globals.fields.uuid')}</span>{' '}
                        {campaign.uuid.slice(0, 8)}… <Copy />
                      </Button>
                    </div>
                    {canSend && canStart(status, form.sendLater) ? (
                      <Button type="button" onClick={() => void onStart()} data-testid="btn-start">
                        <Send /> {t('campaigns.start')}
                      </Button>
                    ) : null}
                  </div>
                )
              }
            />
          </form>
        ) : null}
        {tab === 'content' ? (
          <ContentTab
            {...tabProps}
            nonce={nonce}
            visualRef={visualRef}
            onTypeChange={(to) => void onTypeChange(to)}
            onImportVisual={(tpl) => void onImportVisual(tpl)}
            onBrowseMedia={(done) => setMediaTarget(() => done)}
            onChangeBody={(body, source) =>
              patch(source === undefined ? { body } : { body, body_source: source })
            }
          />
        ) : null}
        {tab === 'attribs' ? <AttribsTab {...tabProps} /> : null}
        {tab === 'attachments' ? (
          <AttachmentsTab
            {...tabProps}
            onAdd={() =>
              setMediaTarget(
                () => (m: Media) =>
                  setForm((f) =>
                    f.media.some((x) => x.id === m.id)
                      ? f
                      : {
                          ...f,
                          media: [
                            ...f.media,
                            {
                              id: m.id,
                              filename: m.filename,
                              url: m.url,
                              thumb_url: m.thumb_url ?? undefined,
                              created_at: m.created_at,
                            },
                          ],
                        },
                  ),
              )
            }
          />
        ) : null}
        {tab === 'archive' ? (
          <ArchiveTab
            {...tabProps}
            canManage={canManage}
            saving={saveArchive.isPending}
            onSave={onSaveArchive}
            onPreview={previewArchive}
          />
        ) : null}
      </div>

      <PreviewDialog source={preview} onClose={() => setPreview(null)} />

      <Dialog open={mediaTarget !== null} onOpenChange={(open) => !open && setMediaTarget(null)}>
        <DialogContent
          className="max-h-[85vh] overflow-y-auto sm:max-w-4xl"
          data-testid="media-picker"
        >
          <DialogHeader>
            <DialogTitle>{t('media.title')}</DialogTitle>
          </DialogHeader>
          <MediaGallery
            mode="pick"
            bare
            onPick={(m) => {
              mediaTarget?.(m);
              setMediaTarget(null);
            }}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
