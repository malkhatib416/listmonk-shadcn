import { queryOptions } from '@tanstack/react-query';
import { z } from 'zod';
import { apiFetch } from './api';

export interface AnalyticsItem {
  id: number;
  name: string;
  sent?: number;
}

export interface CountRow {
  campaign_id?: number;
  list_id?: number;
  timestamp: string;
  count: number;
}

export interface LinkRow {
  url: string;
  count: number;
}

export interface Analytics {
  resource: 'campaigns' | 'lists';
  can_view_campaign_charts: boolean;
  from: string;
  to: string;
  interval: string;
  disable_tracking: boolean;
  individual_tracking: boolean;
  has_data: boolean;
  counts: {
    subscriptions: number;
    unsubscriptions: number;
    views: number;
    clicks: number;
    bounces: number;
  };
  data: {
    items: AnalyticsItem[];
    subscriptions: CountRow[] | null;
    unsubscriptions: CountRow[] | null;
    views: CountRow[] | null;
    clicks: CountRow[] | null;
    bounces: CountRow[] | null;
    links: LinkRow[] | null;
  };
}

const pad = (n: number) => String(n).padStart(2, '0');

// "2026-10-09 10:05" for an axis label.
export function toLabel(s: string): string {
  const d = new Date(s);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// "50 (25.00%)": the count and, when the campaign's sent total is known, its share.
export function formatCount(count: number, sent: number | undefined): string {
  return sent && sent > 0 ? `${count} (${((count / sent) * 100).toFixed(2)}%)` : `${count}`;
}

export function groupCounts(rows: CountRow[] | null | undefined, idKey: 'campaign_id' | 'list_id') {
  const groups = new Map<number, { points: { ts: string; count: number }[]; total: number }>();
  for (const row of rows ?? []) {
    const id = row[idKey];
    if (id === undefined) continue;
    const g = groups.get(id) ?? { points: [], total: 0 };
    g.points.push({ ts: row.timestamp, count: row.count });
    g.total += row.count;
    groups.set(id, g);
  }
  return groups;
}

// Rows for a multi-series chart: one per timestamp, with a `${prefix}${id}` column per item.
export function chartRows(
  rows: CountRow[] | null | undefined,
  idKey: 'campaign_id' | 'list_id',
  prefix: string,
): Record<string, number | string>[] {
  const byTs = new Map<string, Record<string, number | string>>();
  const ids = new Set<number>();
  for (const row of rows ?? []) {
    const id = row[idKey];
    if (id === undefined) continue;
    ids.add(id);
    const r = byTs.get(row.timestamp) ?? { ts: row.timestamp };
    r[`${prefix}${id}`] = row.count;
    byTs.set(row.timestamp, r);
  }
  // A missing point is 0, so every line spans the whole range.
  return [...byTs.values()]
    .sort((a, b) => String(a.ts).localeCompare(String(b.ts)))
    .map((r) => {
      for (const id of ids) r[`${prefix}${id}`] ??= 0;
      return r;
    });
}

// A short label for a clicked link.
export function linkLabel(url: string): string {
  try {
    const u = new URL(url);
    return url.length > 80 ? `${u.hostname}${u.pathname.slice(0, 50)}..` : u.hostname + u.pathname;
  } catch {
    return url;
  }
}

// ?id=1&id=2&from=...&to=...&interval=day
const opt = <T extends z.ZodType>(s: T) => s.optional().catch(undefined);
export const analyticsSearchSchema = z
  .object({
    id: opt(
      z
        .union([z.coerce.number().int().positive(), z.array(z.coerce.number().int().positive())])
        .transform((v) => (Array.isArray(v) ? v : [v])),
    ),
    from: opt(z.string().min(16)),
    to: opt(z.string().min(16)),
    interval: opt(z.enum(['hour', 'day', 'week', 'month'])),
  })
  .transform((o) => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined)));

export type AnalyticsSearch = {
  id?: number[];
  from?: string;
  to?: string;
  interval?: 'hour' | 'day' | 'week' | 'month';
};

export const analyticsQuery = (resource: 'campaigns' | 'lists', s: AnalyticsSearch) =>
  queryOptions({
    queryKey: ['analytics', resource, s],
    enabled: (s.id?.length ?? 0) > 0,
    queryFn: () => {
      const q = new URLSearchParams();
      for (const [k, v] of Object.entries(s))
        for (const x of Array.isArray(v) ? v : [v]) q.append(k, String(x));
      return apiFetch<Analytics>(`/api/analytics/${resource}?${q}`);
    },
  });
