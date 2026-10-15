import { describe, expect, test } from 'bun:test';
import { cycleSort, selectionState, sortRows, toggleAll, toggleOne } from './table';

interface Row {
  id: number;
  name: string;
}
const rows: Row[] = [
  { id: 1, name: 'b' },
  { id: 2, name: 'a' },
  { id: 3, name: 'c' },
];
const byName = (x: Row, y: Row) => x.name.localeCompare(y.name);

describe('sortRows', () => {
  test('ascending and descending without mutating the input', () => {
    expect(sortRows(rows, byName, 'asc').map((r) => r.id)).toEqual([2, 1, 3]);
    expect(sortRows(rows, byName, 'desc').map((r) => r.id)).toEqual([3, 1, 2]);
    expect(rows.map((r) => r.id)).toEqual([1, 2, 3]);
  });

  test('no comparator keeps the order', () => {
    expect(sortRows(rows, undefined, 'asc').map((r) => r.id)).toEqual([1, 2, 3]);
  });
});

describe('cycleSort', () => {
  test('first click sorts asc, second desc, third clears', () => {
    expect(cycleSort(null, 'name')).toEqual({ id: 'name', dir: 'asc' });
    expect(cycleSort({ id: 'name', dir: 'asc' }, 'name')).toEqual({ id: 'name', dir: 'desc' });
    expect(cycleSort({ id: 'name', dir: 'desc' }, 'name')).toBeNull();
  });
  test('another column starts at asc', () => {
    expect(cycleSort({ id: 'name', dir: 'desc' }, 'email')).toEqual({ id: 'email', dir: 'asc' });
  });
});

describe('selection', () => {
  test('toggleOne adds and removes', () => {
    expect([...toggleOne(new Set([1]), 2)].sort()).toEqual([1, 2]);
    expect([...toggleOne(new Set([1, 2]), 1)]).toEqual([2]);
  });

  test('toggleAll selects every id, or clears when all are selected', () => {
    expect([...toggleAll(new Set([1]), [1, 2, 3])].sort()).toEqual([1, 2, 3]);
    expect([...toggleAll(new Set([1, 2, 3]), [1, 2, 3])]).toEqual([]);
  });

  test('selectionState ignores ids that are no longer rows', () => {
    expect(selectionState(new Set([9]), [1, 2])).toBe('none');
    expect(selectionState(new Set([1]), [1, 2])).toBe('some');
    expect(selectionState(new Set([1, 2, 9]), [1, 2])).toBe('all');
    expect(selectionState(new Set(), [])).toBe('none');
  });
});
