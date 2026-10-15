import { createRouter } from '@tanstack/react-router';
import { adminPrefix, adminRewrite } from './lib/basepath';
import { routeTree } from './routeTree.gen';

export function getRouter() {
  return createRouter({
    routeTree,
    // Runtime root-URL-aware prefix, see lib/basepath.ts.
    rewrite: adminRewrite(adminPrefix(typeof window === 'undefined' ? undefined : window._LM_ROOT)),
    scrollRestoration: true,
    defaultNotFoundComponent: () => <p>Not found</p>,
  });
}

declare module '@tanstack/react-router' {
  interface Register {
    router: ReturnType<typeof getRouter>;
  }
}
