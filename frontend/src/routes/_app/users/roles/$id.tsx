import { createFileRoute } from '@tanstack/react-router';
import { UserRoleForm } from '@/components/role-forms';

export const Route = createFileRoute('/_app/users/roles/$id')({
  head: () => ({ meta: [{ title: 'User role - listmonk' }] }),
  component: function EditUserRole() {
    const { id } = Route.useParams();
    return <UserRoleForm id={Number(id)} />;
  },
});
