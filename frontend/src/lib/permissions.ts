export const SUPER_ADMIN_ROLE_ID = 1;

export interface AppUser {
  id: number;
  username: string;
  name: string;
  email: string | null;
  avatar: string | null;
  // Present on /api/profile; used by the profile page.
  type?: 'user' | 'api';
  password_login?: boolean;
  twofa_type?: string;
  user_role: { id: number; name: string; permissions: string[] };
  list_role?: {
    id: number;
    name: string;
    lists: { id: number; permissions: string[] }[] | null;
  } | null;
}

// Mirrors `can` in cmd/views.go: any-of, "prefix*" wildcard, super admin short-circuit.
export function can(user: AppUser, ...perms: string[]): boolean {
  if (user.user_role.id === SUPER_ADMIN_ROLE_ID) return true;
  const held = user.user_role.permissions;
  return perms.some((p) =>
    p.endsWith('*') ? held.some((h) => h.startsWith(p.slice(0, -1))) : held.includes(p),
  );
}

// The user's per-list permissions (from the list role), e.g. "list:manage".
function listPerms(user: AppUser, listId: number): string[] {
  return user.list_role?.lists?.find((l) => l.id === listId)?.permissions ?? [];
}

// Mirrors Go's HasListPerm: the blanket "lists:*_all" permission, or the list role entry.
export function canGetList(user: AppUser, listId: number): boolean {
  return can(user, 'lists:get_all') || listPerms(user, listId).includes('list:get');
}

export function canManageList(user: AppUser, listId: number): boolean {
  return can(user, 'lists:manage_all') || listPerms(user, listId).includes('list:manage');
}
