import { createFileRoute, redirect } from '@tanstack/react-router';

// Old per-tab paths (/campaigns/:id/content) now live in the URL hash.
export const Route = createFileRoute('/_app/campaigns/$id/$tab')({
  beforeLoad: ({ params }) => {
    throw redirect({
      to: '/campaigns/$id',
      params: { id: params.id },
      hash: `tab=${params.tab}`,
      replace: true,
    });
  },
});
