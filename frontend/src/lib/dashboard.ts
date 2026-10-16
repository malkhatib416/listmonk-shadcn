import { queryOptions } from '@tanstack/react-query';
import { apiFetch } from './api';
import type { Campaign } from './campaigns';
import type { Tone } from '@/components/status-badge';
import type { TrendPoint } from '@/components/trend-chart';

export interface DashboardCounts {
  subscribers: { total: number; blocklisted: number; orphans: number };
  lists: { total: number; private: number; public: number };
  campaigns: { total: number; by_status: Record<string, number> };
  messages: number;
}

export interface DashboardCharts {
  campaign_views: TrendPoint[] | null;
  link_clicks: TrendPoint[] | null;
}

export interface SystemStats {
  uptime: string;
  num_cpu: number;
  app_mem_mb: number;
  has_host_mem: boolean;
  mem_used_mb: number;
  mem_total_mb: number;
  mem_pct: number;
  has_load: boolean;
  load_1: string;
  load_5: string;
  load_15: string;
  load_pct: number;
  cache_slow_queries: boolean;
}

// Colour of a usage meter: green below 70%, amber up to 90%, red above.
export const meterTone = (pct: number): Tone =>
  pct > 90 ? 'danger' : pct >= 70 ? 'warning' : 'success';

// Scheduled campaigns show when they go out; the rest show when they were created.
export const campaignDate = (c: Pick<Campaign, 'status' | 'send_at' | 'created_at'>): string =>
  c.status === 'scheduled' && c.send_at ? c.send_at : c.created_at;

export const dashboardCountsQuery = queryOptions({
  queryKey: ['dashboard', 'counts'],
  queryFn: () => apiFetch<DashboardCounts>('/api/dashboard/counts'),
});

export const dashboardChartsQuery = queryOptions({
  queryKey: ['dashboard', 'charts'],
  queryFn: () => apiFetch<DashboardCharts>('/api/dashboard/charts'),
});

export const dashboardCampaignsQuery = queryOptions({
  queryKey: ['dashboard', 'campaigns'],
  queryFn: () => apiFetch<Campaign[]>('/api/dashboard/campaigns'),
});

export const dashboardSystemQuery = queryOptions({
  queryKey: ['dashboard', 'system'],
  queryFn: () => apiFetch<SystemStats>('/api/dashboard/system'),
});
