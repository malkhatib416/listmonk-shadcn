import { queryOptions } from '@tanstack/react-query';
import { apiFetch } from './api';

export type ImportMode = 'subscribe' | 'blocklist';

export interface ImportForm {
  mode: ImportMode;
  subStatus: 'unconfirmed' | 'confirmed' | 'unsubscribed';
  delim: string;
  lists: number[];
  overwriteUserInfo: boolean;
  overwriteSubStatus: boolean;
  file: File | null;
}

export interface ImportStatus {
  status: 'none' | 'importing' | 'stopping' | 'finished' | 'stopped' | 'failed' | string;
  name?: string;
  total: number;
  imported: number;
}

export const canUpload = (f: ImportForm): boolean =>
  !!f.file && f.delim.length === 1 && !(f.mode === 'subscribe' && f.lists.length === 0);

export const statusAfterModeChange = (mode: ImportMode): ImportForm['subStatus'] =>
  mode === 'subscribe' ? 'unconfirmed' : 'unsubscribed';

export const importParams = (f: ImportForm) => ({
  mode: f.mode,
  subscription_status: f.subStatus,
  delim: f.delim,
  lists: f.lists,
  overwrite_userinfo: f.overwriteUserInfo,
  overwrite_subscription_status: f.overwriteSubStatus,
});

export const isRunning = (s: ImportStatus): boolean =>
  s.status === 'importing' || s.status === 'stopping';
export const isDone = (s: ImportStatus): boolean =>
  ['finished', 'stopped', 'failed'].includes(s.status);
export const progress = (s: ImportStatus): number =>
  s.total > 0 ? Math.ceil((s.imported / s.total) * 100) : 0;

export const importStatusQuery = queryOptions({
  queryKey: ['import', 'status'],
  queryFn: () => apiFetch<ImportStatus>('/api/import/subscribers'),
  // Poll while an import runs.
  refetchInterval: (q) => (q.state.data && isRunning(q.state.data) ? 500 : false),
});

export const importLogsQuery = (enabled: boolean, running: boolean) =>
  queryOptions({
    queryKey: ['import', 'logs'],
    queryFn: () => apiFetch<string>('/api/import/subscribers/logs'),
    enabled,
    refetchInterval: running ? 500 : false,
  });
