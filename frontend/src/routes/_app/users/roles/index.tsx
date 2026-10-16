import { createFileRoute } from '@tanstack/react-router';
import { RolesList } from '@/components/roles-list';

export const Route = createFileRoute('/_app/users/roles/')({
  head: () => ({ meta: [{ title: 'User roles - listmonk' }] }),
  component: () => <RolesList kind="user" />,
});
