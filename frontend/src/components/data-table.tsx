import { ArrowDown, ArrowUp, ChevronsUpDown } from 'lucide-react';
import { useMemo, useState, type ReactNode } from 'react';
import { Checkbox } from '@/components/ui/checkbox';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  cycleSort,
  selectionState,
  sortRows,
  toggleAll,
  toggleOne,
  type SortState,
} from '@/lib/table';
import { cn } from '@/lib/utils';

export type RowId = number | string;

export interface Column<T> {
  id: string;
  header: ReactNode;
  cell: (row: T) => ReactNode;
  // Present = the header is clickable and sorts rows with this comparator.
  compare?: (a: T, b: T) => number;
  className?: string;
}

interface Props<T> {
  columns: Column<T>[];
  rows: T[];
  getRowId: (row: T) => RowId;
  selection?: { selected: Set<RowId>; onChange: (next: Set<RowId>) => void };
  defaultSort?: SortState;
  loading?: boolean;
  empty?: ReactNode;
  rowTestId?: string;
  // Accessible names for the select-all and per-row checkboxes.
  selectAllLabel?: string;
  selectRowLabel?: (row: T) => string;
}

export function DataTable<T>({
  columns,
  rows,
  getRowId,
  selection,
  defaultSort,
  loading,
  empty,
  rowTestId,
  selectAllLabel = 'Select all',
  selectRowLabel,
}: Props<T>) {
  const [sort, setSort] = useState<SortState | null>(defaultSort ?? null);

  const sorted = useMemo(() => {
    const col = sort ? columns.find((c) => c.id === sort.id) : undefined;
    return sortRows(rows, col?.compare, sort?.dir ?? 'asc');
  }, [rows, columns, sort]);

  const ids = useMemo(() => sorted.map(getRowId), [sorted, getRowId]);
  const state = selection ? selectionState(selection.selected, ids) : 'none';
  const colSpan = columns.length + (selection ? 1 : 0);

  return (
    <div className="bg-card overflow-hidden rounded-xl border">
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            {selection ? (
              <TableHead className="w-12 pl-4">
                <Checkbox
                  aria-label={selectAllLabel}
                  checked={state === 'all' ? true : state === 'some' ? 'indeterminate' : false}
                  onCheckedChange={() => selection.onChange(toggleAll(selection.selected, ids))}
                />
              </TableHead>
            ) : null}
            {columns.map((c) => {
              const active = sort?.id === c.id ? sort : null;
              return (
                <TableHead
                  key={c.id}
                  className={c.className}
                  aria-sort={
                    active ? (active.dir === 'asc' ? 'ascending' : 'descending') : undefined
                  }
                >
                  {c.compare ? (
                    <button
                      type="button"
                      onClick={() => setSort(cycleSort(sort, c.id))}
                      className="hover:text-foreground -ml-1 inline-flex items-center gap-1 rounded px-1 py-0.5"
                    >
                      {c.header}
                      {active ? (
                        active.dir === 'asc' ? (
                          <ArrowUp className="size-3.5" />
                        ) : (
                          <ArrowDown className="size-3.5" />
                        )
                      ) : (
                        <ChevronsUpDown className="size-3.5 opacity-40" />
                      )}
                    </button>
                  ) : (
                    c.header
                  )}
                </TableHead>
              );
            })}
          </TableRow>
        </TableHeader>
        <TableBody>
          {loading
            ? Array.from({ length: 5 }, (_, i) => (
                <TableRow key={i} className="hover:bg-transparent">
                  <TableCell colSpan={colSpan}>
                    <Skeleton className="h-6 w-full" />
                  </TableCell>
                </TableRow>
              ))
            : sorted.map((row) => {
                const id = getRowId(row);
                const checked = selection?.selected.has(id) ?? false;
                return (
                  <TableRow
                    key={id}
                    data-testid={rowTestId}
                    data-state={checked ? 'selected' : undefined}
                  >
                    {selection ? (
                      <TableCell className="pl-4">
                        <Checkbox
                          aria-label={selectRowLabel?.(row) ?? 'Select row'}
                          checked={checked}
                          onCheckedChange={() =>
                            selection.onChange(toggleOne(selection.selected, id))
                          }
                        />
                      </TableCell>
                    ) : null}
                    {columns.map((c) => (
                      <TableCell key={c.id} className={cn(c.className)}>
                        {c.cell(row)}
                      </TableCell>
                    ))}
                  </TableRow>
                );
              })}
          {!loading && sorted.length === 0 ? (
            <TableRow className="hover:bg-transparent">
              <TableCell colSpan={colSpan}>{empty}</TableCell>
            </TableRow>
          ) : null}
        </TableBody>
      </Table>
    </div>
  );
}
