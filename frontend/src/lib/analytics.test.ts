import { describe, expect, test } from 'bun:test';
import {
  chartRows,
  formatCount,
  groupCounts,
  linkLabel,
  toLabel,
  type CountRow,
} from './analytics';

const rows: CountRow[] = [
  { campaign_id: 1, timestamp: '2026-10-01T00:00:00Z', count: 3 },
  { campaign_id: 2, timestamp: '2026-10-01T00:00:00Z', count: 5 },
  { campaign_id: 1, timestamp: '2026-10-02T00:00:00Z', count: 4 },
];

describe('groupCounts', () => {
  test('groups points and totals per item', () => {
    const g = groupCounts(rows, 'campaign_id');
    expect(g.get(1)?.total).toBe(7);
    expect(g.get(2)?.total).toBe(5);
    expect(g.get(1)?.points).toHaveLength(2);
    expect(g.get(3)).toBeUndefined();
  });
});

describe('chartRows', () => {
  test('one row per timestamp with a column per item', () => {
    const out = chartRows(rows, 'campaign_id', 's');
    expect(out).toHaveLength(2);
    expect(out[0]).toMatchObject({ s1: 3, s2: 5 });
    expect(out[1]).toMatchObject({ s1: 4 });
  });
  test('rows are ordered by time', () => {
    const shuffled = [rows[2]!, rows[0]!, rows[1]!];
    const out = chartRows(shuffled, 'campaign_id', 's');
    expect(out.map((r) => r.ts)).toEqual([...out.map((r) => r.ts)].sort());
  });
  test('missing points are 0 so lines do not break', () => {
    const out = chartRows(rows, 'campaign_id', 's');
    expect(out[1]!.s2).toBe(0);
  });
  test('empty input', () => expect(chartRows([], 'campaign_id', 's')).toEqual([]));
});

describe('formatCount', () => {
  test('adds the share of sent messages when known', () => {
    expect(formatCount(50, 200)).toBe('50 (25.00%)');
    expect(formatCount(1, 3)).toBe('1 (33.33%)');
  });
  test('no sent count, no percentage', () => {
    expect(formatCount(7, 0)).toBe('7');
    expect(formatCount(7, undefined)).toBe('7');
  });
});

describe('linkLabel', () => {
  test('host and path', () =>
    expect(linkLabel('https://a.example.com/x/y?q=1')).toBe('a.example.com/x/y'));
  test('long URLs are shortened', () => {
    const long = `https://a.example.com/${'p'.repeat(100)}`;
    expect(linkLabel(long).endsWith('..')).toBe(true);
    expect(linkLabel(long).length).toBeLessThan(80);
  });
  test('not a URL is returned as is', () => expect(linkLabel('mailto-ish')).toBe('mailto-ish'));
});

describe('toLabel', () => {
  test('formats a timestamp for the axis', () => {
    expect(toLabel('2026-10-09T10:05:00')).toMatch(/^2026-10-09 10:05$/);
  });
});
