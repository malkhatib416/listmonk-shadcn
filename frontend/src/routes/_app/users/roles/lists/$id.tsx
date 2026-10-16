import { createFileRoute } from '@tanstack/react-router';
import { ListRoleForm } from '@/components/role-forms';

export const Route = createFileRoute('/_app/users/roles/lists/$id')({
  head: () => ({ meta: [{ title: 'List role - listmonk' }] }),
  component: function EditListRole() {
    const { id } = Route.useParams();
    return <ListRoleForm id={Number(id)} />;
  },
});
