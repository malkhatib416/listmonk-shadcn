import { createFileRoute } from '@tanstack/react-router';

// Not served by Go yet: /admin still renders the Go-template dashboard. This route
// exists so the SPA shell prerender has a matching route to request.
export const Route = createFileRoute('/')({
  component: () => null,
});
