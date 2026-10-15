import { queryOptions } from '@tanstack/react-query';
import { apiFetch } from './api';
import type { AppUser } from './permissions';

export interface UpdateInfo {
  update: { is_new: boolean; release_version: string; release_date: string; url: string };
  messages: { title: string; description: string; url: string; priority: string }[];
}

export interface PermissionGroup {
  group: string;
  permissions: string[];
}

export interface PublicSubscription {
  enabled: boolean;
  captcha_enabled: boolean;
  captcha_provider: string | null;
  captcha_key: string | null;
  redirect_urls: string[] | null;
}

export interface ServerConfig {
  root_url: string;
  lang: string;
  version: string;
  messengers: string[];
  permissions: PermissionGroup[];
  public_subscription: PublicSubscription;
  needs_restart: boolean;
  has_legacy_user: boolean;
  update: UpdateInfo | null;
  [k: string]: unknown;
}

export interface Bootstrap {
  config: ServerConfig;
  user: AppUser;
  messages: Record<string, string>;
}

export async function loadBootstrap(fetchJson: typeof apiFetch = apiFetch): Promise<Bootstrap> {
  const [config, user] = await Promise.all([
    fetchJson<ServerConfig>('/api/config'),
    fetchJson<AppUser>('/api/profile'),
  ]);
  const messages = await fetchJson<Record<string, string>>(`/api/lang/${config.lang}`);
  return { config, user, messages };
}

export const bootstrapQuery = queryOptions({
  queryKey: ['bootstrap'],
  queryFn: () => loadBootstrap(),
  staleTime: Infinity,
  retry: false,
});
