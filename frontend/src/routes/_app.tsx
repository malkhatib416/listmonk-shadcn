import { useSuspenseQuery } from '@tanstack/react-query';
import { Outlet, createFileRoute } from '@tanstack/react-router';
import { AppProvider } from '@/components/app-context';
import { BootstrapError } from '@/components/bootstrap-error';
import { bootstrapQuery } from '@/lib/bootstrap';

export const Route = createFileRoute('/_app')({
  beforeLoad: ({ context }) => context.queryClient.ensureQueryData(bootstrapQuery),
  errorComponent: ({ error }) => <BootstrapError error={error} />,
  pendingComponent: () => (
    <output className="flex min-h-screen items-center justify-center">
      <div className="border-muted-foreground size-6 animate-spin rounded-full border-2 border-t-transparent" />
    </output>
  ),
  component: AppLayout,
});

function AppLayout() {
  const { data } = useSuspenseQuery(bootstrapQuery);
  return (
    <AppProvider value={data}>
      <Outlet />
    </AppProvider>
  );
}
