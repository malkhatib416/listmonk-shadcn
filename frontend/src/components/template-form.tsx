import { useNavigate } from '@tanstack/react-router';
import { Copy, Eye } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { useCan, useT } from '@/components/app-context';
import { PageHeader } from '@/components/page-header';
import { PreviewDialog, type PreviewSource } from '@/components/preview-dialog';
import { StatusBadge } from '@/components/status-badge';
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
import { useApiMutation } from '@/hooks/use-api-mutation';
import { apiFetch } from '@/lib/api';
import type { Template, TemplateType } from '@/lib/templates';
import { CodeEditor } from '@/widgets/code-editor';
import { VisualEditor } from '@/widgets/visual-editor';

// The add / edit form for a template (existing = edit).
export function TemplateForm({ template }: { template?: Template }) {
  const t = useT();
  const can = useCan();
  const navigate = useNavigate();
  const isNew = !template;
  const canManage = can('templates:manage');

  const [name, setName] = useState(template?.name ?? '');
  const [type, setType] = useState<TemplateType>(template?.type ?? 'campaign');
  const [subject, setSubject] = useState(template?.subject ?? '');
  const [body, setBody] = useState(template?.body ?? '');
  const [bodySource, setBodySource] = useState<string | null>(template?.body_source ?? null);
  const [preview, setPreview] = useState<PreviewSource | null>(null);

  const save = useApiMutation({
    mutationFn: () =>
      apiFetch<Template>(isNew ? '/api/templates' : `/api/templates/${template.id}`, {
        method: isNew ? 'POST' : 'PUT',
        body: JSON.stringify({ name, type, subject, body, body_source: bodySource }),
      }),
    invalidate: [['templates']],
    onSuccess: (d) => {
      toast.success(
        t(isNew ? 'globals.messages.created' : 'globals.messages.updated', { name: d.name }),
      );
      if (isNew) void navigate({ to: '/templates', search: {} });
    },
  });

  const openPreview = () =>
    setPreview({
      title: name,
      path: '/api/templates/preview',
      method: 'POST',
      fields: { template_type: type, body },
    });

  // Ctrl/Cmd+S saves, F9 previews (as in the old admin).
  const handlers = useRef({ save: () => {}, preview: () => {} });
  useEffect(() => {
    handlers.current = {
      save: () => canManage && save.mutate(),
      preview: openPreview,
    };
  });
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        handlers.current.save();
      } else if (e.key === 'F9') {
        e.preventDefault();
        handlers.current.preview();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <>
      <PageHeader
        title={isNew ? t('templates.newTemplate') : template.name}
        actions={
          <>
            {template?.is_default ? (
              <StatusBadge tone="success" dot>
                {t('templates.default')}
              </StatusBadge>
            ) : null}
            <Button type="button" variant="outline" onClick={openPreview} data-testid="btn-preview">
              <Eye /> {t('templates.preview')}
            </Button>
          </>
        }
      />
      <form
        className="flex max-w-5xl flex-col gap-6"
        onSubmit={(e) => {
          e.preventDefault();
          if (canManage) save.mutate();
        }}
      >
        <section className="bg-card flex flex-col gap-5 rounded-xl border p-6">
          <h2 className="text-sm font-semibold">{t.tc('globals.terms.template', 1)}</h2>
          <div className="grid gap-5 sm:grid-cols-[1fr_14rem]">
            <div className="flex flex-col gap-2">
              <Label htmlFor="tpl-name">{t('globals.fields.name')}</Label>
              <Input
                id="tpl-name"
                name="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={200}
                required
                disabled={!canManage}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label>{t('globals.fields.type')}</Label>
              <Select
                value={type}
                onValueChange={(v) => setType(v as TemplateType)}
                disabled={!isNew || !canManage}
              >
                <SelectTrigger
                  className="w-full"
                  data-testid="template-type"
                  aria-label={t('globals.fields.type')}
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="campaign">{t.tc('templates.typeCampaignHTML', 1)}</SelectItem>
                  <SelectItem value="campaign_visual">
                    {t.tc('templates.typeCampaignVisual', 1)}
                  </SelectItem>
                  <SelectItem value="tx">{t.tc('templates.typeTransactional', 1)}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          {type === 'tx' ? (
            <div className="flex flex-col gap-2">
              <Label htmlFor="tpl-subject">{t('templates.subject')}</Label>
              <Input
                id="tpl-subject"
                name="subject"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                maxLength={200}
                disabled={!canManage}
              />
            </div>
          ) : null}
        </section>

        <section className="bg-card flex flex-col gap-4 rounded-xl border p-6">
          <h2 className="text-sm font-semibold">{t('campaigns.content')}</h2>
          {type === 'campaign_visual' ? (
            <VisualEditor
              source={bodySource}
              onChange={(c) => {
                setBody(c.body);
                setBodySource(c.source);
              }}
            />
          ) : (
            <CodeEditor
              value={body}
              onChange={setBody}
              lang="html"
              disabled={!canManage}
              ariaLabel={t('campaigns.content')}
            />
          )}
          <p className="text-muted-foreground text-sm">
            {type === 'campaign'
              ? `${t('templates.placeholderHelp', { placeholder: '{{ template "content" . }}' })} `
              : null}
            <a
              href="https://listmonk.app/docs/templating"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline"
            >
              {t('globals.buttons.learnMore')}
            </a>
          </p>
        </section>

        <div className="flex items-center justify-between">
          {template ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                void navigator.clipboard?.writeText(String(template.id));
                toast.success(t('globals.messages.copied'));
              }}
            >
              <span className="text-muted-foreground">{t('globals.fields.id')}</span> {template.id}
              <Copy />
            </Button>
          ) : (
            <span />
          )}
          {canManage ? (
            <Button type="submit" disabled={save.isPending} data-testid="btn-save">
              {t('globals.buttons.save')}
            </Button>
          ) : null}
        </div>
      </form>
      <PreviewDialog source={preview} onClose={() => setPreview(null)} />
    </>
  );
}
