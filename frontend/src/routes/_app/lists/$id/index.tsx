import { createFileRoute } from '@tanstack/react-router';
import { ListDetail } from '@/components/list-detail';

export const Route = createFileRoute('/_app/lists/$id/')({
  head: () => ({ meta: [{ title: 'List - listmonk' }] }),
  component: function ListView() {
    const { id } = Route.useParams();
    return <ListDetail id={Number(id)} tab="view" />;
  },
});
