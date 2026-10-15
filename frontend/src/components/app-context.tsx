import { createContext, useContext, useMemo, type ReactNode } from 'react';
import type { Bootstrap } from '@/lib/bootstrap';
import { createT, type Translate } from '@/lib/i18n';
import { can } from '@/lib/permissions';

interface AppValue extends Bootstrap {
  t: Translate;
}

const AppContext = createContext<AppValue | null>(null);

export function AppProvider({ value, children }: { value: Bootstrap; children: ReactNode }) {
  const v = useMemo(() => ({ ...value, t: createT(value.messages) }), [value]);
  return <AppContext.Provider value={v}>{children}</AppContext.Provider>;
}

function useAppValue(): AppValue {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used inside <AppProvider>');
  return ctx;
}

export const useApp = (): Bootstrap => useAppValue();
export const useT = (): Translate => useAppValue().t;
export function useCan(): (...perms: string[]) => boolean {
  const { user } = useAppValue();
  return (...perms) => can(user, ...perms);
}
