import { useState } from 'react';
import { useT } from '@/components/app-context';
import { SettingsCard, useBind, useSettings } from '@/components/settings/fields';
import { cn } from '@/lib/utils';
import { CodeEditor } from '@/widgets/code-editor';

type Side = 'admin' | 'public';

function Editor({ side, lang }: { side: Side; lang: 'css' | 'javascript' }) {
  const t = useT();
  const bind = useBind();
  const key = `appearance.${side}.custom_${lang === 'css' ? 'css' : 'js'}` as const;
  const b = bind(key);
  const title = t(
    lang === 'css' ? 'settings.appearance.customCSS' : 'settings.appearance.customJS',
  );
  return (
    <SettingsCard block={`appearance.${side}-${lang === 'css' ? 'css' : 'js'}`} title={title}>
      <CodeEditor
        value={b.value}
        onChange={b.onChange}
        lang={lang}
        ariaLabel={title}
        className="min-h-48 rounded-lg border"
      />
    </SettingsCard>
  );
}

export function AppearanceTab() {
  const t = useT();
  const { match } = useSettings();
  const [side, setSide] = useState<Side>('admin');
  // While searching, every matching editor is shown whichever side it is on.
  const sides: Side[] = match ? ['admin', 'public'] : [side];

  return (
    <>
      <div role="tablist" className={cn('flex gap-1 border-b', match && 'hidden')}>
        {(['admin', 'public'] as const).map((s) => (
          <button
            key={s}
            type="button"
            role="tab"
            aria-selected={side === s}
            onClick={() => setSide(s)}
            className={cn(
              '-mb-px border-b-2 px-3 py-2 text-sm font-medium',
              side === s
                ? 'border-primary text-foreground'
                : 'text-muted-foreground hover:text-foreground border-transparent',
            )}
          >
            {t(s === 'admin' ? 'settings.appearance.adminName' : 'settings.appearance.publicName')}
          </button>
        ))}
      </div>
      {sides.map((sd) => (
        <div key={sd} className="flex flex-col gap-6">
          {match ? null : (
            <p className="text-muted-foreground text-sm">
              {t(
                sd === 'admin' ? 'settings.appearance.adminHelp' : 'settings.appearance.publicHelp',
              )}
            </p>
          )}
          <Editor side={sd} lang="css" />
          <Editor side={sd} lang="javascript" />
        </div>
      ))}
    </>
  );
}
