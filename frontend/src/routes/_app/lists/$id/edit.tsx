import { createFileRoute } from '@tanstack/react-router';
import { ListDetail } from '@/components/list-detail';

export const Route = createFileRoute('/_app/lists/$id/edit')({
  head: () => ({ meta: [{ title: 'Edit list - listmonk' }] }),
  component: function ListEdit() {
    const { id } = Route.useParams();
    return <ListDetail id={Number(id)} tab="edit" />;
  },
});
