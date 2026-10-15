import { useQuery } from '@tanstack/react-query';
import { Check, ChevronsUpDown, X } from 'lucide-react';
import { useState } from 'react';
import { useT } from '@/components/app-context';
import { StatusBadge } from '@/components/status-badge';
import { Button } from '@/components/ui/button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { listsMinimalQuery } from '@/lib/lists';
import { toggleId } from '@/lib/lists';
import { cn } from '@/lib/utils';

// Multi-select for lists, with search. `value` is a list of ids.
export function ListPicker({
  value,
  onChange,
  placeholder,
  disabled,
  id,
}: {
  value: number[];
  onChange: (ids: number[]) => void;
  placeholder?: string;
  disabled?: boolean;
  id?: string;
}) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const { data: lists = [] } = useQuery(listsMinimalQuery);
  const byId = new Map(lists.map((l) => [l.id, l]));

  return (
    <div className="flex flex-col gap-2">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            id={id}
            type="button"
            variant="outline"
            aria-haspopup="listbox"
            aria-expanded={open}
            disabled={disabled}
            className="w-full justify-between font-normal"
            data-testid="list-picker"
          >
            <span className={cn(value.length === 0 && 'text-muted-foreground')}>
              {value.length === 0
                ? (placeholder ?? t('globals.terms.lists'))
                : `${value.length} ${t.tc('globals.terms.list', value.length).toLowerCase()}`}
            </span>
            <ChevronsUpDown className="size-4 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-(--radix-popover-trigger-width) p-0" align="start">
          <Command>
            <CommandInput placeholder={t('globals.buttons.search')} />
            <CommandList>
              <CommandEmpty>{t('globals.messages.emptyState')}</CommandEmpty>
              <CommandGroup>
                {lists.map((l) => (
                  <CommandItem
                    key={l.id}
                    value={`${l.name} ${l.id}`}
                    onSelect={() => onChange(toggleId(value, l.id))}
                    data-testid="list-option"
                  >
                    <Check
                      className={cn('size-4', value.includes(l.id) ? 'opacity-100' : 'opacity-0')}
                    />
                    {l.name}
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      {value.length > 0 ? (
        <div className="flex flex-wrap gap-1.5" data-testid="selected-lists">
          {value.map((lid) => (
            <StatusBadge key={lid} tone="info" className="gap-1 pr-1">
              {byId.get(lid)?.name ?? `#${lid}`}
              <button
                type="button"
                aria-label={`Remove ${byId.get(lid)?.name ?? lid}`}
                className="hover:bg-info-foreground/10 rounded-full p-0.5"
                onClick={() => onChange(value.filter((x) => x !== lid))}
                disabled={disabled}
              >
                <X className="size-3" />
              </button>
            </StatusBadge>
          ))}
        </div>
      ) : null}
    </div>
  );
}
