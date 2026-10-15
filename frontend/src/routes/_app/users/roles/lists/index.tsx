import { createFileRoute } from '@tanstack/react-router';
import { RolesList } from '@/components/roles-list';

export const Route = createFileRoute('/_app/users/roles/lists/')({
  head: () => ({ meta: [{ title: 'List roles - listmonk' }] }),
  component: () => <RolesList kind="list" />,
});
