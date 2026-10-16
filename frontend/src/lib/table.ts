export type SortDir = 'asc' | 'desc';
export interface SortState {
  id: string;
  dir: SortDir;
}

// A sorted copy; no comparator keeps the original order.
export function sortRows<T>(
  rows: T[],
  cmp: ((a: T, b: T) => number) | undefined,
  dir: SortDir,
): T[] {
  if (!cmp) return rows;
  const out = [...rows].sort(cmp);
  return dir === 'desc' ? out.reverse() : out;
}

// Header click: asc -> desc -> unsorted; another column starts at asc.
export function cycleSort(cur: SortState | null, id: string): SortState | null {
  if (!cur || cur.id !== id) return { id, dir: 'asc' };
  return cur.dir === 'asc' ? { id, dir: 'desc' } : null;
}

export function toggleOne<T>(selected: Set<T>, id: T): Set<T> {
  const next = new Set(selected);
  if (next.has(id)) next.delete(id);
  else next.add(id);
  return next;
}

export function toggleAll<T>(selected: Set<T>, ids: T[]): Set<T> {
  return selectionState(selected, ids) === 'all' ? new Set() : new Set(ids);
}

// Counts only ids that are still rows, so a stale selection never reads as "all".
export function selectionState<T>(selected: Set<T>, ids: T[]): 'none' | 'some' | 'all' {
  const n = ids.filter((id) => selected.has(id)).length;
  if (n === 0) return 'none';
  return n === ids.length ? 'all' : 'some';
}
