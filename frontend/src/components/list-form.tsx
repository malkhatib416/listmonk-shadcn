import { useNavigate } from '@tanstack/react-router';
import { useState } from 'react';
import { toast } from 'sonner';
import { useT } from '@/components/app-context';
import { TagInput } from '@/components/tag-input';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { useApiMutation } from '@/hooks/use-api-mutation';
import { apiFetch } from '@/lib/api';
import { listFormDefaults, type List, type ListFormValues } from '@/lib/lists';

function Field({
  label,
  hint,
  htmlFor,
  children,
}: {
  label: string;
  hint?: string;
  htmlFor?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
      {hint ? <p className="text-muted-foreground text-xs">{hint}</p> : null}
    </div>
  );
}

// The add / edit form for a list.
export function ListForm({ list, canSave }: { list?: List; canSave: boolean }) {
  const t = useT();
  const navigate = useNavigate();
  const isNew = !list;
  const [form, setForm] = useState<ListFormValues>(listFormDefaults(list));
  const patch = (p: Partial<ListFormValues>) => setForm((f) => ({ ...f, ...p }));

  const save = useApiMutation({
    mutationFn: () =>
      apiFetch<List>(isNew ? '/api/lists' : `/api/lists/${list.id}`, {
        method: isNew ? 'POST' : 'PUT',
        body: JSON.stringify({ ...form, description: form.description || '' }),
      }),
    invalidate: [['lists']],
    onSuccess: (l) => {
      toast.success(
        t(isNew ? 'globals.messages.created' : 'globals.messages.updated', { name: l.name }),
      );
      if (isNew) void navigate({ to: '/lists/$id', params: { id: String(l.id) } });
    },
  });

  return (
    <form
      className="bg-card flex flex-col gap-6 rounded-xl border p-6"
      onSubmit={(e) => {
        e.preventDefault();
        if (canSave) save.mutate();
      }}
    >
      <Field label={t('globals.fields.name')} htmlFor="list-name">
        <Input
          id="list-name"
          name="name"
          value={form.name}
          onChange={(e) => patch({ name: e.target.value })}
          maxLength={200}
          required
          disabled={!canSave}
        />
      </Field>
      <div className="grid gap-6 sm:grid-cols-2">
        <Field label={t('lists.type')} hint={t('lists.typeHelp')}>
          <Select
            value={form.type}
            onValueChange={(v) => patch({ type: v as ListFormValues['type'] })}
            disabled={!canSave}
          >
            <SelectTrigger className="w-full" data-testid="list-type" aria-label={t('lists.type')}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="private">{t('lists.types.private')}</SelectItem>
              <SelectItem value="public">{t('lists.types.public')}</SelectItem>
            </SelectContent>
          </Select>
        </Field>
        <Field label={t('lists.optin')} hint={t('lists.optinHelp')}>
          <Select
            value={form.optin}
            onValueChange={(v) => patch({ optin: v as ListFormValues['optin'] })}
            disabled={!canSave}
          >
            <SelectTrigger
              className="w-full"
              data-testid="list-optin"
              aria-label={t('lists.optin')}
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="single">{t('lists.optins.single')}</SelectItem>
              <SelectItem value="double">{t('lists.optins.double')}</SelectItem>
            </SelectContent>
          </Select>
        </Field>
      </div>
      <Field label={t('globals.terms.tags')} htmlFor="list-tags">
        <TagInput
          id="list-tags"
          value={form.tags}
          onChange={(tags) => patch({ tags })}
          placeholder={t('globals.terms.tags')}
          disabled={!canSave}
        />
      </Field>
      <Field label={t('globals.fields.description')} htmlFor="list-description">
        <Textarea
          id="list-description"
          name="description"
          value={form.description}
          onChange={(e) => patch({ description: e.target.value })}
          maxLength={2000}
          rows={3}
          disabled={!canSave}
        />
      </Field>
      <div className="flex items-start gap-3">
        <Switch
          id="list-archived"
          data-testid="list-archived"
          checked={form.status === 'archived'}
          onCheckedChange={(c) => patch({ status: c ? 'archived' : 'active' })}
          disabled={!canSave}
        />
        <div className="flex flex-col gap-1">
          <Label htmlFor="list-archived">{t('lists.archived')}</Label>
          <p className="text-muted-foreground text-xs">{t('lists.archivedHelp')}</p>
        </div>
      </div>
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
