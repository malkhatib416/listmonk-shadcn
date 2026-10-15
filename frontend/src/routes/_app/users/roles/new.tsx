import { createFileRoute } from '@tanstack/react-router';
import { UserRoleForm } from '@/components/role-forms';

export const Route = createFileRoute('/_app/users/roles/new')({
  head: () => ({ meta: [{ title: 'New user role - listmonk' }] }),
  component: () => <UserRoleForm />,
});
