import { createFileRoute } from '@tanstack/react-router';
import { SubscribersPage } from '@/components/subscribers-page';
import { subscribersSearchSchema, type SubscribersSearch } from '@/lib/subscribers';

export const Route = createFileRoute('/_app/subscribers/')({
  head: () => ({ meta: [{ title: 'Subscribers - listmonk' }] }),
  validateSearch: (s): SubscribersSearch => subscribersSearchSchema.parse(s) as SubscribersSearch,
  component: function Subscribers() {
    return <SubscribersPage search={Route.useSearch()} />;
  },
});
