import { useEffect, useId, useRef, useState } from 'react';
import { useT } from '@/components/app-context';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { apiUrl } from '@/lib/api';

export interface PreviewSource {
  title: string;
  // An API path, e.g. /api/templates/3/preview.
  path: string;
  // GET renders the URL in the frame; POST submits `fields` as a form into the frame.
  method?: 'GET' | 'POST';
  fields?: Record<string, string>;
}

// A modal with an iframe showing a server-rendered preview.
export function PreviewDialog({
  source,
  onClose,
}: {
  source: PreviewSource | null;
  onClose: () => void;
}) {
  const t = useT();
  const frame = useId();
  const form = useRef<HTMLFormElement>(null);
  // The source whose frame has finished loading; anything else is still loading.
  const [loadedFor, setLoadedFor] = useState<PreviewSource | null>(null);
  const loading = loadedFor !== source;
  const url = source ? apiUrl(window._LM_ROOT, source.path) : '';

  useEffect(() => {
    // A POST preview is a form submitted into the iframe.
    if (source?.method === 'POST') form.current?.submit();
  }, [source]);

  return (
    <Dialog open={source !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="flex h-[85vh] max-w-5xl flex-col gap-3 sm:max-w-5xl">
        <DialogHeader>
          <DialogTitle>{source?.title}</DialogTitle>
        </DialogHeader>
        <div className="relative min-h-0 flex-1 overflow-hidden rounded-lg border bg-white">
          {loading ? <Skeleton className="absolute inset-0" /> : null}
          {source?.method === 'POST' ? (
            <form ref={form} method="post" action={url} target={frame} hidden>
              {Object.entries(source.fields ?? {}).map(([k, v]) => (
                <input key={k} type="hidden" name={k} value={v} />
              ))}
            </form>
          ) : null}
          <iframe
            name={frame}
            title={t('templates.preview')}
            src={source && source.method !== 'POST' ? url : undefined}
            onLoad={() => setLoadedFor(source)}
            className="size-full"
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            {t('globals.buttons.close')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
