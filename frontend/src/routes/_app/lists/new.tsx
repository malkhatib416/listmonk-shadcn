import { createFileRoute } from '@tanstack/react-router';
import { useCan, useT } from '@/components/app-context';
import { ListForm } from '@/components/list-form';
import { PageHeader } from '@/components/page-header';

export const Route = createFileRoute('/_app/lists/new')({
  head: () => ({ meta: [{ title: 'New list - listmonk' }] }),
  component: function NewList() {
    const t = useT();
    const can = useCan();
    return (
      <>
        <PageHeader title={t('lists.newList')} />
        <ListForm canSave={can('lists:manage_all')} />
      </>
    );
  },
});
