import { apiUrl } from './api';

// "YYYY-MM-DD" for n days before `now`, for <input type="date"> defaults.
export function daysAgo(n: number, now = new Date()): string {
  const d = new Date(now);
  d.setUTCDate(d.getUTCDate() - n);
  return d.toISOString().slice(0, 10);
}

// A date input value ("2026-10-09") as the RFC 3339 timestamp the API expects.
export const toRFC3339 = (date: string): string => new Date(date).toISOString();

export function exportUrl(root: string | undefined, type: string, since: string): string | null {
  if (!since) return null;
  return apiUrl(
    root,
    `/api/maintenance/analytics/${type}/export?since=${encodeURIComponent(toRFC3339(since))}`,
  );
}
