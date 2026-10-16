import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { useT } from '@/components/app-context';
import { ListPicker } from '@/components/list-picker';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { listsMinimalQuery } from '@/lib/lists';
import { hasOptinList, type ManageListsForm } from '@/lib/subscribers';

// "Manage lists": add to, remove from, or unsubscribe from lists. Used for bulk selections
// and for a single subscriber.
export function ManageListsDialog({
  open,
  onClose,
  onSubmit,
  busy,
}: {
  open: boolean;
  onClose: () => void;
  onSubmit: (f: ManageListsForm) => void;
  busy?: boolean;
}) {
  const t = useT();
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        {/* Mounted while open, so every opening starts from a clean form. */}
        <ManageListsBody t={t} onSubmit={onSubmit} busy={busy} />
      </DialogContent>
    </Dialog>
  );
}

function ManageListsBody({
  t,
  onSubmit,
  busy,
}: {
  t: ReturnType<typeof useT>;
  onSubmit: (f: ManageListsForm) => void;
  busy?: boolean;
}) {
  const { data: lists = [] } = useQuery(listsMinimalQuery);
  const [form, setForm] = useState<ManageListsForm>({
    action: 'add',
    lists: [],
    preconfirm: false,
  });
  const optin = hasOptinList(lists, form.lists);

  return (
    <form
      className="flex flex-col gap-5"
      onSubmit={(e) => {
        e.preventDefault();
        if (form.lists.length > 0) onSubmit(form);
      }}
    >
      <DialogHeader>
        <DialogTitle>{t('subscribers.manageLists')}</DialogTitle>
      </DialogHeader>
      <fieldset className="flex flex-col gap-3">
        <legend className="mb-2 text-sm font-medium">{t('settings.bounces.action')}</legend>
        <RadioGroup
          value={form.action}
          onValueChange={(a) => setForm({ ...form, action: a as ManageListsForm['action'] })}
          className="flex flex-wrap gap-5"
        >
          {(
            [
              ['add', 'globals.buttons.add', 'check-list-add'],
              ['remove', 'globals.buttons.remove', 'check-list-remove'],
              ['unsubscribe', 'subscribers.markUnsubscribed', 'check-list-unsubscribe'],
            ] as const
          ).map(([v, label, testId]) => (
            <div key={v} className="flex items-center gap-2">
              <RadioGroupItem id={`ml-${v}`} value={v} data-testid={testId} />
              <Label htmlFor={`ml-${v}`} className="font-normal">
                {t(label)}
              </Label>
            </div>
          ))}
        </RadioGroup>
      </fieldset>
      <div className="flex flex-col gap-2">
        <Label>{t('subscribers.lists')}</Label>
        <ListPicker
          value={form.lists}
          onChange={(l) => setForm({ ...form, lists: l })}
          placeholder={t('subscribers.listsPlaceholder')}
        />
      </div>
      <div className="flex items-start gap-3">
        <Checkbox
          id="ml-preconfirm"
          data-testid="preconfirm"
          checked={form.preconfirm && optin}
          disabled={!optin}
          onCheckedChange={(c) => setForm({ ...form, preconfirm: c === true })}
        />
        <div className="flex flex-col gap-1">
          <Label htmlFor="ml-preconfirm" className={optin ? undefined : 'text-muted-foreground'}>
            {t('subscribers.preconfirm')}
          </Label>
          <p className="text-muted-foreground text-xs">{t('subscribers.preconfirmHelp')}</p>
        </div>
      </div>
      <DialogFooter>
        <Button
          type="submit"
          disabled={busy || form.lists.length === 0}
          data-testid="btn-manage-save"
        >
          {t('globals.buttons.save')}
        </Button>
      </DialogFooter>
    </form>
  );
}
