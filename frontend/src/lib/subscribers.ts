import { queryOptions } from '@tanstack/react-query';
import { z } from 'zod';
import { apiFetch, apiUrl } from './api';
import type { PageResults } from './paging';

export interface SubList {
  id: number;
  name: string;
  type: 'public' | 'private';
  optin: 'single' | 'double';
  subscription_status: 'unconfirmed' | 'confirmed' | 'unsubscribed';
  subscription_created_at: string | null;
  subscription_updated_at: string | null;
  restricted?: boolean;
}

export interface Subscriber {
  id: number;
  uuid: string;
  email: string;
  name: string;
  status: 'enabled' | 'blocklisted';
  attribs: Record<string, unknown>;
  lists: SubList[] | null;
  created_at: string;
  updated_at: string;
}

const opt = <T extends z.ZodType>(s: T) => s.optional().catch(undefined);

export const subscribersSearchSchema = z
  .object({
    page: opt(z.coerce.number().int().min(1)),
    search: opt(z.string().min(1)),
    query: opt(z.string().min(1)),
    list_id: opt(
      z
        .union([z.coerce.number().int().positive(), z.array(z.coerce.number().int().positive())])
        .transform((v) => (Array.isArray(v) ? v : [v])),
    ),
    status: opt(z.enum(['enabled', 'blocklisted'])),
    subscription_status: opt(z.enum(['unconfirmed', 'confirmed', 'unsubscribed', 'none'])),
    order_by: opt(z.enum(['email', 'name', 'created_at', 'updated_at'])),
    order: opt(z.enum(['asc', 'desc'])),
  })
  .transform((o) => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined)));

export type SubscribersSearch = {
  page?: number;
  search?: string;
  query?: string;
  list_id?: number[];
  status?: Subscriber['status'];
  subscription_status?: SubList['subscription_status'] | 'none';
  order_by?: 'email' | 'name' | 'created_at' | 'updated_at';
  order?: 'asc' | 'desc';
};

export const subscribersQuery = (s: SubscribersSearch) =>
  queryOptions({
    queryKey: ['subscribers', 'page', s],
    queryFn: () => {
      const q = new URLSearchParams();
      for (const [k, v] of Object.entries(s))
        for (const x of Array.isArray(v) ? v : [v]) q.append(k, String(x));
      return apiFetch<PageResults<Subscriber>>(`/api/subscribers?${q}`);
    },
    placeholderData: (prev) => prev,
  });

export const subscriberQuery = (id: number) =>
  queryOptions({
    queryKey: ['subscribers', id],
    queryFn: () => apiFetch<Subscriber>(`/api/subscribers/${id}`),
  });

// The body of the "by query" bulk endpoints (delete / blocklist / manage lists): "all" is
// true when no search or SQL narrows the filters, which the server treats as everyone matching.
export function queryBody(s: SubscribersSearch) {
  const search = s.search ?? '';
  const query = s.query ?? '';
  return {
    all: query.trim() === '' && search.trim() === '',
    search,
    query,
    list_ids: s.list_id ?? [],
    subscription_status: s.subscription_status ?? null,
    subscriber_status: s.status ?? '',
  };
}

export function exportUrl(root: string | undefined, s: SubscribersSearch, ids: number[]): string {
  const q = new URLSearchParams();
  if (s.search) q.append('search', s.search);
  if (s.query) q.append('query', s.query);
  for (const id of s.list_id ?? []) q.append('list_id', String(id));
  if (s.status) q.append('status', s.status);
  if (s.subscription_status) q.append('subscription_status', s.subscription_status);
  for (const id of ids) q.append('id', String(id));
  return apiUrl(root, `/api/subscribers/export?${q}`);
}

export type ParsedAttribs =
  | { ok: true; value: Record<string, unknown> }
  | { ok: false; error: string };

// The attributes textarea: blank is {}, anything that is not a JSON object is an error.
export function parseAttribs(text: string): ParsedAttribs {
  if (!text.trim()) return { ok: true, value: {} };
  try {
    const v: unknown = JSON.parse(text);
    if (v === null || typeof v !== 'object' || Array.isArray(v))
      return { ok: false, error: 'not an object' };
    return { ok: true, value: v as Record<string, unknown> };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

export interface ManageListsForm {
  action: 'add' | 'remove' | 'unsubscribe';
  lists: number[];
  preconfirm: boolean;
}

export function manageListsBody(
  f: ManageListsForm,
  target: { ids: number[] } | { query: ReturnType<typeof queryBody> },
) {
  return {
    action: f.action,
    target_list_ids: f.lists,
    ...(f.preconfirm ? { status: 'confirmed' } : {}),
    ...('ids' in target ? { ids: target.ids } : target.query),
  };
}

export const hasOptinList = (all: { id: number; optin: string }[], chosen: number[]): boolean =>
  all.some((l) => chosen.includes(l.id) && l.optin === 'double');

export function visibleLists<T>(lists: T[], max: number): { shown: T[]; hidden: T[] } {
  return { shown: lists.slice(0, max), hidden: lists.slice(max) };
}
