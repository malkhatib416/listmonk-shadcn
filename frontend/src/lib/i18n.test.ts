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

describe('createT plurals and references', () => {
  const t = createT({
    'users.userRole': 'User role | User roles',
    'globals.terms.users': 'Users',
    'globals.messages.deleted': "'{name}' deleted",
    'single.only': 'Just one',
  });

  test('t returns the singular of "Singular | Plural"', () => {
    expect(t('users.userRole')).toBe('User role');
  });

  test('tc picks singular for 1 or fewer, plural for more', () => {
    expect(t.tc('users.userRole', 1)).toBe('User role');
    expect(t.tc('users.userRole', 0)).toBe('User role');
    expect(t.tc('users.userRole', 2)).toBe('User roles');
  });

  test('tc on a string with no pipe, or a missing key', () => {
    expect(t.tc('single.only', 5)).toBe('Just one');
    expect(t.tc('nope', 5)).toBe('nope');
  });

  test('param values may reference other keys, as in the Go Ts()', () => {
    expect(t('globals.messages.deleted', { name: '{globals.terms.users}' })).toBe(
      "'Users' deleted",
    );
  });
});
