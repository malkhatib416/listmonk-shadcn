import { createFileRoute } from '@tanstack/react-router';
import { MediaGallery } from '@/components/media-gallery';

export const Route = createFileRoute('/_app/campaigns/media')({
  head: () => ({ meta: [{ title: 'Media - listmonk' }] }),
  component: () => <MediaGallery />,
});
