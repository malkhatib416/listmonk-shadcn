import { queryOptions } from '@tanstack/react-query';
import { z } from 'zod';
import { apiFetch } from './api';
import type { PageResults } from './paging';

export interface ListRef {
  id: number;
  name: string;
}

// Every list (id + name only), for pickers.
export const listsMinimalQuery = queryOptions({
  queryKey: ['lists', 'minimal'],
  queryFn: async () =>
    (await apiFetch<{ results: ListRef[] }>('/api/lists?minimal=true&per_page=all')).results ?? [],
});

// Add the id if absent, remove it if present.
export const toggleId = (ids: number[], id: number): number[] =>
  ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id];

export interface List {
  id: number;
  uuid: string;
  name: string;
  type: 'public' | 'private';
  optin: 'single' | 'double';
  status: 'active' | 'archived';
  tags: string[];
  description: string;
  subscriber_count: number;
  subscriber_statuses: Record<string, number>;
  created_at: string;
  updated_at: string;
}

const opt = <T extends z.ZodType>(s: T) => s.optional().catch(undefined);

export const listsSearchSchema = z
  .object({
    page: opt(z.coerce.number().int().min(1)),
    query: opt(z.string().min(1)),
    order_by: opt(z.enum(['name', 'type', 'subscriber_count', 'created_at'])),
    order: opt(z.enum(['asc', 'desc'])),
    type: opt(z.enum(['public', 'private'])),
    optin: opt(z.enum(['single', 'double'])),
    status: opt(z.enum(['active', 'archived'])),
    // ?tag=a&tag=b: a list matches when it has every tag.
    tag: opt(
      z
        .union([z.string(), z.array(z.string())])
        .transform((v) => (Array.isArray(v) ? v : [v]).filter(Boolean))
        .pipe(z.array(z.string()).min(1)),
    ),
  })
  .transform((o) => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined)));

export type ListsSearch = {
  page?: number;
  query?: string;
  order_by?: 'name' | 'type' | 'subscriber_count' | 'created_at';
  order?: 'asc' | 'desc';
  type?: List['type'];
  optin?: List['optin'];
  status?: List['status'];
  tag?: string[];
};

export const listsQuery = (s: ListsSearch) =>
  queryOptions({
    queryKey: ['lists', 'page', s],
    queryFn: () => {
      const q = new URLSearchParams();
      for (const [k, v] of Object.entries(s)) {
        for (const x of Array.isArray(v) ? v : [v]) q.append(k, String(x));
      }
      return apiFetch<PageResults<List>>(`/api/lists?${q}`);
    },
    placeholderData: (prev) => prev,
  });

export const listQuery = (id: number) =>
  queryOptions({ queryKey: ['lists', id], queryFn: () => apiFetch<List>(`/api/lists/${id}`) });

export interface ListFormValues {
  name: string;
  type: List['type'];
  optin: List['optin'];
  status: List['status'];
  tags: string[];
  description: string;
}

export const listFormDefaults = (l?: List): ListFormValues => ({
  name: l?.name ?? '',
  type: l?.type ?? 'private',
  optin: l?.optin ?? 'single',
  status: l?.status ?? 'active',
  tags: l?.tags ?? [],
  description: l?.description ?? '',
});

// The statuses shown in a list's subscriber breakdown: single opt-in lists only track
// unsubscribed; double opt-in lists also confirmed and unconfirmed.
export const breakdownStatuses = (optin: List['optin']): string[] =>
  optin === 'double' ? ['confirmed', 'unconfirmed', 'unsubscribed'] : ['unsubscribed'];

// Normalise a tag typed or pasted into the tag input.
export const cleanTag = (t: string): string => t.trim().replace(/^#/, '');

export const toggleStr = (xs: string[], x: string): string[] =>
  xs.includes(x) ? xs.filter((y) => y !== x) : [...xs, x];
