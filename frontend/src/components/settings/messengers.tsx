import { Plus, Trash2 } from 'lucide-react';
import { useT } from '@/components/app-context';
import { useConfirm } from '@/components/confirm-dialog';
import {
  FieldNumber,
  FieldSwitch,
  FieldText,
  Row,
  SettingsCard,
  SubCard,
  useSettings,
} from '@/components/settings/fields';
import { RepeatBox, useOpenBoxes } from '@/components/settings/repeat-box';
import { Button } from '@/components/ui/button';
import { addMessenger } from '@/lib/settings';

export function MessengersTab() {
  const t = useT();
  const confirm = useConfirm();
  const { form, update } = useSettings();
  const boxes = useOpenBoxes('messengers');

  const add = () => {
    update((d) => d.messengers.push(addMessenger()));
    boxes.setOpen(form.messengers.length, true);
    window.setTimeout(
      () => document.getElementById(`messenger-name-${form.messengers.length}`)?.focus(),
      0,
    );
  };

  const remove = async (n: number) => {
    if (!(await confirm({ title: t('globals.messages.confirm') }))) return;
    update((d) => d.messengers.splice(n, 1));
    boxes.remove(n);
  };

  const set = <K extends keyof (typeof form.messengers)[number]>(
    n: number,
    key: K,
    v: (typeof form.messengers)[number][K],
  ) => update((d) => (d.messengers[n]![key] = v));

  return (
    <>
      {form.messengers.length > 0 ? (
        <SettingsCard
          block="messengers.list"
          className="flex flex-col gap-4 border-0 bg-transparent p-0"
        >
          {form.messengers.map((m, n) => (
            <RepeatBox
              key={n}
              testId="messenger"
              index={n}
              title={m.name || m.root_url}
              open={boxes.isOpen(n)}
              onOpenChange={(v) => boxes.setOpen(n, v)}
              disabled={!m.enabled}
              controls={
                <>
                  <FieldSwitch
                    label={t('globals.buttons.enabled')}
                    value={m.enabled}
                    onChange={(v) => set(n, 'enabled', v)}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="text-destructive"
                    data-testid="btn-delete-messenger"
                    onClick={() => void remove(n)}
                  >
                    <Trash2 /> {t('globals.buttons.delete')}
                  </Button>
                </>
              }
            >
              <SubCard title={t('globals.terms.messenger')} disabled={!m.enabled}>
                <FieldText
                  id={`messenger-name-${n}`}
                  label={t('globals.fields.name')}
                  hint={t('settings.messengers.nameHelp')}
                  maxLength={200}
                  placeholder="mymessenger"
                  value={m.name}
                  onChange={(v) => set(n, 'name', v)}
                />
                <FieldText
                  label={t('settings.messengers.url')}
                  hint={t('settings.messengers.urlHelp')}
                  type="url"
                  pattern="https?://.*"
                  maxLength={200}
                  placeholder="https://postback.messenger.net/path"
                  value={m.root_url}
                  onChange={(v) => set(n, 'root_url', v)}
                />
                <FieldText
                  label={t('settings.messengers.username')}
                  maxLength={200}
                  value={m.username}
                  onChange={(v) => set(n, 'username', v)}
                />
                <FieldText
                  label={t('settings.messengers.password')}
                  hint={t('globals.messages.passwordChange')}
                  type="password"
                  maxLength={200}
                  value={m.password}
                  onChange={(v) => set(n, 'password', v)}
                />
              </SubCard>
              <SubCard title={t('settings.connection')} disabled={!m.enabled}>
                <Row cols={3}>
                  <FieldNumber
                    label={t('settings.messengers.maxConns')}
                    hint={t('settings.messengers.maxConnsHelp')}
                    min={1}
                    max={65535}
                    placeholder="25"
                    value={m.max_conns}
                    onChange={(v) => set(n, 'max_conns', v)}
                  />
                  <FieldNumber
                    label={t('settings.messengers.retries')}
                    hint={t('settings.messengers.retriesHelp')}
                    min={1}
                    max={1000}
                    placeholder="2"
                    value={m.max_msg_retries}
                    onChange={(v) => set(n, 'max_msg_retries', v)}
                  />
                  <FieldText
                    label={t('settings.messengers.timeout')}
                    hint={t('settings.messengers.timeoutHelp')}
                    maxLength={10}
                    placeholder="5s"
                    value={m.timeout}
                    onChange={(v) => set(n, 'timeout', v)}
                  />
                </Row>
              </SubCard>
            </RepeatBox>
          ))}
        </SettingsCard>
      ) : null}
      <div>
        <Button type="button" onClick={add}>
          <Plus /> {t('globals.buttons.addNew')}
        </Button>
      </div>
    </>
  );
}
