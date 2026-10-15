export type Translate = ((key: string, params?: Record<string, string | number>) => string) & {
  // "Singular | Plural": plural when n > 1 (same as Go's Tc).
  tc: (key: string, n: number) => string;
};

const RE_PARAM = /\{(\w+)\}/g;
const RE_REF = /\{([a-z0-9.-]+)\}/gi;

export function createT(dict: Record<string, string>): Translate {
  const singular = (s: string) => (s.includes('|') ? s.split('|')[0]!.trim() : s);
  const plural = (s: string) => {
    if (!s.includes('|')) return s;
    const parts = s.split('|');
    return (parts.length === 2 ? parts[1]! : parts[0]!).trim();
  };

  const t = (key: string, params?: Record<string, string | number>): string => {
    const raw = dict[key];
    if (raw === undefined) return key;
    const s = singular(raw);
    if (!params) return s;
    return s.replace(RE_PARAM, (m, name: string) => {
      if (!(name in params)) return m;
      // Like Go's Ts(): "{some.key}" inside a param value resolves to that translation.
      return String(params[name]).replace(RE_REF, (r, ref: string) =>
        ref in dict ? singular(dict[ref]!) : r,
      );
    });
  };

  const tc = (key: string, n: number): string => {
    const raw = dict[key];
    if (raw === undefined) return key;
    return n > 1 ? plural(raw) : singular(raw);
  };

  return Object.assign(t, { tc });
}
