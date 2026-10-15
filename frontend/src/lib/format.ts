const DASH = '—';

function parse(iso: string | null | undefined): Date | null {
  if (!iso) return null;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d;
}

// "16 Oct 2026"
export function formatDate(
  iso: string | null | undefined,
  locale = 'en-GB',
  timeZone?: string,
): string {
  const d = parse(iso);
  if (!d) return DASH;
  return d.toLocaleDateString(locale === 'en' ? 'en-GB' : locale, {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    timeZone,
  });
}

// "16 Oct 2026, 09:05"
export function formatDateTime(
  iso: string | null | undefined,
  locale = 'en-GB',
  timeZone?: string,
): string {
  const d = parse(iso);
  if (!d) return DASH;
  const loc = locale === 'en' ? 'en-GB' : locale;
  const date = d.toLocaleDateString(loc, {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    timeZone,
  });
  const time = d.toLocaleTimeString(loc, {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone,
  });
  return `${date}, ${time}`;
}
