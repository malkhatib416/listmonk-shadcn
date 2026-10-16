export interface PageResults<T> {
  results: T[];
  total: number;
  per_page: number;
  page: number;
}

export const lastPage = (total: number, perPage: number): number =>
  perPage > 0 ? Math.max(1, Math.ceil(total / perPage)) : 1;

// Page numbers to render, with 'gap' standing in for skipped runs.
export function pageWindow(page: number, last: number): (number | 'gap')[] {
  if (last <= 5) return Array.from({ length: last }, (_, i) => i + 1);
  const keep = new Set([1, last, page - 1, page, page + 1].filter((p) => p >= 1 && p <= last));
  // Near the ends, show a run of three so the control does not jump around.
  if (page <= 2) [2, 3].forEach((p) => keep.add(p));
  if (page >= last - 1) [last - 2, last - 1].forEach((p) => keep.add(p));
  const sorted = [...keep].sort((a, b) => a - b);
  const out: (number | 'gap')[] = [];
  sorted.forEach((p, i) => {
    if (i > 0 && p - sorted[i - 1]! > 1) out.push('gap');
    out.push(p);
  });
  return out;
}

// "41-45 of 45"
export function rangeLabel(page: number, perPage: number, total: number) {
  if (total === 0) return { from: 0, to: 0, total };
  const from = (page - 1) * perPage + 1;
  return { from, to: Math.min(total, page * perPage), total };
}
