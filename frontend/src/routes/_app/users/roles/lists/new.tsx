import { createFileRoute } from '@tanstack/react-router';
import { ListRoleForm } from '@/components/role-forms';

export const Route = createFileRoute('/_app/users/roles/lists/new')({
  head: () => ({ meta: [{ title: 'New list role - listmonk' }] }),
  component: () => <ListRoleForm />,
});
