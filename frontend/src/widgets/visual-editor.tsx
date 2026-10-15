import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import { hardHref } from '@/lib/basepath';
import { cn } from '@/lib/utils';

export interface VisualEditorHandle {
  // Put a media URL into the email-builder's image URL input.
  insertMedia: (url: string) => void;
}

export interface VisualEditorProps {
  // The editor document as JSON (the template's/campaign's body_source).
  source: string | null;
  onChange: (change: { source: string; body: string }) => void;
  // Fired when the builder asks for a media picker.
  onSelectMedia?: () => void;
  className?: string;
}

interface EmailBuilder {
  render: (id: string, opts: unknown) => void;
  isRendered: (id: string) => boolean;
  resetDocument: (data: unknown) => void;
}

const CONTAINER = 'visual-editor-container';
const SRCDOC = `<!DOCTYPE html><html><head><style>body{margin:0;padding:0}#${CONTAINER}{width:100%;height:100%}</style></head><body><div id="${CONTAINER}"></div></body></html>`;

// The self-hosted email-builder UMD, loaded on demand into an iframe.
export const VisualEditor = forwardRef<VisualEditorHandle, VisualEditorProps>(function VisualEditor(
  { source, onChange, onSelectMedia, className },
  ref,
) {
  const iframe = useRef<HTMLIFrameElement>(null);
  const initial = useRef(source);
  const changeRef = useRef(onChange);
  const mediaRef = useRef(onSelectMedia);
  useEffect(() => {
    changeRef.current = onChange;
    mediaRef.current = onSelectMedia;
  });

  useImperativeHandle(ref, () => ({
    insertMedia(url) {
      const input =
        iframe.current?.contentDocument?.querySelector<HTMLInputElement>('.image-url input');
      if (!input) return;
      const setter = Object.getOwnPropertyDescriptor(
        window.HTMLInputElement.prototype,
        'value',
      )?.set;
      setter?.call(input, url);
      input.dispatchEvent(new Event('input', { bubbles: true }));
    },
  }));

  useEffect(() => {
    const el = iframe.current;
    if (!el) return;
    let timer: number | undefined;
    let disposed = false;

    const onMessage = (m: MessageEvent) => {
      if (m.data === 'visualeditor.select-media') mediaRef.current?.();
    };
    window.addEventListener('message', onMessage);

    const mount = () => {
      const win = el.contentWindow as (Window & { EmailBuilder?: EmailBuilder }) | null;
      const em = win?.EmailBuilder;
      if (!win || !em || disposed) return;
      if (!em.isRendered(CONTAINER)) {
        em.render(CONTAINER, {
          data: {},
          onChange: (data: unknown, body: string) => {
            // The builder HTML-escapes quotes inside Go {{ templating }}.
            const tpl = body.replace(/\{\{[^}]*\}\}/g, (x) => x.replaceAll('&quot;', '"'));
            changeRef.current({ source: JSON.stringify(data), body: tpl });
          },
        });
      }
      if (!initial.current) return;
      let doc: unknown;
      try {
        doc = JSON.parse(initial.current);
      } catch {
        return;
      }
      let n = 0;
      timer = window.setInterval(() => {
        const c = win.document.getElementById(CONTAINER);
        if (c?.hasChildNodes()) {
          em.resetDocument(doc);
          window.clearInterval(timer);
        } else if ((n += 1) > 20) window.clearInterval(timer);
      }, 100);
    };

    const onLoad = () => {
      const doc = el.contentDocument;
      if (!doc) return;
      const s = doc.createElement('script');
      s.src = `${hardHref(window._LM_ROOT, '/admin/static/email-builder')}/email-builder.umd.js`;
      s.onload = mount;
      doc.head.appendChild(s);
    };
    el.addEventListener('load', onLoad);
    el.srcdoc = SRCDOC;

    return () => {
      disposed = true;
      window.clearInterval(timer);
      window.removeEventListener('message', onMessage);
      el.removeEventListener('load', onLoad);
    };
  }, []);

  return (
    <iframe
      ref={iframe}
      title="Visual email editor"
      className={cn('bg-card h-[70vh] w-full rounded-lg border', className)}
      data-testid="visual-editor"
    />
  );
});
