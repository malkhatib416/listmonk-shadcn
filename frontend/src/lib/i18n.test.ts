import { describe, expect, test } from 'bun:test';
import { createT } from './i18n';

describe('createT', () => {
  const t = createT({ 'logs.title': 'Logs', 'x.hello': 'Hello {name}, {count} new' });

  test('looks up a key', () => expect(t('logs.title')).toBe('Logs'));
  test('missing key returns the key', () => expect(t('nope.key')).toBe('nope.key'));
  test('substitutes params', () =>
    expect(t('x.hello', { name: 'Ana', count: 3 })).toBe('Hello Ana, 3 new'));
  test('leaves unknown placeholders intact', () =>
    expect(t('x.hello', { name: 'Ana' })).toBe('Hello Ana, {count} new'));
});
