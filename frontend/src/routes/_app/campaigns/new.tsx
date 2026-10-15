import { createFileRoute } from '@tanstack/react-router';
import { z } from 'zod';
import { CampaignEditor } from '@/components/campaign-editor';

const searchSchema = z
  .object({
    list_id: z
      .union([z.coerce.number().int(), z.array(z.coerce.number().int())])
      .transform((v) => (Array.isArray(v) ? v : [v]))
      .optional()
      .catch(undefined),
  })
  .transform((o) => (o.list_id ? { list_id: o.list_id } : {}));

export const Route = createFileRoute('/_app/campaigns/new')({
  head: () => ({ meta: [{ title: 'New campaign - listmonk' }] }),
  validateSearch: (s: Record<string, unknown>) => searchSchema.parse(s) as { list_id?: number[] },
  component: function NewCampaign() {
    const { list_id } = Route.useSearch();
    return <CampaignEditor listIds={list_id} />;
  },
});
