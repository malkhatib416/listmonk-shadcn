import { describe, expect, test } from 'bun:test';
import { formatDate, formatDateTime } from './format';

describe('formatDate', () => {
  test('formats an ISO timestamp in the given zone', () => {
    expect(formatDate('2026-10-16T23:30:00Z', 'en', 'UTC')).toBe('16 Oct 2026');
  });
  test('empty or invalid input is an em dash', () => {
    expect(formatDate(null)).toBe('—');
    expect(formatDate('')).toBe('—');
    expect(formatDate('nope')).toBe('—');
  });
});

describe('formatDateTime', () => {
  test('includes the time', () => {
    expect(formatDateTime('2026-10-16T09:05:00Z', 'en', 'UTC')).toBe('16 Oct 2026, 09:05');
  });
  test('invalid input is an em dash', () => {
    expect(formatDateTime(undefined)).toBe('—');
  });
});
