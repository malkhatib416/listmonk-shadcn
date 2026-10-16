export const TRACK_SUFFIX = '@TrackLink';

// Links marked for click tracking carry a suffix in the href that Go rewrites at send time.
export function splitLinkHref(href: string | null | undefined): { url: string; track: boolean } {
  const h = href ?? '';
  return h.endsWith(TRACK_SUFFIX)
    ? { url: h.slice(0, -TRACK_SUFFIX.length), track: true }
    : { url: h, track: false };
}

export function buildLinkHref(url: string, track: boolean): string {
  const u = url.trim();
  return track && /^https?:\/\//i.test(u) ? u + TRACK_SUFFIX : u;
}

export interface ImageFields {
  alt: string;
  width: string;
  height: string;
  float: string;
  embed: boolean;
}

export const FLOAT_CLASSES = ['img-float-left', 'img-float-right'];

// The attributes to set on an <img>; empty values are omitted.
export function imageAttrs(f: ImageFields): Record<string, string> {
  return Object.fromEntries(
    [
      ['alt', f.alt.trim()],
      ['width', f.width.trim()],
      ['height', f.height.trim()],
      ['class', f.float],
      ['data-embed', f.embed ? 'true' : ''],
    ].filter(([, v]) => v),
  ) as Record<string, string>;
}

export type Block = 'P' | 'H1' | 'H2' | 'H3' | 'H4' | 'H5' | 'H6' | 'BLOCKQUOTE' | 'PRE';

// The block format at a Squire path such as "BODY>BLOCKQUOTE>P".
export function blockFromPath(path: string): Block {
  const m = /(H[1-6]|BLOCKQUOTE|PRE)/.exec(path);
  return (m?.[1] as Block | undefined) ?? 'P';
}

export function tableHtml(rows: number, cols: number): string {
  const row = (cell: string) => `<tr>${`<${cell}></${cell}>`.repeat(cols)}</tr>`;
  const body = Array.from({ length: Math.max(rows - 1, 0) }, () => row('td')).join('');
  return `<table><thead>${row('th')}</thead><tbody>${body}</tbody></table>`;
}
