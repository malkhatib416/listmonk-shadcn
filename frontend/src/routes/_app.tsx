import { useSuspenseQuery } from '@tanstack/react-query';
import { Outlet, createFileRoute } from '@tanstack/react-router';
import { AppProvider } from '@/components/app-context';
import { AppSidebar } from '@/components/app-sidebar';
import { BootstrapError } from '@/components/bootstrap-error';
import { GlobalNotices } from '@/components/global-notices';
import { Toaster } from '@/components/ui/sonner';
import { SidebarInset, SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';
import { useErrorEvents } from '@/hooks/use-error-events';
import { bootstrapQuery } from '@/lib/bootstrap';
import { can } from '@/lib/permissions';

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
  useErrorEvents(can(data.user, 'settings:get'));
  return (
    <AppProvider value={data}>
      <SidebarProvider>
        <AppSidebar />
        <SidebarInset>
          <header className="flex h-12 items-center gap-2 border-b px-4">
            <SidebarTrigger />
          </header>
          <div className="flex-1 p-6">
            <GlobalNotices />
            <Outlet />
          </div>
        </SidebarInset>
      </SidebarProvider>
      <Toaster />
    </AppProvider>
  );
}
