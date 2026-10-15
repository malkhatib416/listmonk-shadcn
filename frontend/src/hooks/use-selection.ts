import { useState } from 'react';
import type { RowId } from '@/components/data-table';

const EMPTY: Set<RowId> = new Set();

// Row selection that starts over whenever `resetKey` changes (a new page, sort or filter),
// plus the "select all N matching the filters" flag used by bulk actions.
export function useSelection(resetKey: string) {
  const [state, setState] = useState({ key: resetKey, selected: EMPTY, allMatching: false });
  const current =
    state.key === resetKey ? state : { key: resetKey, selected: EMPTY, allMatching: false };

  return {
    selected: current.selected,
    allMatching: current.allMatching,
    setSelected: (selected: Set<RowId>) =>
      setState({ key: resetKey, selected, allMatching: false }),
    selectAllMatching: () => setState({ ...current, allMatching: true }),
    clear: () => setState({ key: resetKey, selected: EMPTY, allMatching: false }),
  };
}
