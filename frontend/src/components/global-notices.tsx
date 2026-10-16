import { Link } from '@tanstack/react-router';
import { AlertTriangle, DownloadCloud, Info, RefreshCw } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { useApp, useCan, useT } from '@/components/app-context';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { apiFetch } from '@/lib/api';
import { buildNotices } from '@/lib/notices';
import { waitForRestart } from '@/lib/restart';

// Restart the app, then reload once it answers again.
async function restartApp(onUpdated: () => void) {
  await apiFetch('/api/admin/reload', { method: 'POST' });
  onUpdated();
  await waitForRestart();
  window.location.reload();
}

function ExternalLink({ href, children }: { href: string; children: string }) {
  return (
    <Button asChild size="sm" variant="outline">
      <a href={href} target="_blank" rel="noopener noreferrer">
        {children}
      </a>
    </Button>
  );
}

// The banners the old admin showed above every page: restart needed, new release,
// upstream messages, legacy user.
export function GlobalNotices() {
  const { config } = useApp();
  const t = useT();
  const can = useCan();
  const [confirming, setConfirming] = useState(false);
  const notices = buildNotices(config);
  if (notices.length === 0) return null;

  return (
    <div className="mb-6 flex flex-col gap-3">
      {notices.map((n) => {
        switch (n.kind) {
          case 'restart':
            return (
              <Alert key="restart" data-cy="needs-restart">
                <RefreshCw />
                <AlertDescription className="flex items-center justify-between gap-4">
                  <span>{t('settings.needsRestart')}</span>
                  {can('settings:manage') ? (
                    <Button size="sm" onClick={() => setConfirming(true)}>
                      {t('settings.restart')}
                    </Button>
                  ) : null}
                </AlertDescription>
              </Alert>
            );
          case 'update':
            return (
              <Alert key="update" data-cy="update-available">
                <DownloadCloud />
                <AlertDescription className="flex items-center justify-between gap-4">
                  <span>{t('settings.updateAvailable', { version: n.version })}</span>
                  <ExternalLink href={n.url}>{t('globals.buttons.view')}</ExternalLink>
                </AlertDescription>
              </Alert>
            );
          case 'message':
            return (
              <Alert
                key={`message-${n.title}-${n.description}`}
                variant={n.high ? 'destructive' : 'default'}
                data-cy="update-message"
              >
                {n.high ? <AlertTriangle /> : <Info />}
                {n.title ? <AlertTitle>{n.title}</AlertTitle> : null}
                <AlertDescription className="flex items-center justify-between gap-4">
                  <span>{n.description}</span>
                  {n.url ? (
                    <ExternalLink href={n.url}>{t('globals.buttons.view')}</ExternalLink>
                  ) : null}
                </AlertDescription>
              </Alert>
            );
          case 'legacy-user':
            return (
              <Alert key="legacy-user" data-cy="legacy-user">
                <AlertTriangle />
                <AlertDescription className="flex items-center justify-between gap-4">
                  <span>{t('settings.hasLegacyUser')}</span>
                  <span className="flex gap-2">
                    <ExternalLink href="https://listmonk.app/docs/upgrade/#upgrading-to-v4xx">
                      {t('globals.buttons.learnMore')}
                    </ExternalLink>
                    <Button asChild size="sm">
                      <Link to="/users">{t('globals.terms.users')}</Link>
                    </Button>
                  </span>
                </AlertDescription>
              </Alert>
            );
        }
      })}

      <AlertDialog open={confirming} onOpenChange={setConfirming}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('settings.restart')}</AlertDialogTitle>
            <AlertDialogDescription>{t('settings.confirmRestart')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('globals.buttons.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() =>
                restartApp(() =>
                  toast(t('globals.messages.updated', { name: t('settings.title') })),
                ).catch((e: Error) => toast.error(e.message))
              }
            >
              {t('globals.buttons.ok')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
