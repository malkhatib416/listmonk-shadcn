declare global {
  interface Window {
    // Path component of app.root_url ("" or "/lm"), set by Go on the shell.
    _LM_ROOT?: string;
  }
}

export const ADMIN_PATH = '/admin';

// Router basepath. Client only; the SPA shell is prerendered without a root path.
export function adminBasepath(): string {
  if (typeof window === 'undefined') return ADMIN_PATH;
  return (window._LM_ROOT ?? '') + ADMIN_PATH;
}
