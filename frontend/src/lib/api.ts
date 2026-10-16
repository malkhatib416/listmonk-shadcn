export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

export interface ApiDeps {
  fetch: typeof fetch;
  root: string | undefined;
  redirect: (url: string) => void;
  currentPath: () => string;
}

const browserDeps = (): ApiDeps => ({
  fetch: window.fetch.bind(window),
  root: window._LM_ROOT,
  redirect: (url) => window.location.assign(url),
  currentPath: () => window.location.pathname + window.location.search,
});

export const apiUrl = (root: string | undefined, path: string): string => (root ?? '') + path;

export const loginUrl = (root: string | undefined, next: string): string =>
  `${root ?? ''}/admin/login?next=${encodeURIComponent(next)}`;

// Go answers an unauthenticated API call with 403 + one of these messages. Any other
// 403 ("permission denied: …") is a real permission error and must not log the user out.
export const isAuthError = (status: number, message: string): boolean =>
  status === 403 && (message === 'invalid session' || message === 'invalid API credentials');

export async function apiFetch<T>(
  path: string,
  init: RequestInit = {},
  deps: ApiDeps = browserDeps(),
): Promise<T> {
  const res = await deps.fetch(apiUrl(deps.root, path), {
    credentials: 'same-origin',
    ...init,
    headers: {
      Accept: 'application/json',
      // Go rejects a body without a JSON content type (415).
      ...(typeof init.body === 'string' ? { 'Content-Type': 'application/json' } : {}),
      ...(init.headers as Record<string, string>),
    },
  });

  if (!res.ok) {
    let message = res.statusText;
    try {
      const body = (await res.json()) as { message?: string };
      if (body.message) message = body.message;
    } catch {
      // not JSON; keep the status text
    }
    if (isAuthError(res.status, message)) {
      deps.redirect(loginUrl(deps.root, deps.currentPath()));
    }
    throw new ApiError(res.status, message);
  }

  return ((await res.json()) as { data: T }).data;
}
