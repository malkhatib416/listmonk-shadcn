import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { applyTheme, readStoredTheme, storeTheme, type Theme } from '@/lib/theme';

interface ThemeContextValue {
  theme: Theme;
  setTheme: (theme: Theme) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

const DARK_QUERY = '(prefers-color-scheme: dark)';

export function ThemeProvider({ children }: { children: ReactNode }) {
  // Lazy init so the first effect applies the stored theme, not a "system" flash.
  const [theme, setThemeState] = useState<Theme>(() =>
    typeof window === 'undefined' ? 'system' : readStoredTheme(window.localStorage),
  );

  useEffect(() => {
    const mq = window.matchMedia(DARK_QUERY);
    applyTheme(theme, document.documentElement, mq.matches);
    if (theme !== 'system') return;
    const onChange = () => applyTheme('system', document.documentElement, mq.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, [theme]);

  const setTheme = useCallback((next: Theme) => {
    storeTheme(window.localStorage, next);
    setThemeState(next);
  }, []);

  return <ThemeContext.Provider value={{ theme, setTheme }}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used inside <ThemeProvider>');
  return ctx;
}
