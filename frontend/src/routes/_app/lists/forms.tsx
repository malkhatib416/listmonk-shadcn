import { useQuery } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';
import { ArrowUpRight, Copy } from 'lucide-react';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { useApp, useT } from '@/components/app-context';
import { PageHeader } from '@/components/page-header';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Skeleton } from '@/components/ui/skeleton';
import { formHtml, publicListsQuery } from '@/lib/forms';
import { toggleStr } from '@/lib/lists';
import { CodeEditor } from '@/widgets/code-editor';

export const Route = createFileRoute('/_app/lists/forms')({
  head: () => ({ meta: [{ title: 'Forms - listmonk' }] }),
  component: FormsPage,
});

function FormsPage() {
  const t = useT();
  const { config } = useApp();
  const { data: lists, isPending, error } = useQuery(publicListsQuery);
  const [selected, setSelected] = useState<string[]>([]);
  const [redirect, setRedirect] = useState('');
  const sub = config.public_subscription;
  const redirects = sub?.redirect_urls ?? [];

  const html = useMemo(
    () =>
      formHtml({
        lists: lists ?? [],
        selected,
        redirect,
        rootUrl: config.root_url,
        captcha: {
          enabled: !!sub?.captcha_enabled,
          provider: sub?.captcha_provider,
          key: sub?.captcha_key,
        },
        t,
      }),
    [lists, selected, redirect, config.root_url, sub, t],
  );

  return (
    <>
      <PageHeader
        title={t('forms.title')}
        actions={
          sub?.enabled ? (
            <Button variant="outline" size="sm" asChild data-testid="url">
              <a
                href={`${config.root_url}/subscription/form`}
                target="_blank"
                rel="noopener noreferrer"
              >
                <ArrowUpRight /> {t('forms.publicSubPage')}
              </a>
            </Button>
          ) : null
        }
      />
      {error ? (
        <p className="text-destructive text-sm">{error.message}</p>
      ) : isPending ? (
        <Skeleton className="h-64 max-w-5xl" />
      ) : lists.length === 0 ? (
        <p className="bg-card text-muted-foreground max-w-xl rounded-xl border p-6 text-sm">
          {t('forms.noPublicLists')}
        </p>
      ) : (
        <div className="grid max-w-6xl gap-6 lg:grid-cols-[18rem_1fr]">
          <div className="flex flex-col gap-6">
            <section className="bg-card rounded-xl border p-5">
              <h2 className="text-sm font-semibold">{t('globals.terms.lists')}</h2>
              <p className="text-muted-foreground mt-1 mb-4 text-xs">{t('forms.selectHelp')}</p>
              <ul className="flex flex-col gap-3" data-testid="lists">
                {lists.map((l) => (
                  <li key={l.uuid} className="flex items-center gap-2">
                    <Checkbox
                      id={`l-${l.uuid}`}
                      data-uuid={l.uuid}
                      checked={selected.includes(l.uuid)}
                      onCheckedChange={() => setSelected(toggleStr(selected, l.uuid))}
                    />
                    <Label htmlFor={`l-${l.uuid}`} className="font-normal">
                      {l.name}
                    </Label>
                  </li>
                ))}
              </ul>
            </section>
            {redirects.length > 0 ? (
              <section className="bg-card rounded-xl border p-5">
                <h2 className="text-sm font-semibold">{t('forms.redirectURL')}</h2>
                <p className="text-muted-foreground mt-1 mb-4 text-xs">
                  {t('forms.redirectURLHelp')}
                </p>
                <RadioGroup
                  value={redirect}
                  onValueChange={setRedirect}
                  data-testid="redirect-urls"
                >
                  <div className="flex items-center gap-2">
                    <RadioGroupItem id="redirect-none" value="" />
                    <Label htmlFor="redirect-none" className="font-normal">
                      {t('globals.terms.none')}
                    </Label>
                  </div>
                  {redirects.map((u, i) => (
                    <div key={u} className="flex items-center gap-2">
                      <RadioGroupItem id={`redirect-${i}`} value={u} />
                      <Label htmlFor={`redirect-${i}`} className="font-normal break-all">
                        {u}
                      </Label>
                    </div>
                  ))}
                </RadioGroup>
              </section>
            ) : null}
          </div>
          <section
            className="bg-card flex flex-col gap-3 rounded-xl border p-5"
            data-testid="form"
            aria-label={t('forms.formHTML')}
          >
            <h2 className="text-sm font-semibold">{t('forms.formHTML')}</h2>
            <p className="text-muted-foreground text-xs">{t('forms.formHTMLHelp')}</p>
            {html ? (
              <>
                <div className="flex justify-end">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      void navigator.clipboard?.writeText(html);
                      toast.success(t('globals.messages.copied'));
                    }}
                  >
                    <Copy /> {t('globals.buttons.copy')}
                  </Button>
                </div>
                <CodeEditor value={html} lang="html" disabled ariaLabel={t('forms.formHTML')} />
              </>
            ) : null}
          </section>
        </div>
      )}
    </>
  );
}
