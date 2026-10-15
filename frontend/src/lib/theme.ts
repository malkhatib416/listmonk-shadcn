export type Theme = 'light' | 'dark' | 'system';

export const THEME_KEY = 'theme';

export interface ThemeRoot {
  classList: { toggle(token: string, force?: boolean): boolean };
  style: { colorScheme: string };
}

// Reading window.localStorage itself can throw (SecurityError when site data is
// blocked), so the property access has to happen inside the try.
export function getLocalStorage(win: { localStorage: Storage }): Storage | null {
  try {
    return win.localStorage;
  } catch {
    return null;
  }
}

// Same storage contract as the old admin: "light" | "dark", key absent = system.
export function readStoredTheme(storage: Pick<Storage, 'getItem'> | null): Theme {
  try {
    const v = storage?.getItem(THEME_KEY);
    return v === 'light' || v === 'dark' ? v : 'system';
  } catch {
    return 'system';
  }
}

export function storeTheme(
  storage: Pick<Storage, 'setItem' | 'removeItem'> | null,
  theme: Theme,
): void {
  try {
    if (theme === 'system') storage?.removeItem(THEME_KEY);
    else storage?.setItem(THEME_KEY, theme);
  } catch {
    // Storage blocked: the theme still applies for this page load.
  }
}

export function applyTheme(
  theme: Theme,
  root: ThemeRoot,
  systemPrefersDark: boolean,
): 'light' | 'dark' {
  const resolved = theme === 'system' ? (systemPrefersDark ? 'dark' : 'light') : theme;
  root.classList.toggle('dark', resolved === 'dark');
  root.style.colorScheme = resolved;
  return resolved;
}

// Inlined in <head> so the theme is set before first paint. Keep dependency-free:
// it runs as a plain script, not as part of the bundle.
export const themeInitScript = `(function(){try{var t=localStorage.getItem('${THEME_KEY}');var d=t==='dark'||(t!=='light'&&matchMedia('(prefers-color-scheme: dark)').matches);var r=document.documentElement;r.classList.toggle('dark',d);r.style.colorScheme=d?'dark':'light'}catch(e){}})()`;
