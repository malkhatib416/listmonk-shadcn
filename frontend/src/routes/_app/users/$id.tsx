import { useQuery } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';
import { Skeleton } from '@/components/ui/skeleton';
import { UserForm } from '@/components/user-form';
import { userQuery } from '@/lib/users';

export const Route = createFileRoute('/_app/users/$id')({
  head: () => ({ meta: [{ title: 'User - listmonk' }] }),
  component: EditUser,
});

function EditUser() {
  const { id } = Route.useParams();
  const { data, error } = useQuery(userQuery(Number(id)));
  if (error) return <p className="text-destructive text-sm">{error.message}</p>;
  if (!data) return <Skeleton className="h-64 max-w-2xl" />;
  return <UserForm key={data.id} user={data} />;
}
