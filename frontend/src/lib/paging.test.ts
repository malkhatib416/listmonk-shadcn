import { describe, expect, test } from 'bun:test';
import { bulkQuery } from './bulk';
import { lastPage, pageWindow, rangeLabel } from './paging';

describe('lastPage', () => {
  test('rounds up, never below 1', () => {
    expect(lastPage(0, 20)).toBe(1);
    expect(lastPage(20, 20)).toBe(1);
    expect(lastPage(21, 20)).toBe(2);
    expect(lastPage(100, 0)).toBe(1);
  });
});

describe('pageWindow', () => {
  test('a few pages are all shown', () => expect(pageWindow(2, 4)).toEqual([1, 2, 3, 4]));
  test('long ranges collapse around the current page', () => {
    expect(pageWindow(1, 10)).toEqual([1, 2, 3, 'gap', 10]);
    expect(pageWindow(5, 10)).toEqual([1, 'gap', 4, 5, 6, 'gap', 10]);
    expect(pageWindow(10, 10)).toEqual([1, 'gap', 8, 9, 10]);
  });
  test('a single page', () => expect(pageWindow(1, 1)).toEqual([1]));
});

describe('rangeLabel', () => {
  test('1-based inclusive range', () => {
    expect(rangeLabel(1, 20, 45)).toEqual({ from: 1, to: 20, total: 45 });
    expect(rangeLabel(3, 20, 45)).toEqual({ from: 41, to: 45, total: 45 });
    expect(rangeLabel(1, 20, 0)).toEqual({ from: 0, to: 0, total: 0 });
  });
});

describe('bulkQuery', () => {
  test('array filters (tags) repeat the param', () => {
    expect(
      bulkQuery({ ids: [], allMatching: true }, { tag: ['a', 'b'], status: 'active' }).toString(),
    ).toBe('all=true&tag=a&tag=b&status=active');
  });

  test('selected ids become repeated id params', () => {
    expect(bulkQuery({ ids: [3, 5], allMatching: false }, { source: 'api' }).toString()).toBe(
      'id=3&id=5',
    );
  });
  test('"all matching" sends all=true plus the active filters', () => {
    expect(
      bulkQuery(
        { ids: [3], allMatching: true },
        { source: 'api', type: undefined, campaign_id: 7 },
      ).toString(),
    ).toBe('all=true&source=api&campaign_id=7');
  });
});
