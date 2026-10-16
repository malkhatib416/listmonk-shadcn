import { createFileRoute } from '@tanstack/react-router';
import { TemplateForm } from '@/components/template-form';

export const Route = createFileRoute('/_app/templates/new')({
  head: () => ({ meta: [{ title: 'New template - listmonk' }] }),
  component: () => <TemplateForm />,
});
