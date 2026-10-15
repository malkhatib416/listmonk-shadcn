import { useQuery } from '@tanstack/react-query';
import { ChevronsUpDown, X } from 'lucide-react';
import { useEffect, useState } from 'react';
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
import { apiFetch } from '@/lib/api';
import type { AnalyticsItem } from '@/lib/analytics';
import type { PageResults } from '@/lib/paging';

// Search-as-you-type multi-select over campaigns or lists (the analytics selector).
export function ItemPicker({
  resource,
  value,
  onChange,
}: {
  resource: 'campaigns' | 'lists';
  value: AnalyticsItem[];
  onChange: (items: AnalyticsItem[]) => void;
}) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const [query, setQuery] = useState('');

  // Debounce the search box.
  useEffect(() => {
    const id = setTimeout(() => setQuery(text.trim()), 200);
    return () => clearTimeout(id);
  }, [text]);

  const { data } = useQuery({
    queryKey: ['picker', resource, query],
    enabled: open,
    queryFn: () => {
      const q = new URLSearchParams({
        query,
        order_by: 'created_at',
        order: 'DESC',
        no_body: 'true',
        per_page: '10',
      });
      return apiFetch<PageResults<AnalyticsItem>>(`/api/${resource}?${q}`);
    },
  });
  const chosen = new Set(value.map((v) => v.id));
  const options = (data?.results ?? []).filter((r) => !chosen.has(r.id));
  const label = t(`globals.terms.${resource}`);

  return (
    <div className="flex flex-col gap-2">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            className="w-full justify-between font-normal"
            data-testid="item-picker"
          >
            <span className="text-muted-foreground">{label}</span>
            <ChevronsUpDown className="size-4 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-(--radix-popover-trigger-width) p-0" align="start">
          <Command shouldFilter={false}>
            <CommandInput
              value={text}
              onValueChange={setText}
              placeholder={t('globals.buttons.search')}
            />
            <CommandList>
              <CommandEmpty>{t('globals.messages.emptyState')}</CommandEmpty>
              <CommandGroup>
                {options.map((o) => (
                  <CommandItem
                    key={o.id}
                    value={String(o.id)}
                    data-testid="item-option"
                    onSelect={() => {
                      onChange([...value, { id: o.id, name: o.name }]);
                      setText('');
                    }}
                  >
                    #{o.id}: {o.name}
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      {value.length > 0 ? (
        <div className="flex flex-wrap gap-1.5" data-testid="picked-items">
          {value.map((v) => (
            <StatusBadge key={v.id} tone="info" className="gap-1 pr-1">
              #{v.id}: {v.name}
              <button
                type="button"
                aria-label={`Remove ${v.name}`}
                className="hover:bg-info-foreground/10 rounded-full p-0.5"
                onClick={() => onChange(value.filter((x) => x.id !== v.id))}
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
