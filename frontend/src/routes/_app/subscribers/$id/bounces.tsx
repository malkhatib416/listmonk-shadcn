import { createFileRoute } from '@tanstack/react-router';
import { SubscriberDetail } from '@/components/subscriber-detail';

export const Route = createFileRoute('/_app/subscribers/$id/bounces')({
  head: () => ({ meta: [{ title: 'Subscriber - listmonk' }] }),
  component: function SubscriberTab() {
    const { id } = Route.useParams();
    return <SubscriberDetail id={Number(id)} tab="bounces" />;
  },
});
