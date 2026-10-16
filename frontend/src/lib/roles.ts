import { queryOptions } from '@tanstack/react-query';
import { apiFetch } from './api';

export interface UserRoleFull {
  id: number;
  created_at: string;
  updated_at: string;
  type: 'user';
  name: string;
  permissions: string[];
}

export interface ListPerm {
  id: number;
  name: string;
  permissions: string[];
}

export interface ListRoleFull {
  id: number;
  created_at: string;
  updated_at: string;
  name: string;
  lists: ListPerm[] | null;
}

// The primordial Super Admin role: all permissions, not editable or deletable.
export const SUPER_ADMIN_ROLE_ID = 1;

export const userRolesQuery = queryOptions({
  queryKey: ['roles', 'users'],
  queryFn: () => apiFetch<UserRoleFull[]>('/api/roles/users'),
});

export const listRolesQuery = queryOptions({
  queryKey: ['roles', 'lists'],
  queryFn: () => apiFetch<ListRoleFull[]>('/api/roles/lists'),
});

export interface PermGroup {
  group: string;
  permissions: string[];
}

// Permissions that deserve a warning in the role form.
export const HIGH_RISK_PERMISSIONS = ['subscribers:sql_query', 'users:manage'];

// Pre-selected permissions for a new user role: everything except the admin/users
// groups, the raw SQL permission, and the lists:/settings: permissions.
export function defaultUserPerms(groups: PermGroup[]): string[] {
  return groups
    .filter((g) => g.group !== 'admin' && g.group !== 'users')
    .flatMap((g) => g.permissions)
    .filter(
      (p) => p !== 'subscribers:sql_query' && !p.startsWith('lists:') && !p.startsWith('settings:'),
    );
}

// "Toggle selection": clears if anything is selected, otherwise selects everything.
export function toggleAllPerms(selected: string[], groups: PermGroup[]): string[] {
  return selected.length > 0 ? [] : groups.flatMap((g) => g.permissions);
}

export const togglePerm = (selected: string[], perm: string): string[] =>
  selected.includes(perm) ? selected.filter((p) => p !== perm) : [...selected, perm];

// Lists not yet added to a list role.
export const availableLists = <T extends { id: number }>(
  all: T[],
  chosen: { id: number }[],
): T[] => {
  const ids = new Set(chosen.map((c) => c.id));
  return all.filter((l) => !ids.has(l.id));
};

// "list:get" and "list:manage" are the two per-list permissions.
export const LIST_PERMS = ['list:get', 'list:manage'] as const;
