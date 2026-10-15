import { describe, expect, test } from 'bun:test';
import { can, type AppUser } from './permissions';

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
