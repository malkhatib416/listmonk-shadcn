import { describe, expect, test } from 'bun:test';
import { NAV, activeNavItem, visibleNav } from './nav';
import type { AppUser } from './permissions';

const user = (roleId: number, permissions: string[]): AppUser => ({
  id: 2,
  username: 'u',
  name: 'U',
  email: null,
  avatar: null,
  user_role: { id: roleId, name: 'r', permissions },
});

const itemKeys = (u: AppUser) => visibleNav(u).flatMap((g) => g.items.map((i) => i.key));

describe('visibleNav', () => {
  test('super admin sees every item', () => {
    const all = NAV.flatMap((g) => g.items.map((i) => i.key));
    expect(itemKeys(user(1, []))).toEqual(all);
  });

  test('a user with no permissions sees only ungated items', () => {
    const keys = itemKeys(user(2, []));
    expect(keys).toContain('dashboard');
    expect(keys).not.toContain('settings.logs');
  });

  test('empty groups are dropped', () => {
    const groups = visibleNav(user(2, [])).map((g) => g.key);
    expect(groups).not.toContain('settings');
    expect(groups).not.toContain('users');
  });

  test('settings:get shows logs but not maintenance', () => {
    const keys = itemKeys(user(2, ['settings:get']));
    expect(keys).toContain('settings.logs');
    expect(keys).not.toContain('settings.maintenance');
  });
});

describe('activeNavItem', () => {
  test('an exact path is active', () => {
    expect(activeNavItem('/settings/logs')?.key).toBe('settings.logs');
  });

  test('a sub-page keeps its section active, the longest match wins', () => {
    expect(activeNavItem('/users/5')?.key).toBe('users.users');
    expect(activeNavItem('/users/new')?.key).toBe('users.users');
    expect(activeNavItem('/users/roles')?.key).toBe('users.user-roles');
    expect(activeNavItem('/users/roles/3')?.key).toBe('users.user-roles');
    expect(activeNavItem('/users/roles/lists/new')?.key).toBe('users.list-roles');
  });

  test('no match for an unknown path', () => {
    expect(activeNavItem('/nope')).toBeUndefined();
    expect(activeNavItem('/usersx')).toBeUndefined();
  });

  test('the archived lists link wins only for its filter', () => {
    expect(activeNavItem('/lists', { status: 'archived' })?.key).toBe('lists.archived');
    expect(activeNavItem('/lists', {})?.key).toBe('lists.all');
    expect(activeNavItem('/lists', { status: 'active' })?.key).toBe('lists.all');
    expect(activeNavItem('/lists/5')?.key).toBe('lists.all');
  });

  test('new campaign, media and analytics are not "all campaigns"', () => {
    expect(activeNavItem('/campaigns/new')?.key).toBe('campaigns.new');
    expect(activeNavItem('/campaigns/media')?.key).toBe('campaigns.media');
    expect(activeNavItem('/campaigns/7')?.key).toBe('campaigns.all');
    expect(activeNavItem('/settings')?.key).toBe('settings.all');
    expect(activeNavItem('/settings/maintenance')?.key).toBe('settings.maintenance');
  });

  test('the dashboard owns the root path only', () => {
    expect(activeNavItem('/')?.key).toBe('dashboard');
  });
});
