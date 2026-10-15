import { queryOptions } from '@tanstack/react-query';
import { apiFetch } from './api';
import type { PageResults } from './paging';

export interface Media {
  id: number;
  uuid: string;
  filename: string;
  content_type: string;
  created_at: string;
  thumb_url: string | null;
  url: string;
  provider: string;
}

export const fileExt = (name: string): string => {
  const i = name.lastIndexOf('.');
  return i >= 0 ? name.slice(i + 1).toUpperCase() : '';
};

export const mediaQuery = (page: number, query: string) =>
  queryOptions({
    queryKey: ['media', { page, query }],
    queryFn: () => {
      const q = new URLSearchParams({ page: String(page) });
      if (query) q.set('query', query);
      return apiFetch<PageResults<Media>>(`/api/media?${q}`);
    },
    placeholderData: (prev) => prev,
  });

// Upload one file; resolves with an error message or null.
export async function uploadFile(file: File): Promise<string | null> {
  const body = new FormData();
  body.set('file', file);
  try {
    await apiFetch('/api/media', { method: 'POST', body });
    return null;
  } catch (e) {
    return `${file.name}: ${(e as Error).message}`;
  }
}
