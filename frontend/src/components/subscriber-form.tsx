import { useNavigate } from '@tanstack/react-router';
import { useState } from 'react';
import { toast } from 'sonner';
import { useCan, useT } from '@/components/app-context';
import { ListPicker } from '@/components/list-picker';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useApiMutation } from '@/hooks/use-api-mutation';
import { apiFetch } from '@/lib/api';
import { listsMinimalQuery } from '@/lib/lists';
import { hasOptinList, parseAttribs, type Subscriber } from '@/lib/subscribers';
import { useQuery } from '@tanstack/react-query';

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="bg-card flex flex-col gap-5 rounded-xl border p-6">
      <h2 className="text-sm font-semibold">{title}</h2>
      {children}
    </section>
  );
}

// The add / edit form for a subscriber (existing = edit profile; lists are managed on the
// Lists tab).
export function SubscriberForm({ subscriber }: { subscriber?: Subscriber }) {
  const t = useT();
  const can = useCan();
  const navigate = useNavigate();
  const isNew = !subscriber;
  const canSave = can('subscribers:manage');
  const { data: allLists = [] } = useQuery(listsMinimalQuery);

  const [email, setEmail] = useState(subscriber?.email ?? '');
  const [name, setName] = useState(subscriber?.name ?? '');
  const [status, setStatus] = useState<Subscriber['status']>(subscriber?.status ?? 'enabled');
  const [lists, setLists] = useState<number[]>([]);
  const [preconfirm, setPreconfirm] = useState(false);
  const [attribs, setAttribs] = useState(JSON.stringify(subscriber?.attribs ?? {}, null, 4));
  const optin = hasOptinList(allLists, lists);

  const save = useApiMutation({
    mutationFn: async () => {
      const parsed = parseAttribs(attribs);
      if (!parsed.ok) throw new Error(`${t('subscribers.invalidJSON')}: ${parsed.error}`);
      if (isNew) {
        return apiFetch<Subscriber>('/api/subscribers', {
          method: 'POST',
          body: JSON.stringify({
            email,
            name,
            status,
            attribs: parsed.value,
            preconfirm_subscriptions: preconfirm && optin,
            lists,
          }),
        });
      }
      // PATCH the profile; subscriptions are managed separately.
      return apiFetch<Subscriber>(`/api/subscribers/${subscriber.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ email, name, status, attribs: parsed.value }),
      });
    },
    invalidate: [['subscribers']],
    onSuccess: (s) => {
      toast.success(
        t(isNew ? 'globals.messages.created' : 'globals.messages.updated', { name: s.email }),
      );
      if (isNew) void navigate({ to: '/subscribers', search: {} });
    },
  });

  return (
    <form
      className="flex max-w-2xl flex-col gap-6"
      onSubmit={(e) => {
        e.preventDefault();
        if (canSave) save.mutate();
      }}
    >
      <Card title={t('users.profile')}>
        <div className="flex flex-col gap-2">
          <Label htmlFor="sub-email">{t('subscribers.email')}</Label>
          <Input
            id="sub-email"
            name="email"
            type="email"
            maxLength={200}
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={!canSave}
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="sub-name">{t('globals.fields.name')}</Label>
          <Input
            id="sub-name"
            name="name"
            maxLength={200}
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={!canSave}
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label>{t('globals.fields.status')}</Label>
          <Select
            value={status}
            onValueChange={(v) => setStatus(v as Subscriber['status'])}
            disabled={!canSave}
          >
            <SelectTrigger
              className="w-full"
              data-testid="sub-status"
              aria-label={t('globals.fields.status')}
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="enabled">{t('subscribers.status.enabled')}</SelectItem>
              <SelectItem value="blocklisted">{t('subscribers.status.blocklisted')}</SelectItem>
            </SelectContent>
          </Select>
          <p className="text-muted-foreground text-xs">{t('subscribers.blocklistedHelp')}</p>
        </div>
      </Card>

      {isNew ? (
        <Card title={t('subscribers.lists')}>
          <ListPicker
            value={lists}
            onChange={setLists}
            placeholder={t('subscribers.listsPlaceholder')}
          />
          <div className="flex items-start gap-3">
            <Checkbox
              id="sub-preconfirm"
              data-testid="preconfirm"
              checked={preconfirm && optin}
              disabled={!optin}
              onCheckedChange={(c) => setPreconfirm(c === true)}
            />
            <div className="flex flex-col gap-1">
              <Label
                htmlFor="sub-preconfirm"
                className={optin ? undefined : 'text-muted-foreground'}
              >
                {t('subscribers.preconfirm')}
              </Label>
              <p className="text-muted-foreground text-xs">{t('subscribers.preconfirmHelp')}</p>
            </div>
          </div>
        </Card>
      ) : null}

      <Card title={t('globals.terms.attribs')}>
        <div className="flex flex-col gap-2">
          <Textarea
            name="attribs"
            aria-label={t('globals.terms.attribs')}
            rows={6}
            value={attribs}
            onChange={(e) => setAttribs(e.target.value)}
            disabled={!canSave}
            className="font-mono text-xs"
          />
          <p className="text-muted-foreground text-xs">
            {t('subscribers.attribsHelp')}{' '}
            <code>{'{"job": "developer", "location": "Mars", "has_rocket": true}'}</code>
          </p>
        </div>
      </Card>

      {canSave ? (
        <div className="flex justify-end">
          <Button type="submit" disabled={save.isPending} data-testid="btn-save">
            {t('globals.buttons.save')}
          </Button>
        </div>
      ) : null}
    </form>
  );
}
