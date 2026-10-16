import { describe, expect, test } from 'bun:test';
import { canGetList, canManageList, can, type AppUser } from './permissions';

const user = (roleId: number, permissions: string[]): AppUser => ({
  id: 2,
  username: 'u',
  name: 'U',
  email: null,
  avatar: null,
  user_role: { id: roleId, name: 'r', permissions },
});

describe('can', () => {
  test('super admin can everything', () => expect(can(user(1, []), 'settings:get')).toBe(true));
  test('exact match', () => {
    const u = user(2, ['settings:get']);
    expect(can(u, 'settings:get')).toBe(true);
    expect(can(u, 'settings:manage')).toBe(false);
  });
  test('any-of', () => expect(can(user(2, ['b:get']), 'a:get', 'b:get')).toBe(true));
  test('prefix wildcard', () => {
    expect(can(user(2, ['campaigns:get_all']), 'campaigns:*')).toBe(true);
    expect(can(user(2, ['lists:get_all']), 'campaigns:*')).toBe(false);
  });
  test('no perms asked is false', () => expect(can(user(2, ['a']))).toBe(false));
});

describe('list permissions', () => {
  const withListRole = (
    perms: string[],
    lists: { id: number; permissions: string[] }[],
  ): AppUser => ({
    ...user(2, perms),
    list_role: { id: 9, name: 'r', lists },
  });

  test('super admin and the *_all permissions cover every list', () => {
    expect(canManageList(user(1, []), 5)).toBe(true);
    expect(canManageList(user(2, ['lists:manage_all']), 5)).toBe(true);
    expect(canGetList(user(2, ['lists:get_all']), 5)).toBe(true);
    expect(canManageList(user(2, ['lists:get_all']), 5)).toBe(false);
  });

  test('a list role grants per-list view and manage', () => {
    const u = withListRole(
      [],
      [
        { id: 1, permissions: ['list:get', 'list:manage'] },
        { id: 2, permissions: ['list:get'] },
      ],
    );
    expect(canGetList(u, 1)).toBe(true);
    expect(canManageList(u, 1)).toBe(true);
    expect(canGetList(u, 2)).toBe(true);
    expect(canManageList(u, 2)).toBe(false);
    expect(canGetList(u, 3)).toBe(false);
  });

  test('no list role, no access', () => {
    expect(canGetList(user(2, []), 1)).toBe(false);
  });
});
