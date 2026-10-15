import { createRouter } from '@tanstack/react-router';
import { adminBasepath } from './env';
import { routeTree } from './routeTree.gen';

export function getRouter() {
  return createRouter({
    routeTree,
    basepath: adminBasepath(),
    scrollRestoration: true,
    defaultNotFoundComponent: () => <p>Not found</p>,
  });
}

declare module '@tanstack/react-router' {
  interface Register {
    router: ReturnType<typeof getRouter>;
  }
}
