import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/next')({
  component: () => <h1>listmonk</h1>,
});
