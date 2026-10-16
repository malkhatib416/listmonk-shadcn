import { createFileRoute } from '@tanstack/react-router';
import { UserForm } from '@/components/user-form';

export const Route = createFileRoute('/_app/users/new')({
  head: () => ({ meta: [{ title: 'New user - listmonk' }] }),
  component: () => <UserForm />,
});
