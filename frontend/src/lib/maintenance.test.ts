import { describe, expect, test } from 'bun:test';
import { daysAgo, exportUrl, toRFC3339 } from './maintenance';

describe('daysAgo', () => {
  test('formats as YYYY-MM-DD, n days before the given day', () => {
    expect(daysAgo(7, new Date('2026-10-16T12:00:00Z'))).toBe('2026-10-09');
    expect(daysAgo(0, new Date('2026-10-16T12:00:00Z'))).toBe('2026-10-16');
    expect(daysAgo(30, new Date('2026-03-05T12:00:00Z'))).toBe('2026-02-03');
  });
});

describe('toRFC3339', () => {
  test('a date input value becomes UTC midnight', () => {
    expect(toRFC3339('2026-10-09')).toBe('2026-10-09T00:00:00.000Z');
  });
});

describe('exportUrl', () => {
  test('encodes the since timestamp and honors the root path', () => {
    expect(exportUrl('/lm', 'views', '2026-10-09')).toBe(
      '/lm/api/maintenance/analytics/views/export?since=2026-10-09T00%3A00%3A00.000Z',
    );
  });
  test('no date, no link', () => expect(exportUrl('', 'clicks', '')).toBeNull());
});
