import { useQueryClient } from '@tanstack/react-query';
import { useRouter } from '@tanstack/react-router';
import { Button } from '@/components/ui/button';

export function BootstrapError({ error }: { error: unknown }) {
  const router = useRouter();
  const qc = useQueryClient();
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center gap-4 p-8 text-center">
      <h1 className="text-xl font-semibold">Could not load listmonk</h1>
      <p className="text-muted-foreground text-sm">
        {error instanceof Error ? error.message : String(error)}
      </p>
      <Button
        onClick={async () => {
          await qc.invalidateQueries({ queryKey: ['bootstrap'] });
          await router.invalidate();
        }}
      >
        Retry
      </Button>
    </main>
  );
}
