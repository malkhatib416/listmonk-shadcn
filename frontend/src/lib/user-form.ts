import { z } from 'zod';
import type { User } from './users';

export interface UserFormValues {
  type: 'user' | 'api';
  username: string;
  name: string;
  email: string;
  status: 'enabled' | 'disabled';
  password_login: boolean;
  password: string;
  password2: string;
  user_role_id: string;
  list_role_id: string;
}

const MIN_PASSWORD = 8;

// Messages are i18n keys, translated where they are rendered.
export const userFormSchema = (isNew: boolean) =>
  z
    .object({
      type: z.enum(['user', 'api']),
      username: z
        .string()
        .min(3, 'globals.messages.invalidFields')
        .max(200)
        .regex(/^[a-zA-Z0-9_\-.@]+$/, 'globals.messages.invalidFields'),
      name: z.string().max(200),
      email: z.string().max(200),
      status: z.enum(['enabled', 'disabled']),
      password_login: z.boolean(),
      password: z.string().max(200),
      password2: z.string().max(200),
      user_role_id: z.string().min(1, 'globals.messages.invalidFields'),
      list_role_id: z.string(),
    })
    .superRefine((v, ctx) => {
      if (v.type !== 'api' && !z.email().safeParse(v.email).success) {
        ctx.addIssue({
          code: 'custom',
          path: ['email'],
          message: 'globals.messages.invalidFields',
        });
      }
      if (v.type === 'api' || !v.password_login) return;
      // On edit, a blank password keeps the current one.
      if (v.password === '' ? isNew : v.password.length < MIN_PASSWORD) {
        ctx.addIssue({
          code: 'custom',
          path: ['password'],
          message: 'globals.messages.invalidFields',
        });
      }
      if (v.password !== v.password2) {
        ctx.addIssue({ code: 'custom', path: ['password2'], message: 'users.passwordMismatch' });
      }
    });

export function userPayload(v: UserFormValues) {
  const withPassword = v.type !== 'api' && v.password_login;
  return {
    username: v.username,
    name: v.name,
    email: v.email,
    type: v.type,
    status: v.status,
    password_login: withPassword,
    password: withPassword && v.password ? v.password : null,
    user_role_id: Number(v.user_role_id),
    list_role_id: v.list_role_id ? Number(v.list_role_id) : null,
  };
}

export function userFormDefaults(
  u: User | undefined,
  defaultRoleID: number | undefined,
): UserFormValues {
  return {
    type: u?.type ?? 'user',
    username: u?.username ?? '',
    name: u?.name ?? '',
    email: u?.email ?? '',
    status: u?.status ?? 'enabled',
    password_login: u?.password_login ?? true,
    password: '',
    password2: '',
    user_role_id: String(u?.user_role.id ?? defaultRoleID ?? ''),
    list_role_id: u?.list_role ? String(u.list_role.id) : '',
  };
}
