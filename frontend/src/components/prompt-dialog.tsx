import { useState } from 'react';
import { useT } from '@/components/app-context';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';

// Asks for one line of text (a name for a clone, a rename...).
export function PromptDialog({
  open,
  title,
  initial,
  confirmLabel,
  busy,
  onSubmit,
  onClose,
}: {
  open: boolean;
  title: string;
  initial: string;
  confirmLabel: string;
  busy?: boolean;
  onSubmit: (value: string) => void;
  onClose: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        {/* Mounted only while open, so the field starts from `initial` every time. */}
        <PromptForm
          title={title}
          initial={initial}
          confirmLabel={confirmLabel}
          busy={busy}
          onSubmit={onSubmit}
        />
      </DialogContent>
    </Dialog>
  );
}

function PromptForm({
  title,
  initial,
  confirmLabel,
  busy,
  onSubmit,
}: {
  title: string;
  initial: string;
  confirmLabel: string;
  busy?: boolean;
  onSubmit: (value: string) => void;
}) {
  const t = useT();
  const [value, setValue] = useState(initial);
  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        if (value.trim()) onSubmit(value.trim());
      }}
    >
      <DialogHeader>
        <DialogTitle>{title}</DialogTitle>
      </DialogHeader>
      <Input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        aria-label={t('globals.fields.name')}
        data-testid="clone-name"
        maxLength={200}
      />
      <DialogFooter>
        <Button type="submit" disabled={busy || !value.trim()} data-testid="btn-clone-ok">
          {confirmLabel}
        </Button>
      </DialogFooter>
    </form>
  );
}
