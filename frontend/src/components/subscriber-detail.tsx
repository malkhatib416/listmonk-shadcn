import { useQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import {
  CornerRightDown,
  List as ListIcon,
  Mail,
  Pencil,
  Settings2,
  Trash2,
  User,
} from 'lucide-react';
import { useState } from 'react';
import { useCan, useT } from '@/components/app-context';
import { useConfirm } from '@/components/confirm-dialog';
import { ManageListsDialog } from '@/components/manage-lists-dialog';
import { PageHeader } from '@/components/page-header';
import { StatusBadge } from '@/components/status-badge';
import { ActivityTab, BouncesTab, ListsTab, useSendOptin } from '@/components/subscriber-tabs';
import { SubscriberForm } from '@/components/subscriber-form';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { UserAvatar } from '@/components/user-avatar';
import { useApiMutation } from '@/hooks/use-api-mutation';
import { apiFetch } from '@/lib/api';
import { manageListsBody, subscriberQuery, type ManageListsForm } from '@/lib/subscribers';
import { cn } from '@/lib/utils';

export type SubTab = 'activity' | 'edit' | 'lists' | 'bounces';

const BASE =
  'inline-flex items-center gap-2 border-b-2 px-3 py-2 text-sm font-medium transition-colors';
const on = 'border-primary text-foreground';
const off = 'text-muted-foreground hover:text-foreground border-transparent';

export function SubscriberDetail({ id, tab }: { id: number; tab: SubTab }) {
  const t = useT();
  const can = useCan();
  const confirm = useConfirm();
  const { data: sub, error } = useQuery(subscriberQuery(id));
  const [manageOpen, setManageOpen] = useState(false);
  const optin = useSendOptin(sub ?? ({ id } as never));

  const manage = useApiMutation({
    mutationFn: (f: ManageListsForm) =>
      apiFetch('/api/subscribers/lists', {
        method: 'PUT',
        body: JSON.stringify(manageListsBody(f, { ids: [id] })),
      }),
    invalidate: [['subscribers']],
    success: () => t('subscribers.listChangeApplied'),
    onSuccess: () => setManageOpen(false),
  });
  const clearBounces = useApiMutation({
    mutationFn: () => apiFetch(`/api/subscribers/${id}/bounces`, { method: 'DELETE' }),
    invalidate: [['subscribers']],
    success: () => t('globals.messages.done'),
  });

  if (error) return <p className="text-destructive text-sm">{error.message}</p>;
  if (!sub) return <Skeleton className="h-96 max-w-4xl" />;

  const canManage = can('subscribers:manage');
  const hasOptinSub = (sub.lists ?? []).some((l) => l.optin === 'double');
  const p = { id: String(id) };

  return (
    <>
      <PageHeader
        title={sub.email}
        description={sub.name || undefined}
        actions={
          <div className="flex items-center gap-2">
            {sub.status !== 'enabled' ? (
              <StatusBadge tone="danger" dot>
                {t(`subscribers.status.${sub.status}`)}
              </StatusBadge>
            ) : null}
            {tab === 'lists' && canManage ? (
              <>
                {sub.status !== 'blocklisted' ? (
                  <Button
                    variant="outline"
                    data-testid="btn-send-optin"
                    disabled={!hasOptinSub}
                    onClick={async () => {
                      if (
                        await confirm({
                          title: t('subscribers.sendOptinConfirm'),
                          description: t('globals.messages.confirm'),
                        })
                      )
                        optin.mutate();
                    }}
                  >
                    <Mail /> {t('subscribers.sendOptinConfirm')}
                  </Button>
                ) : null}
                <Button data-testid="btn-manage" onClick={() => setManageOpen(true)}>
                  <Settings2 /> {t('globals.buttons.manage')}
                </Button>
              </>
            ) : null}
            {tab === 'bounces' && canManage ? (
              <Button
                variant="outline"
                onClick={async () => {
                  if (
                    await confirm({
                      title: t('globals.buttons.clear'),
                      description: t('globals.messages.confirm'),
                      destructive: true,
                    })
                  )
                    clearBounces.mutate();
                }}
              >
                <Trash2 /> {t('globals.buttons.clear')}
              </Button>
            ) : null}
            <UserAvatar name={sub.name || sub.email} className="size-10" />
          </div>
        }
      />
      <div className="mb-6 flex gap-1 border-b" role="tablist">
        <Link
          to="/subscribers/$id"
          params={p}
          role="tab"
          aria-selected={tab === 'activity'}
          className={cn(BASE, tab === 'activity' ? on : off)}
        >
          <User className="size-4" /> {t('globals.buttons.view')}
        </Link>
        <Link
          to="/subscribers/$id/edit"
          params={p}
          role="tab"
          aria-selected={tab === 'edit'}
          className={cn(BASE, tab === 'edit' ? on : off)}
        >
          <Pencil className="size-4" /> {t('globals.buttons.edit')}
        </Link>
        <Link
          to="/subscribers/$id/lists"
          params={p}
          role="tab"
          aria-selected={tab === 'lists'}
          className={cn(BASE, tab === 'lists' ? on : off)}
        >
          <ListIcon className="size-4" /> {t.tc('globals.terms.lists', 2)} (
          {(sub.lists ?? []).length})
        </Link>
        {can('bounces:get') ? (
          <Link
            to="/subscribers/$id/bounces"
            params={p}
            role="tab"
            aria-selected={tab === 'bounces'}
            className={cn(BASE, tab === 'bounces' ? on : off)}
          >
            <CornerRightDown className="size-4" /> {t('globals.terms.bounces')}
          </Link>
        ) : null}
      </div>

      {tab === 'activity' ? <ActivityTab sub={sub} /> : null}
      {tab === 'edit' ? <SubscriberForm key={sub.id + sub.updated_at} subscriber={sub} /> : null}
      {tab === 'lists' ? <ListsTab sub={sub} /> : null}
      {tab === 'bounces' ? <BouncesTab sub={sub} /> : null}

      <ManageListsDialog
        open={manageOpen}
        onClose={() => setManageOpen(false)}
        busy={manage.isPending}
        onSubmit={(f) => manage.mutate(f)}
      />
    </>
  );
}
