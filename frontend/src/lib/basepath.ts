export const ADMIN_PATH = '/admin';

// Browser-facing path prefix of the admin: the root URL's path (set by Go as
// window._LM_ROOT, "" or "/lm") plus /admin.
export function adminPrefix(root: string | undefined): string {
  return (root ?? '') + ADMIN_PATH;
}

interface UrlRewrite {
  input: (ctx: { url: URL }) => URL;
  output: (ctx: { url: URL }) => URL;
}

// A runtime basepath for the router. Start bakes its own basepath into the bundle at
// build time (it overrides router options on hydrate), which can't know the root URL
// path, so the router runs at "/" and this rewrite maps the browser URL to and from it.
export function adminRewrite(prefix: string): UrlRewrite {
  return {
    input: ({ url }) => {
      if (url.pathname === prefix) url.pathname = '/';
      else if (url.pathname.startsWith(prefix + '/'))
        url.pathname = url.pathname.slice(prefix.length);
      return url;
    },
    output: ({ url }) => {
      url.pathname = url.pathname === '/' ? prefix : prefix + url.pathname;
      return url;
    },
  };
}

// href for a link that must be a full page load (an unported page served by Go).
export function hardHref(root: string | undefined, path: string): string {
  return (root ?? '') + path;
}

// URL of a file from frontend/public, which Go serves under /admin/app. The dev server
// serves public files from its own root instead.
export function appAssetHref(root: string | undefined, path: string, dev = false): string {
  return dev ? `/${path}` : hardHref(root, `/admin/app/${path}`);
}
