import { createStart } from '@tanstack/react-start';

export const startInstance = createStart(() => ({
  // SPA: nothing but the shell is rendered on the server.
  defaultSsr: false,
}));
