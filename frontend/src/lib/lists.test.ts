import { describe, expect, test } from 'bun:test';
import {
  breakdownStatuses,
  cleanTag,
  listFormDefaults,
  listsSearchSchema,
  toggleId,
} from './lists';

describe('listsSearchSchema', () => {
  test('keeps valid filters, coerces the page', () => {
    expect(
      listsSearchSchema.parse({ page: '2', type: 'public', status: 'archived', tag: 'eu' }),
    ).toEqual({
      page: 2,
      type: 'public',
      status: 'archived',
      tag: ['eu'],
    });
  });
  test('several tags', () => {
    expect(listsSearchSchema.parse({ tag: ['a', 'b'] })).toEqual({ tag: ['a', 'b'] });
  });
  test('drops junk', () => {
    expect(listsSearchSchema.parse({ type: 'secret', page: '0', order_by: 'id' })).toEqual({});
  });
});

describe('breakdownStatuses', () => {
  test('double opt-in tracks confirmation', () => {
    expect(breakdownStatuses('double')).toEqual(['confirmed', 'unconfirmed', 'unsubscribed']);
    expect(breakdownStatuses('single')).toEqual(['unsubscribed']);
  });
});

describe('listFormDefaults', () => {
  test('a new list is private, single opt-in, active', () => {
    expect(listFormDefaults()).toEqual({
      name: '',
      type: 'private',
      optin: 'single',
      status: 'active',
      tags: [],
      description: '',
    });
  });
});

describe('cleanTag / toggleId', () => {
  test('tags lose a leading # and whitespace', () => {
    expect(cleanTag('  #news ')).toBe('news');
    expect(cleanTag('plain')).toBe('plain');
  });
  test('toggleId', () => {
    expect(toggleId([1, 2], 3)).toEqual([1, 2, 3]);
    expect(toggleId([1, 2], 2)).toEqual([1]);
  });
});
