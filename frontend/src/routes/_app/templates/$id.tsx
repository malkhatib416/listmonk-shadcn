import { useQuery } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';
import { Skeleton } from '@/components/ui/skeleton';
import { TemplateForm } from '@/components/template-form';
import { templateQuery } from '@/lib/templates';

export const Route = createFileRoute('/_app/templates/$id')({
  head: () => ({ meta: [{ title: 'Template - listmonk' }] }),
  component: EditTemplate,
});

function EditTemplate() {
  const { id } = Route.useParams();
  const { data, error } = useQuery(templateQuery(Number(id)));
  if (error) return <p className="text-destructive text-sm">{error.message}</p>;
  if (!data) return <Skeleton className="h-96 max-w-5xl" />;
  return <TemplateForm key={data.id} template={data} />;
}
