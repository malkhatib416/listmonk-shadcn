import { describe, expect, test } from 'bun:test';
import {
  exportUrl,
  hasOptinList,
  manageListsBody,
  parseAttribs,
  queryBody,
  subscribersSearchSchema,
  visibleLists,
} from './subscribers';

describe('subscribersSearchSchema', () => {
  test('keeps known filters, coerces ids and page', () => {
    expect(
      subscribersSearchSchema.parse({
        page: '3',
        list_id: '2',
        status: 'blocklisted',
        subscription_status: 'none',
        search: 'ana',
      }),
    ).toEqual({
      page: 3,
      list_id: [2],
      status: 'blocklisted',
      subscription_status: 'none',
      search: 'ana',
    });
  });
  test('several list ids', () => {
    expect(subscribersSearchSchema.parse({ list_id: ['1', '2'] })).toEqual({ list_id: [1, 2] });
  });
  test('drops junk', () => {
    expect(subscribersSearchSchema.parse({ status: 'x', order_by: 'id', page: 'abc' })).toEqual({});
  });
});

describe('parseAttribs', () => {
  test('blank is an empty object', () => {
    expect(parseAttribs('')).toEqual({ ok: true, value: {} });
    expect(parseAttribs('   ')).toEqual({ ok: true, value: {} });
  });
  test('a JSON object', () =>
    expect(parseAttribs('{"a": 1}')).toEqual({ ok: true, value: { a: 1 } }));
  test('arrays and scalars are rejected', () => {
    expect(parseAttribs('[1]').ok).toBe(false);
    expect(parseAttribs('1').ok).toBe(false);
    expect(parseAttribs('null').ok).toBe(false);
  });
  test('invalid JSON is rejected with the parser message', () => {
    const r = parseAttribs('{oops');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.length).toBeGreaterThan(0);
  });
});

describe('queryBody', () => {
  test('no search and no SQL means "all subscribers matching the filters"', () => {
    expect(
      queryBody({ list_id: [1], status: 'enabled', subscription_status: 'confirmed' }),
    ).toEqual({
      all: true,
      search: '',
      query: '',
      list_ids: [1],
      subscription_status: 'confirmed',
      subscriber_status: 'enabled',
    });
  });
  test('a search or SQL query switches "all" off', () => {
    expect(queryBody({ search: 'ana' }).all).toBe(false);
    expect(queryBody({ query: "name='x'" }).all).toBe(false);
  });
  test('defaults', () => {
    expect(queryBody({})).toEqual({
      all: true,
      search: '',
      query: '',
      list_ids: [],
      subscription_status: null,
      subscriber_status: '',
    });
  });
});

describe('exportUrl', () => {
  test('carries the filters and the selected ids', () => {
    const u = exportUrl('/lm', { search: 'a', list_id: [1, 2], status: 'enabled' }, [5, 6]);
    expect(u.startsWith('/lm/api/subscribers/export?')).toBe(true);
    const q = new URLSearchParams(u.split('?')[1]);
    expect(q.get('search')).toBe('a');
    expect(q.getAll('list_id')).toEqual(['1', '2']);
    expect(q.get('status')).toBe('enabled');
    expect(q.getAll('id')).toEqual(['5', '6']);
  });
  test('no ids, no id params', () => {
    expect(exportUrl('', {}, [])).toBe('/api/subscribers/export?');
  });
});

describe('manageListsBody', () => {
  test('ids and the preconfirm status', () => {
    expect(
      manageListsBody({ action: 'add', lists: [1, 2], preconfirm: true }, { ids: [9] }),
    ).toEqual({
      action: 'add',
      target_list_ids: [1, 2],
      status: 'confirmed',
      ids: [9],
    });
  });
  test('by query: the query body is merged in, no status without preconfirm', () => {
    const q = queryBody({ list_id: [3] });
    const b = manageListsBody({ action: 'remove', lists: [1], preconfirm: false }, { query: q });
    expect(b).toMatchObject({ action: 'remove', target_list_ids: [1], all: true, list_ids: [3] });
    expect('status' in b).toBe(false);
    expect('ids' in b).toBe(false);
  });
});

describe('hasOptinList / visibleLists', () => {
  const lists = [
    { id: 1, optin: 'single' as const },
    { id: 2, optin: 'double' as const },
  ];
  test('is any chosen list double opt-in', () => {
    expect(hasOptinList(lists, [1])).toBe(false);
    expect(hasOptinList(lists, [1, 2])).toBe(true);
    expect(hasOptinList(lists, [])).toBe(false);
  });
  test('first N lists and how many are hidden', () => {
    const subs = [1, 2, 3, 4, 5].map((id) => ({ id }));
    expect(visibleLists(subs, 3)).toEqual({ shown: subs.slice(0, 3), hidden: subs.slice(3) });
    expect(visibleLists(subs.slice(0, 2), 3)).toEqual({ shown: subs.slice(0, 2), hidden: [] });
  });
});
