import { describe, expect, test } from 'bun:test';
import { campaignDate, meterTone } from './dashboard';

describe('meterTone', () => {
  test('green below 70, amber to 90, red above', () => {
    expect(meterTone(0)).toBe('success');
    expect(meterTone(69)).toBe('success');
    expect(meterTone(70)).toBe('warning');
    expect(meterTone(90)).toBe('warning');
    expect(meterTone(91)).toBe('danger');
  });
});

describe('campaignDate', () => {
  const base = { created_at: '2026-01-01T00:00:00Z', send_at: '2026-02-01T00:00:00Z' };
  test('a scheduled campaign shows when it will go out', () => {
    expect(campaignDate({ ...base, status: 'scheduled' })).toBe(base.send_at);
  });
  test('scheduled without a date, and every other status, show the creation date', () => {
    expect(campaignDate({ ...base, status: 'scheduled', send_at: null })).toBe(base.created_at);
    expect(campaignDate({ ...base, status: 'finished' })).toBe(base.created_at);
  });
});
