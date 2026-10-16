// URL search params as plain `key=value&key=value`: a repeated key is an array
// (`?tag=a&tag=b`). TanStack Router's default JSON encoding would write arrays as
// `tag=["a","b"]`, which is not a URL anyone would type and not what the API takes.
// Values stay strings; each route's zod schema coerces what it needs.
export function parseSearch(searchStr: string): Record<string, string | string[]> {
  const q = new URLSearchParams(searchStr);
  const out: Record<string, string | string[]> = {};
  for (const key of new Set(q.keys())) {
    const all = q.getAll(key);
    out[key] = all.length > 1 ? all : all[0]!;
  }
  return out;
}

export function stringifySearch(obj: Record<string, unknown>): string {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(obj)) {
    if (v === undefined || v === null || v === '') continue;
    for (const x of Array.isArray(v) ? v : [v]) {
      q.append(k, typeof x === 'object' ? JSON.stringify(x) : String(x));
    }
  }
  const s = q.toString();
  return s ? `?${s}` : '';
}
