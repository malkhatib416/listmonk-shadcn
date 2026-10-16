import { describe, expect, test } from 'bun:test';
import { filterTemplates, type Template } from './templates';

const tpl = (over: Partial<Template>): Template => ({
  id: 1,
  name: 'T',
  type: 'campaign',
  subject: '',
  body: '',
  body_source: null,
  is_default: false,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
  ...over,
});

const all = [
  tpl({ id: 1, name: 'Newsletter', type: 'campaign' }),
  tpl({ id: 2, name: 'Welcome mail', type: 'tx', subject: 'Hello there' }),
  tpl({ id: 3, name: 'Drag and drop', type: 'campaign_visual' }),
];
const ids = (xs: Template[]) => xs.map((t) => t.id);

describe('filterTemplates', () => {
  test('no filters', () => expect(ids(filterTemplates(all, {}))).toEqual([1, 2, 3]));
  test('by type', () => expect(ids(filterTemplates(all, { type: 'tx' }))).toEqual([2]));
  test('by name, case-insensitive', () =>
    expect(ids(filterTemplates(all, { query: 'NEWS' }))).toEqual([1]));
  test('the query also matches a transactional subject', () =>
    expect(ids(filterTemplates(all, { query: 'hello' }))).toEqual([2]));
  test('type and query combine', () =>
    expect(ids(filterTemplates(all, { type: 'campaign', query: 'mail' }))).toEqual([]));
});
