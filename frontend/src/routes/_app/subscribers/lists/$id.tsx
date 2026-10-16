import { createFileRoute } from '@tanstack/react-router';
import { SubscribersPage } from '@/components/subscribers-page';
import { subscribersSearchSchema, type SubscribersSearch } from '@/lib/subscribers';

export const Route = createFileRoute('/_app/subscribers/lists/$id')({
  head: () => ({ meta: [{ title: 'Subscribers - listmonk' }] }),
  validateSearch: (s): SubscribersSearch => subscribersSearchSchema.parse(s) as SubscribersSearch,
  component: function ListSubscribers() {
    const { id } = Route.useParams();
    return <SubscribersPage search={Route.useSearch()} fixedListId={Number(id)} />;
  },
});
