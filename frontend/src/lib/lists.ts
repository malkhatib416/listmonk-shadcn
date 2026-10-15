import { queryOptions } from '@tanstack/react-query';
import { apiFetch } from './api';

export interface ListRef {
  id: number;
  name: string;
}

// Every list (id + name only), for pickers.
export const listsMinimalQuery = queryOptions({
  queryKey: ['lists', 'minimal'],
  queryFn: async () =>
    (await apiFetch<{ results: ListRef[] }>('/api/lists?minimal=true&per_page=all')).results ?? [],
});
