import { queryOptions } from '@tanstack/react-query';
import { z } from 'zod';
import { apiFetch } from './api';

export interface UserRole {
  id: number;
  name: string;
  permissions: string[];
}

export interface ListRoleRef {
  id: number;
  name: string;
  lists: { id: number; name: string; permissions: string[] }[] | null;
}

export interface User {
  id: number;
  created_at: string;
  updated_at: string;
  username: string;
  name: string;
  email: string | null;
  type: 'user' | 'api';
  status: 'enabled' | 'disabled';
  avatar: string | null;
  password_login: boolean;
  twofa_type: string;
  loggedin_at: string | null;
  user_role: UserRole;
  list_role: ListRoleRef | null;
}

export const userLabel = (u: Pick<User, 'name' | 'username'>): string => u.name || u.username;

// A bad filter in the URL is ignored rather than breaking the page.
const optional = <T extends z.ZodType>(s: T) => s.optional().catch(undefined);

export const usersSearchSchema = z
  .object({
    type: optional(z.enum(['user', 'api'])),
    status: optional(z.enum(['enabled', 'disabled'])),
    user_role_id: optional(z.coerce.number().int().positive()),
    list_role_id: optional(z.coerce.number().int().positive()),
  })
  .transform((o) => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined)));

export type UsersSearch = {
  type?: User['type'];
  status?: User['status'];
  user_role_id?: number;
  list_role_id?: number;
};

export function filterUsers(users: User[], f: UsersSearch): User[] {
  return users.filter(
    (u) =>
      (!f.type || u.type === f.type) &&
      (!f.status || u.status === f.status) &&
      (!f.user_role_id || u.user_role.id === f.user_role_id) &&
      (!f.list_role_id || u.list_role?.id === f.list_role_id),
  );
}

export const usersQuery = queryOptions({
  queryKey: ['users'],
  queryFn: () => apiFetch<User[]>('/api/users'),
});

export const userQuery = (id: number) =>
  queryOptions({ queryKey: ['users', id], queryFn: () => apiFetch<User>(`/api/users/${id}`) });
