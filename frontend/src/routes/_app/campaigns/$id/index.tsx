import { createFileRoute } from '@tanstack/react-router';
import { CampaignEditor } from '@/components/campaign-editor';

export const Route = createFileRoute('/_app/campaigns/$id/')({
  head: () => ({ meta: [{ title: 'Campaign - listmonk' }] }),
  component: function EditCampaign() {
    const { id } = Route.useParams();
    return <CampaignEditor id={Number(id)} />;
  },
});
