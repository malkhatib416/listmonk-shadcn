import type { ReactNode } from 'react';
import { useT } from '@/components/app-context';
import { Button } from '@/components/ui/button';

// Shown above a table while rows are selected: the count, "select all N matching the
// filters" (when more rows exist than the current page), and the bulk actions.
export function BulkBar({
  count,
  total,
  allMatching,
  onSelectAllMatching,
  onClear,
  children,
}: {
  count: number;
  total: number;
  allMatching: boolean;
  onSelectAllMatching: () => void;
  onClear: () => void;
  children: ReactNode;
}) {
  const t = useT();
  if (count === 0) return null;
  const shown = allMatching ? total : count;

  return (
    <div
      className="bg-secondary mb-3 flex flex-wrap items-center gap-3 rounded-lg border px-4 py-2"
      data-testid="bulk-bar"
    >
      <span className="text-sm font-medium">
        {t('globals.messages.numSelected', { num: shown })}
      </span>
      {!allMatching && total > count ? (
        <Button
          variant="link"
          size="sm"
          className="h-auto p-0"
          onClick={onSelectAllMatching}
          data-testid="select-all-matching"
        >
          {t('globals.messages.selectAll', { num: total })}
        </Button>
      ) : null}
      <Button
        variant="ghost"
        size="sm"
        className="h-auto p-0 text-muted-foreground"
        onClick={onClear}
      >
        {t('globals.buttons.clear')}
      </Button>
      <div className="ml-auto flex items-center gap-2">{children}</div>
    </div>
  );
}
