import { ExternalLink, Settings2 } from 'lucide-react';
import { type RefObject } from 'react';
import { useT } from '@/components/app-context';
import { useConfirm } from '@/components/confirm-dialog';
import { FormatSelect, TemplateSelect, type TabProps } from '@/components/campaign-tabs';
import { Field, Section } from '@/components/form-field';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { htmlToText } from '@/lib/content';
import type { ContentType } from '@/lib/campaign-form';
import type { Media } from '@/lib/media';
import { CodeEditor } from '@/widgets/code-editor';
import { RichTextEditor } from '@/widgets/rich-text-editor';
import { VisualEditor, type VisualEditorHandle } from '@/widgets/visual-editor';
import { useState } from 'react';

export interface ContentTabProps extends TabProps {
  // Changes when the body is replaced from outside (format conversion, visual template
  // import); remounts the editor so it picks up the new document.
  nonce: number;
  visualRef: RefObject<VisualEditorHandle | null>;
  onTypeChange: (to: ContentType) => void;
  onImportVisual: (templateId: number) => void;
  onBrowseMedia: (done: (m: Media) => void) => void;
  onChangeBody: (body: string, source?: string | null) => void;
}

// Format and template of the content, in a popover above the editor.
function ContentSettings({
  form,
  patch,
  templates,
  editable,
  onTypeChange,
  onImportVisual,
}: Pick<
  ContentTabProps,
  'form' | 'patch' | 'templates' | 'editable' | 'onTypeChange' | 'onImportVisual'
>) {
  const t = useT();
  const [visualTpl, setVisualTpl] = useState<number | null>(null);
  const isVisual = form.content_type === 'visual';
  const campaignTpls = templates.filter((x) => x.type === 'campaign');
  const visualTpls = templates.filter((x) => x.type === 'campaign_visual');
  const tpl = (isVisual ? visualTpls : campaignTpls).find(
    (x) => x.id === (isVisual ? visualTpl : form.template_id),
  );
  const label = tpl
    ? `${t(`campaigns.contentType.${form.content_type}`)} / ${tpl.name}`
    : t(`campaigns.contentType.${form.content_type}`);

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button type="button" variant="outline" size="sm" data-testid="content-settings">
          <Settings2 /> {label}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="flex w-80 flex-col gap-4">
        <Field label={t('campaigns.format')} htmlFor="cs-format">
          <FormatSelect
            id="cs-format"
            value={form.content_type}
            onChange={onTypeChange}
            disabled={!editable}
          />
        </Field>
        {isVisual ? (
          <Field label={t.tc('globals.terms.template', 1)} htmlFor="cs-vtpl">
            <div className="flex gap-2">
              <div className="flex-1">
                <TemplateSelect
                  id="cs-vtpl"
                  value={visualTpl}
                  onChange={setVisualTpl}
                  templates={visualTpls}
                  disabled={!editable}
                  allowNone
                />
              </div>
              <Button
                type="button"
                disabled={!editable || visualTpl === null}
                onClick={() => visualTpl !== null && onImportVisual(visualTpl)}
                data-testid="import-visual-template"
              >
                {t('globals.terms.import')}
              </Button>
            </div>
          </Field>
        ) : (
          <Field label={t.tc('globals.terms.template', 1)} htmlFor="cs-tpl">
            <TemplateSelect
              id="cs-tpl"
              value={form.template_id}
              onChange={(template_id) => patch({ template_id })}
              templates={campaignTpls}
              disabled={!editable}
            />
          </Field>
        )}
        <a
          href="https://listmonk.app/docs/templating/#template-expressions"
          target="_blank"
          rel="noopener noreferrer"
          className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 text-xs"
        >
          <ExternalLink className="size-3.5" /> {t('campaigns.templatingRef')}
        </a>
      </PopoverContent>
    </Popover>
  );
}

export function ContentTab(props: ContentTabProps) {
  const { form, patch, editable, nonce, visualRef, onBrowseMedia, onChangeBody } = props;
  const t = useT();
  const confirm = useConfirm();
  const key = `${form.content_type}-${nonce}`;

  const toggleAlt = async (on: boolean) => {
    if (on) {
      patch({ altbody: htmlToText(form.body) });
    } else if (await confirm({ title: t('globals.messages.confirm') })) {
      patch({ altbody: null });
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-end">
        <ContentSettings {...props} />
      </div>

      <div data-testid="editor-body">
        {form.content_type === 'richtext' ? (
          <RichTextEditor
            key={key}
            value={form.body}
            onChange={(body) => onChangeBody(body)}
            disabled={!editable}
            onBrowseMedia={(done) => onBrowseMedia((m) => done(m.url))}
          />
        ) : form.content_type === 'html' || form.content_type === 'markdown' ? (
          <CodeEditor
            key={key}
            lang={form.content_type}
            value={form.body}
            onChange={(body) => onChangeBody(body)}
            disabled={!editable}
            className="min-h-[420px] rounded-lg border"
            ariaLabel={t('campaigns.content')}
          />
        ) : form.content_type === 'plain' ? (
          <Textarea
            key={key}
            name="content"
            aria-label={t('campaigns.content')}
            value={form.body}
            onChange={(e) => onChangeBody(e.target.value)}
            disabled={!editable}
            className="min-h-[420px] font-mono"
          />
        ) : (
          <VisualEditor
            key={key}
            ref={visualRef}
            source={form.body_source}
            onChange={({ source, body }) => onChangeBody(body, source)}
            onSelectMedia={() => onBrowseMedia((m) => visualRef.current?.insertMedia(m.url))}
          />
        )}
      </div>

      {editable && form.content_type !== 'plain' ? (
        <Section>
          <Label className="gap-3 font-normal">
            <Switch
              checked={form.altbody !== null}
              onCheckedChange={(on) => void toggleAlt(on)}
              data-testid="altbody-toggle"
            />
            {t('campaigns.addAltText')}
          </Label>
          {form.altbody !== null ? (
            <Textarea
              rows={10}
              aria-label={t('campaigns.addAltText')}
              value={form.altbody}
              onChange={(e) => patch({ altbody: e.target.value })}
            />
          ) : null}
        </Section>
      ) : null}
    </div>
  );
}
