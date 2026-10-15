export interface BulkSelection {
  ids: (number | string)[];
  // True when the user chose "select all N matching": the server applies the filters.
  allMatching: boolean;
}

// The query string for a bulk API call (delete / blocklist...).
export function bulkQuery(
  sel: BulkSelection,
  filters: Record<string, string | number | undefined> = {},
): URLSearchParams {
  const q = new URLSearchParams();
  if (sel.allMatching) {
    q.set('all', 'true');
    for (const [k, v] of Object.entries(filters))
      if (v !== undefined && v !== '') q.set(k, String(v));
  } else {
    for (const id of sel.ids) q.append('id', String(id));
  }
  return q;
}
