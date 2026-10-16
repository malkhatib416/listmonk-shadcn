import { describe, expect, test } from 'bun:test';
import { ApiError, apiFetch, apiUrl, isAuthError, loginUrl, type ApiDeps } from './api';

function deps(res: Response, overrides: Partial<ApiDeps> = {}) {
  const redirects: string[] = [];
  const d: ApiDeps = {
    fetch: (async () => res) as unknown as typeof fetch,
    root: '',
    redirect: (u) => redirects.push(u),
    currentPath: () => '/admin/settings/logs',
    ...overrides,
  };
  return { d, redirects };
}

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

describe('apiUrl', () => {
  test('prefixes the root path', () => {
    expect(apiUrl('/lm', '/api/config')).toBe('/lm/api/config');
    expect(apiUrl('', '/api/config')).toBe('/api/config');
    expect(apiUrl(undefined, '/api/config')).toBe('/api/config');
  });
});

describe('loginUrl', () => {
  test('encodes the current path as next', () => {
    expect(loginUrl('', '/admin/settings/logs')).toBe(
      '/admin/login?next=%2Fadmin%2Fsettings%2Flogs',
    );
    expect(loginUrl('/lm', '/lm/admin/x')).toBe('/lm/admin/login?next=%2Flm%2Fadmin%2Fx');
  });
});

describe('isAuthError', () => {
  test('only 403 session/credential errors', () => {
    expect(isAuthError(403, 'invalid session')).toBe(true);
    expect(isAuthError(403, 'invalid API credentials')).toBe(true);
    expect(isAuthError(403, 'permission denied: settings:get')).toBe(false);
    expect(isAuthError(500, 'invalid session')).toBe(false);
  });
});

describe('apiFetch', () => {
  test('unwraps {data}', async () => {
    const { d } = deps(json(200, { data: { a: 1 } }));
    expect(await apiFetch('/api/x', undefined, d)).toEqual({ a: 1 });
  });

  test('calls the prefixed URL with credentials and JSON accept', async () => {
    let seen: { url: string; init?: RequestInit } | undefined;
    const { d } = deps(json(200, { data: 1 }), {
      root: '/lm',
      fetch: (async (url: string, init?: RequestInit) => {
        seen = { url, init };
        return json(200, { data: 1 });
      }) as unknown as typeof fetch,
    });
    await apiFetch('/api/x', undefined, d);
    expect(seen).toBeDefined();
    expect(seen!.url).toBe('/lm/api/x');
    const init = seen!.init ?? {};
    expect(init.credentials).toBe('same-origin');
    expect((init.headers as Record<string, string>).Accept).toBe('application/json');
  });

  test('a string body is sent as JSON, a caller-set content type is kept', async () => {
    const sent: Record<string, string>[] = [];
    const capture = (async (_url: string, init?: RequestInit) => {
      sent.push(init?.headers as Record<string, string>);
      return json(200, { data: 1 });
    }) as unknown as typeof fetch;
    const { d } = deps(json(200, { data: 1 }), { fetch: capture });
    await apiFetch('/api/x', { method: 'POST', body: '{"a":1}' }, d);
    await apiFetch('/api/x', { method: 'GET' }, d);
    await apiFetch(
      '/api/x',
      { method: 'POST', body: 'a=1', headers: { 'Content-Type': 'text/plain' } },
      d,
    );
    expect(sent[0]!['Content-Type']).toBe('application/json');
    expect(sent[1]!['Content-Type']).toBeUndefined();
    expect(sent[2]!['Content-Type']).toBe('text/plain');
  });

  test('throws ApiError with the server message', async () => {
    const { d, redirects } = deps(json(500, { message: 'boom' }));
    const err = (await apiFetch('/api/x', undefined, d).catch((e) => e)) as ApiError;
    expect(err).toBeInstanceOf(ApiError);
    expect(err.status).toBe(500);
    expect(err.message).toBe('boom');
    expect(redirects).toEqual([]);
  });

  test('non-JSON error body falls back to the status text', async () => {
    const { d } = deps(new Response('<html>', { status: 502, statusText: 'Bad Gateway' }));
    const err = (await apiFetch('/api/x', undefined, d).catch((e) => e)) as ApiError;
    expect(err.message).toBe('Bad Gateway');
  });

  test('redirects to login on an expired session, keeps the throw', async () => {
    const { d, redirects } = deps(json(403, { message: 'invalid session' }));
    await expect(apiFetch('/api/x', undefined, d)).rejects.toBeInstanceOf(ApiError);
    expect(redirects).toEqual(['/admin/login?next=%2Fadmin%2Fsettings%2Flogs']);
  });

  test('permission denied does not redirect', async () => {
    const { d, redirects } = deps(json(403, { message: 'permission denied: settings:get' }));
    await expect(apiFetch('/api/x', undefined, d)).rejects.toBeInstanceOf(ApiError);
    expect(redirects).toEqual([]);
  });
});
