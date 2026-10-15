import { QueryClient } from '@tanstack/react-query';
import { createRouter } from '@tanstack/react-router';
import { adminPrefix, adminRewrite } from './lib/basepath';
import { parseSearch, stringifySearch } from './lib/search';
import { routeTree } from './routeTree.gen';

export function getRouter() {
  const queryClient = new QueryClient();
  return createRouter({
    routeTree,
    context: { queryClient },
    parseSearch,
    stringifySearch,
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
