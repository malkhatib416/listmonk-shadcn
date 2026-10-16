import { ChevronRight } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';

// Which server/messenger boxes are expanded survives reloads, like the old page.
const OPEN_KEY = 'settings.openBoxes';
type OpenState = Record<string, Record<number, boolean>>;

function load(): OpenState {
  try {
    return (JSON.parse(localStorage.getItem(OPEN_KEY) ?? '{}') as OpenState) ?? {};
  } catch {
    return {};
  }
}

function save(s: OpenState) {
  try {
    localStorage.setItem(OPEN_KEY, JSON.stringify(s));
  } catch {
    // storage may be blocked; the boxes just start collapsed next time
  }
}

export function useOpenBoxes(group: string) {
  const [open, setOpenState] = useState<Record<number, boolean>>(() => load()[group] ?? {});

  const commit = (next: Record<number, boolean>) => {
    setOpenState(next);
    save({ ...load(), [group]: next });
  };

  return {
    isOpen: (n: number) => !!open[n],
    setOpen: (n: number, v: boolean) => commit({ ...open, [n]: v }),
    // Removing box n shifts the later boxes up.
    remove: (n: number) =>
      commit(
        Object.fromEntries(
          Object.entries(open)
            .filter(([k]) => Number(k) !== n)
            .map(([k, v]) => [Number(k) > n ? Number(k) - 1 : Number(k), v]),
        ),
      ),
  };
}

// A collapsible repeated item (SMTP server, messenger): a header with controls, a body.
export function RepeatBox({
  index,
  title,
  open,
  onOpenChange,
  controls,
  disabled,
  testId,
  children,
}: {
  index: number;
  title: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  controls: ReactNode;
  disabled?: boolean;
  testId: string;
  children: ReactNode;
}) {
  return (
    <Collapsible
      open={open}
      onOpenChange={onOpenChange}
      className="bg-card rounded-xl border"
      data-testid={testId}
    >
      <div className="flex flex-wrap items-center justify-between gap-3 p-4">
        <CollapsibleTrigger
          className="group flex min-w-0 items-center gap-2 text-left"
          aria-label={`#${index + 1} ${title}`}
          data-testid="box-toggle"
        >
          <ChevronRight className="size-4 shrink-0 transition-transform group-data-[state=open]:rotate-90" />
          <span className="text-muted-foreground text-sm">#{index + 1}</span>
          {title ? <span className="text-muted-foreground truncate text-sm">{title}</span> : null}
        </CollapsibleTrigger>
        <div className="flex flex-wrap items-center gap-4">{controls}</div>
      </div>
      <CollapsibleContent>
        <div className={cn('flex flex-col gap-4 border-t p-4', disabled && 'opacity-80')}>
          {children}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
