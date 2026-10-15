import { describe, expect, test } from 'bun:test';
import { filterUsers, userLabel, usersSearchSchema, type User } from './users';

const user = (over: Partial<User>): User => ({
  id: 1,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
  username: 'u',
  name: '',
  email: null,
  type: 'user',
  status: 'enabled',
  avatar: null,
  password_login: true,
  twofa_type: 'none',
  loggedin_at: null,
  user_role: { id: 2, name: 'Editor', permissions: [] },
  list_role: null,
  ...over,
});

const users = [
  user({ id: 1, username: 'a', type: 'user', status: 'enabled' }),
  user({ id: 2, username: 'b', type: 'api', status: 'enabled' }),
  user({
    id: 3,
    username: 'c',
    type: 'user',
    status: 'disabled',
    user_role: { id: 3, name: 'RO', permissions: [] },
  }),
  user({ id: 4, username: 'd', list_role: { id: 9, name: 'EU', lists: [] } }),
];
const ids = (xs: User[]) => xs.map((u) => u.id);

describe('filterUsers', () => {
  test('no filters keeps everyone', () =>
    expect(ids(filterUsers(users, {}))).toEqual([1, 2, 3, 4]));
  test('by type', () => expect(ids(filterUsers(users, { type: 'api' }))).toEqual([2]));
  test('by status', () => expect(ids(filterUsers(users, { status: 'disabled' }))).toEqual([3]));
  test('by user role', () => expect(ids(filterUsers(users, { user_role_id: 3 }))).toEqual([3]));
  test('by list role', () => expect(ids(filterUsers(users, { list_role_id: 9 }))).toEqual([4]));
  test('filters combine', () =>
    expect(ids(filterUsers(users, { type: 'user', status: 'enabled' }))).toEqual([1, 4]));
});

describe('userLabel', () => {
  test('prefers the name, falls back to the username', () => {
    expect(userLabel(user({ name: 'Ana', username: 'ana1' }))).toBe('Ana');
    expect(userLabel(user({ name: '', username: 'ana1' }))).toBe('ana1');
  });
});

describe('usersSearchSchema', () => {
  test('accepts known filters and coerces ids', () => {
    expect(usersSearchSchema.parse({ type: 'api', user_role_id: '3' })).toEqual({
      type: 'api',
      user_role_id: 3,
    });
  });
  test('drops junk instead of throwing', () => {
    expect(
      usersSearchSchema.parse({ type: 'wat', status: 'x', user_role_id: 'abc', q: 1 }),
    ).toEqual({});
  });
});
