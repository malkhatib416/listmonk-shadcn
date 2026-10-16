import { describe, expect, test } from 'bun:test';
import { userFormSchema, userPayload, type UserFormValues } from './user-form';

const base: UserFormValues = {
  type: 'user',
  username: 'ana',
  name: 'Ana',
  email: 'ana@example.com',
  status: 'enabled',
  password_login: true,
  password: 'longenough1',
  password2: 'longenough1',
  user_role_id: '2',
  list_role_id: '',
};

const issues = (v: Partial<UserFormValues>, isNew = true) =>
  userFormSchema(isNew)
    .safeParse({ ...base, ...v })
    .error?.issues.map((i) => i.path.join('.')) ?? [];

describe('userFormSchema', () => {
  test('a valid new user', () => expect(issues({})).toEqual([]));

  test('username: required, allowed characters only', () => {
    expect(issues({ username: '' })).toContain('username');
    expect(issues({ username: 'a b' })).toContain('username');
    expect(issues({ username: 'ana.k@x-1_2' })).not.toContain('username');
  });

  test('email is required for users, not for API users', () => {
    expect(issues({ email: '' })).toContain('email');
    expect(issues({ email: 'nope' })).toContain('email');
    expect(issues({ type: 'api', email: '', password_login: false })).toEqual([]);
  });

  test('a new user with password login needs a password of 8+ chars', () => {
    expect(issues({ password: '' })).toContain('password');
    expect(issues({ password: 'short', password2: 'short' })).toContain('password');
  });

  test('passwords must match', () => {
    expect(issues({ password2: 'different1' })).toContain('password2');
  });

  test('editing: a blank password means "keep the current one"', () => {
    expect(issues({ password: '', password2: '' }, false)).toEqual([]);
    expect(issues({ password: 'longenough1', password2: 'x' }, false)).toContain('password2');
  });

  test('no password login: password is not validated', () => {
    expect(issues({ password_login: false, password: '', password2: '' })).toEqual([]);
  });

  test('a user role is required', () => {
    expect(issues({ user_role_id: '' })).toContain('user_role_id');
  });
});

describe('userPayload', () => {
  test('a normal user with a password and no list role', () => {
    expect(userPayload(base)).toEqual({
      username: 'ana',
      name: 'Ana',
      email: 'ana@example.com',
      type: 'user',
      status: 'enabled',
      password_login: true,
      password: 'longenough1',
      user_role_id: 2,
      list_role_id: null,
    });
  });

  test('API users never send a password or password login', () => {
    const p = userPayload({ ...base, type: 'api', password_login: true });
    expect(p.password_login).toBe(false);
    expect(p.password).toBeNull();
  });

  test('a blank password is sent as null, a list role as a number', () => {
    const p = userPayload({ ...base, password: '', password2: '', list_role_id: '5' });
    expect(p.password).toBeNull();
    expect(p.list_role_id).toBe(5);
  });
});
