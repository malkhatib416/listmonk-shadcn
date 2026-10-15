export type Translate = (key: string, params?: Record<string, string | number>) => string;

export function createT(dict: Record<string, string>): Translate {
  return (key, params) => {
    const s = dict[key];
    if (s === undefined) return key;
    if (!params) return s;
    return s.replace(/\{(\w+)\}/g, (m, name: string) =>
      name in params ? String(params[name]) : m,
    );
  };
}
