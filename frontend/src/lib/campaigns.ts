import { queryOptions } from '@tanstack/react-query';
import { z } from 'zod';
import { apiFetch } from './api';
import type { PageResults } from './paging';
import type { Tone } from '@/components/status-badge';

export type CampaignStatus =
  | 'draft'
  | 'scheduled'
  | 'running'
  | 'paused'
  | 'cancelled'
  | 'finished';

export interface Campaign {
  id: number;
  uuid: string;
  name: string;
  subject: string;
  status: CampaignStatus;
  type: 'regular' | 'optin';
  content_type: 'richtext' | 'html' | 'markdown' | 'plain' | 'visual';
  tags: string[];
  lists: { id: number; name: string }[];
  sent: number;
  to_send: number;
  views: number;
  clicks: number;
  bounces: number;
  send_at: string | null;
  started_at: string | null;
  created_at: string;
  updated_at: string;
  rate?: number;
}

export const STATUSES: CampaignStatus[] = [
  'draft',
  'scheduled',
  'running',
  'paused',
  'cancelled',
  'finished',
];

export function campaignActions(c: Pick<Campaign, 'status' | 'send_at'>) {
  const isDone = c.status === 'finished' || c.status === 'cancelled';
  return {
    canStart: c.status === 'draft' && !c.send_at,
    canSchedule: c.status === 'draft' && !!c.send_at,
    canUnschedule: c.status === 'scheduled',
    canPause: c.status === 'running',
    canResume: c.status === 'paused',
    canCancel: c.status === 'running' || c.status === 'paused',
    isDone,
  };
}

export const statusTone = (s: CampaignStatus): Tone =>
  ({
    draft: 'neutral',
    scheduled: 'info',
    running: 'info',
    paused: 'warning',
    cancelled: 'danger',
    finished: 'success',
  })[s] as Tone;

export const progressPercent = (sent: number, toSend: number): number =>
  toSend > 0 ? Math.floor((sent / toSend) * 100) : 0;

export interface RunningStats {
  id: number;
  status: string;
  sent: number;
  to_send: number;
  rate: number;
}

// Overlay the live numbers of running campaigns on the table rows.
export function mergeRunningStats(rows: Campaign[], live: RunningStats[]): Campaign[] {
  if (live.length === 0) return rows;
  const byId = new Map(live.map((s) => [s.id, s]));
  return rows.map((r) => {
    const s = byId.get(r.id);
    return s ? { ...r, sent: s.sent, to_send: s.to_send, rate: s.rate } : r;
  });
}

const opt = <T extends z.ZodType>(s: T) => s.optional().catch(undefined);
const arr = <T extends z.ZodType>(s: T) =>
  z.union([s, z.array(s)]).transform((v) => (Array.isArray(v) ? v : [v]));

export const campaignsSearchSchema = z
  .object({
    page: opt(z.coerce.number().int().min(1)),
    query: opt(z.string().min(1)),
    status: opt(arr(z.enum(['draft', 'scheduled', 'running', 'paused', 'cancelled', 'finished']))),
    type: opt(z.enum(['regular', 'optin'])),
    tag: opt(arr(z.string().min(1))),
    order_by: opt(z.enum(['name', 'created_at', 'updated_at', 'status'])),
    order: opt(z.enum(['asc', 'desc'])),
  })
  .transform((o) => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined)));

export type CampaignsSearch = {
  page?: number;
  query?: string;
  status?: CampaignStatus[];
  type?: 'regular' | 'optin';
  tag?: string[];
  order_by?: 'name' | 'created_at' | 'updated_at' | 'status';
  order?: 'asc' | 'desc';
};

export const campaignsQuery = (s: CampaignsSearch, listId?: number) =>
  queryOptions({
    queryKey: ['campaigns', 'page', s, listId ?? null],
    queryFn: () => {
      const q = new URLSearchParams({ no_body: 'true' });
      for (const [k, v] of Object.entries(s))
        for (const x of Array.isArray(v) ? v : [v]) q.append(k, String(x));
      if (listId) q.set('list_id', String(listId));
      return apiFetch<PageResults<Campaign>>(`/api/campaigns?${q}`);
    },
    placeholderData: (prev) => prev,
  });

export const runningStatsQuery = (enabled: boolean) =>
  queryOptions({
    queryKey: ['campaigns', 'running-stats'],
    enabled,
    queryFn: async () => (await apiFetch<RunningStats[]>('/api/campaigns/running/stats')) ?? [],
    refetchInterval: 1000,
  });

// True when a row the list still shows as running is absent from the live stats: the
// campaign finished (or was paused) since the list was loaded, so the list is stale.
export function stoppedRunning(rows: Campaign[], live: RunningStats[] | undefined): boolean {
  if (!live) return false;
  const ids = new Set(live.map((s) => s.id));
  return rows.some((r) => r.status === 'running' && !ids.has(r.id));
}
