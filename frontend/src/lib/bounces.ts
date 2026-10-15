import { queryOptions } from '@tanstack/react-query';
import { z } from 'zod';
import { apiFetch } from './api';
import type { PageResults } from './paging';

export interface Bounce {
  id: number;
  type: 'soft' | 'hard' | 'complaint';
  source: string;
  meta: Record<string, unknown> | null;
  created_at: string;
  email: string;
  subscriber_id: number;
  subscriber_name?: string;
  subscriber_status: string;
  campaign: { id: number; name: string } | null;
}

const opt = <T extends z.ZodType>(s: T) => s.optional().catch(undefined);

export const bouncesSearchSchema = z
  .object({
    page: opt(z.coerce.number().int().min(1)),
    order_by: opt(z.enum(['email', 'source', 'type', 'created_at'])),
    order: opt(z.enum(['asc', 'desc'])),
    source: opt(z.string().min(1)),
    type: opt(z.enum(['soft', 'hard', 'complaint'])),
    campaign_id: opt(z.coerce.number().int().positive()),
  })
  .transform((o) => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined)));

export type BouncesSearch = {
  page?: number;
  order_by?: 'email' | 'source' | 'type' | 'created_at';
  order?: 'asc' | 'desc';
  source?: string;
  type?: Bounce['type'];
  campaign_id?: number;
};

export const bouncesQuery = (s: BouncesSearch) =>
  queryOptions({
    queryKey: ['bounces', s],
    queryFn: () => {
      const q = new URLSearchParams();
      for (const [k, v] of Object.entries(s)) q.set(k, String(v));
      return apiFetch<PageResults<Bounce>>(`/api/bounces?${q}`);
    },
    placeholderData: (prev) => prev,
  });
