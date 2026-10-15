import { queryOptions } from '@tanstack/react-query';
import { z } from 'zod';
import { apiFetch } from './api';

export type TemplateType = 'campaign' | 'campaign_visual' | 'tx';

export interface Template {
  id: number;
  name: string;
  type: TemplateType;
  subject: string;
  body: string;
  body_source: string | null;
  is_default: boolean;
  created_at: string;
  updated_at: string;
}

export const templatesSearchSchema = z
  .object({ type: z.enum(['campaign', 'campaign_visual', 'tx']).optional().catch(undefined) })
  .transform((o) => (o.type ? { type: o.type } : {}));

export function filterTemplates(
  templates: Template[],
  f: { type?: TemplateType; query?: string },
): Template[] {
  const q = f.query?.trim().toLowerCase();
  return templates.filter(
    (t) =>
      (!f.type || t.type === f.type) &&
      (!q || t.name.toLowerCase().includes(q) || t.subject.toLowerCase().includes(q)),
  );
}

export const templatesQuery = queryOptions({
  queryKey: ['templates'],
  queryFn: () => apiFetch<Template[]>('/api/templates?no_body=true'),
});

export const templateQuery = (id: number) =>
  queryOptions({
    queryKey: ['templates', id],
    queryFn: () => apiFetch<Template>(`/api/templates/${id}`),
  });
