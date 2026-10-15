import { describe, expect, test } from 'bun:test';
import {
  availableLists,
  defaultUserPerms,
  toggleAllPerms,
  togglePerm,
  type PermGroup,
} from './roles';

const groups: PermGroup[] = [
  { group: 'lists', permissions: ['lists:get_all', 'lists:manage_all'] },
  { group: 'subscribers', permissions: ['subscribers:get', 'subscribers:sql_query', 'tx:send'] },
  { group: 'campaigns', permissions: ['campaigns:get'] },
  { group: 'users', permissions: ['users:get', 'users:manage'] },
  { group: 'settings', permissions: ['settings:get'] },
];

describe('defaultUserPerms', () => {
  test('skips users, lists:*, settings:* and raw SQL', () => {
    expect(defaultUserPerms(groups)).toEqual(['subscribers:get', 'tx:send', 'campaigns:get']);
  });
});

describe('toggleAllPerms', () => {
  test('clears when anything is selected', () => expect(toggleAllPerms(['a'], groups)).toEqual([]));
  test('selects everything when empty', () => {
    expect(toggleAllPerms([], groups)).toHaveLength(9);
  });
});

describe('togglePerm', () => {
  test('adds and removes', () => {
    expect(togglePerm(['a'], 'b')).toEqual(['a', 'b']);
    expect(togglePerm(['a', 'b'], 'a')).toEqual(['b']);
  });
});

describe('availableLists', () => {
  test('excludes lists already in the role', () => {
    const all = [{ id: 1 }, { id: 2 }, { id: 3 }];
    expect(availableLists(all, [{ id: 2 }])).toEqual([{ id: 1 }, { id: 3 }]);
    expect(availableLists(all, [])).toEqual(all);
  });
});
