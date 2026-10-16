import { queryOptions } from '@tanstack/react-query';
import { apiFetch } from './api';
import type { Campaign, CampaignStatus } from './campaigns';

export type ContentType = Campaign['content_type'];

export interface MediaRef {
  id: number;
  filename: string;
  url?: string;
  thumb_url?: string;
  created_at?: string;
}

// A campaign as returned by GET /api/campaigns/:id (the list rows omit most of this).
export interface CampaignDetail extends Campaign {
  from_email: string;
  messenger: string;
  template_id: number | null;
  body: string;
  body_source: string | null;
  altbody: string | null;
  headers: Record<string, string>[];
  attribs: Record<string, unknown> | null;
  media: MediaRef[];
  archive: boolean;
  archive_slug: string | null;
  archive_template_id: number | null;
  archive_meta: Record<string, unknown> | null;
}

export interface CampaignFormValues {
  name: string;
  subject: string;
  tags: string[];
  lists: number[];
  from_email: string;
  messenger: string;
  content_type: ContentType;
  template_id: number | null;
  body: string;
  body_source: string | null;
  altbody: string | null;
  media: MediaRef[];
  headersStr: string;
  attribsStr: string;
  archive: boolean;
  archive_slug: string;
  archive_template_id: number | null;
  archiveMetaStr: string;
  sendLater: boolean;
  sendAtLocal: string;
}

export interface FormDefaults {
  fromEmail: string;
  templateId: number | null;
  messenger: string;
  listIds?: number[];
}

const pretty = (v: unknown) => JSON.stringify(v, null, 4);

// An ISO instant as a value for <input type="datetime-local"> in local time.
export function toLocalInput(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

export function formFromCampaign(c: CampaignDetail | null, d: FormDefaults): CampaignFormValues {
  return {
    name: c?.name ?? '',
    subject: c?.subject ?? '',
    tags: c?.tags ?? [],
    lists: c ? c.lists.map((l) => l.id) : (d.listIds ?? []),
    from_email: c?.from_email || d.fromEmail,
    messenger: c?.messenger || d.messenger,
    content_type: c?.content_type ?? 'richtext',
    template_id: c?.template_id ?? d.templateId,
    body: c?.body ?? '',
    body_source: c?.body_source ?? null,
    altbody: c?.altbody ?? null,
    media: c?.media ?? [],
    headersStr: pretty(c?.headers ?? []),
    attribsStr: c?.attribs ? pretty(c.attribs) : '{}',
    archive: !!c?.archive,
    archive_slug: c?.archive_slug ?? '',
    archive_template_id: c?.archive_template_id ?? d.templateId,
    archiveMetaStr: c?.archive_meta ? pretty(c.archive_meta) : '{}',
    sendLater: !!c?.send_at,
    sendAtLocal: toLocalInput(c?.send_at),
  };
}

export interface CampaignPayload {
  name: string;
  subject: string;
  lists: number[];
  from_email: string;
  messenger: string;
  type: 'regular';
  tags: string[];
  send_at: string | null;
  headers: Record<string, string>[];
  attribs: Record<string, unknown> | null;
  template_id: number | null;
  content_type: ContentType;
  body: string;
  body_source: string | null;
  altbody: string | null;
  archive: boolean;
  archive_slug: string;
  archive_template_id: number | null;
  archive_meta: Record<string, unknown>;
  media: number[];
}

export type PayloadResult =
  | { ok: true; payload: CampaignPayload }
  | { ok: false; field: 'headers' | 'attribs' | 'archive_meta'; detail: string };

const parse = <T>(s: string): { ok: true; value: T } | { ok: false; detail: string } => {
  try {
    return { ok: true, value: JSON.parse(s) as T };
  } catch (e) {
    return { ok: false, detail: String(e) };
  }
};

export function buildPayload(f: CampaignFormValues): PayloadResult {
  let headers: Record<string, string>[] = [];
  const hs = f.headersStr.trim();
  if (hs && hs !== '[]') {
    const r = parse<Record<string, string>[]>(hs);
    if (!r.ok) return { ok: false, field: 'headers', detail: r.detail };
    headers = r.value;
  }

  let attribs: Record<string, unknown> | null = null;
  const as = f.attribsStr.trim();
  if (as) {
    const r = parse<Record<string, unknown>>(as);
    if (!r.ok) return { ok: false, field: 'attribs', detail: r.detail };
    attribs = r.value;
  }

  let archiveMeta: Record<string, unknown> = {};
  if (f.archive && f.archiveMetaStr.trim()) {
    const r = parse<Record<string, unknown>>(f.archiveMetaStr);
    if (!r.ok) return { ok: false, field: 'archive_meta', detail: r.detail };
    archiveMeta = r.value;
  }

  return {
    ok: true,
    payload: {
      name: f.name,
      subject: f.subject,
      lists: f.lists,
      from_email: f.from_email,
      messenger: f.messenger,
      type: 'regular',
      tags: f.tags,
      send_at: f.sendLater && f.sendAtLocal ? new Date(f.sendAtLocal).toISOString() : null,
      headers,
      attribs,
      template_id: f.template_id,
      content_type: f.content_type,
      body: f.body,
      body_source: f.body_source,
      altbody: f.content_type !== 'plain' ? f.altbody : null,
      archive: f.archive,
      archive_slug: f.archive_slug,
      archive_template_id: f.archive_template_id,
      archive_meta: archiveMeta,
      media: f.media.filter((m) => m.id).map((m) => m.id),
    },
  };
}

export const canEdit = (status: CampaignStatus) =>
  status === 'draft' || status === 'scheduled' || status === 'paused';

export const canStart = (status: CampaignStatus, sendLater: boolean) =>
  (status === 'draft' || status === 'paused') && !sendLater;

export const canSchedule = (status: CampaignStatus, sendLater: boolean, sendAtLocal: string) =>
  (status === 'draft' || status === 'paused') && sendLater && !!sendAtLocal;

export const canUnschedule = (status: CampaignStatus) => status === 'scheduled';

export const canArchive = (status: CampaignStatus, type: Campaign['type']) =>
  status !== 'cancelled' && type !== 'optin';

export const campaignQuery = (id: number) =>
  queryOptions({
    queryKey: ['campaigns', id],
    queryFn: () => apiFetch<CampaignDetail>(`/api/campaigns/${id}`),
  });

export const CAMPAIGN_TABS = ['campaign', 'content', 'attribs', 'attachments', 'archive'] as const;
export type CampaignTab = (typeof CAMPAIGN_TABS)[number];

// The editor tab lives in the URL hash (#tab=content) so it can be linked and survives reloads.
export function tabFromHash(hash: string | undefined): CampaignTab {
  const tab = new URLSearchParams((hash ?? '').replace(/^#/, '')).get('tab');
  return CAMPAIGN_TABS.find((t) => t === tab) ?? 'campaign';
}

// The archive metadata box, for saving the archive settings on their own: it is sent as
// typed whether or not archiving is currently on.
export function parseArchiveMeta(
  s: string,
): { ok: true; meta: Record<string, unknown> } | { ok: false; detail: string } {
  if (!s.trim()) return { ok: true, meta: {} };
  const r = parse<Record<string, unknown>>(s);
  return r.ok ? { ok: true, meta: r.value } : { ok: false, detail: r.detail };
}
