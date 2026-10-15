import { createFileRoute } from '@tanstack/react-router';
import { DashboardPage } from '@/components/dashboard-page';

export const Route = createFileRoute('/_app/')({
  head: () => ({ meta: [{ title: 'Dashboard - listmonk' }] }),
  component: DashboardPage,
});
