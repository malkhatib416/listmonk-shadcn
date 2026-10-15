import type { ServerConfig } from './bootstrap';

export type Notice =
  | { kind: 'restart' }
  | { kind: 'update'; version: string; url: string }
  | { kind: 'message'; title: string; description: string; url: string; high: boolean }
  | { kind: 'legacy-user' };

// "2026-01-02" -> "02 Jan 2026"; anything unparseable -> "".
function formatDate(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`);
  return Number.isNaN(d.getTime())
    ? ''
    : d.toLocaleDateString('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        timeZone: 'UTC',
      });
}

// The banners the old admin showed above every page, in the same order.
export function buildNotices(config: ServerConfig): Notice[] {
  const out: Notice[] = [];
  if (config.needs_restart) out.push({ kind: 'restart' });

  const u = config.update;
  if (u?.update.is_new) {
    const date = formatDate(u.update.release_date);
    const version = date ? `${u.update.release_version} (${date})` : u.update.release_version;
    out.push({ kind: 'update', version, url: u.update.url });
  }
  for (const m of u?.messages ?? []) {
    out.push({
      kind: 'message',
      title: m.title,
      description: m.description,
      url: m.url,
      high: m.priority === 'high',
    });
  }

  if (config.has_legacy_user) out.push({ kind: 'legacy-user' });
  return out;
}
