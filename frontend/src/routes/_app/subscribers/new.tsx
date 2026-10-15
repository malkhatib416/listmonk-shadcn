import { createFileRoute } from '@tanstack/react-router';
import { useT } from '@/components/app-context';
import { PageHeader } from '@/components/page-header';
import { SubscriberForm } from '@/components/subscriber-form';

export const Route = createFileRoute('/_app/subscribers/new')({
  head: () => ({ meta: [{ title: 'New subscriber - listmonk' }] }),
  component: function NewSubscriber() {
    const t = useT();
    return (
      <>
        <PageHeader title={t('subscribers.newSubscriber')} />
        <SubscriberForm />
      </>
    );
  },
});
