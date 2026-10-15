import { useQuery } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';
import { useMemo } from 'react';
import { useT } from '@/components/app-context';
import { LogView } from '@/components/log-view';
import { PageHeader } from '@/components/page-header';
import { Skeleton } from '@/components/ui/skeleton';
import { apiFetch } from '@/lib/api';
import { parseLogLines } from '@/lib/logs';

export const Route = createFileRoute('/_app/settings/logs')({
  head: () => ({ meta: [{ title: 'Logs - listmonk' }] }),
  component: LogsPage,
});

function LogsPage() {
  const t = useT();
  const { data, error } = useQuery({
    queryKey: ['logs'],
    queryFn: () => apiFetch<string[]>('/api/logs'),
    refetchInterval: 10_000,
  });
  const lines = useMemo(() => parseLogLines(data ?? []), [data]);

  let body;
  if (data) body = <LogView lines={lines} />;
  else if (error) body = <p className="text-destructive text-sm">{error.message}</p>;
  else body = <Skeleton className="h-64 w-full" />;

  return (
    <>
      <PageHeader
        title={t('logs.title')}
        actions={
          <span className="bg-success text-success-foreground inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium">
            <span className="size-1.5 rounded-full bg-current" aria-hidden />
            Live
          </span>
        }
      />
      {body}
    </>
  );
}
