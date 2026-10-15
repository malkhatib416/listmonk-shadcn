import { describe, expect, test } from 'bun:test';
import { applyTheme, readStoredTheme, storeTheme, themeInitScript, type ThemeRoot } from './theme';

function fakeRoot() {
  const classes = new Set<string>();
  const root: ThemeRoot & { has(c: string): boolean } = {
    classList: {
      toggle(token, force) {
        const on = force ?? !classes.has(token);
        if (on) classes.add(token);
        else classes.delete(token);
        return on;
      },
    },
    style: { colorScheme: '' },
    has: (c) => classes.has(c),
  };
  return root;
}

function memoryStorage(initial: Record<string, string> = {}) {
  const data = { ...initial };
  return {
    data,
    getItem: (k: string) => data[k] ?? null,
    setItem: (k: string, v: string) => void (data[k] = v),
    removeItem: (k: string) => void delete data[k],
  };
}

const throwingStorage = {
  getItem: () => {
    throw new Error('blocked');
  },
  setItem: () => {
    throw new Error('blocked');
  },
  removeItem: () => {
    throw new Error('blocked');
  },
};

describe('readStoredTheme', () => {
  test('returns stored light/dark', () => {
    expect(readStoredTheme(memoryStorage({ theme: 'dark' }))).toBe('dark');
    expect(readStoredTheme(memoryStorage({ theme: 'light' }))).toBe('light');
  });
  test('missing or junk value means system', () => {
    expect(readStoredTheme(memoryStorage())).toBe('system');
    expect(readStoredTheme(memoryStorage({ theme: 'purple' }))).toBe('system');
  });
  test('blocked storage means system, no throw', () => {
    expect(readStoredTheme(throwingStorage)).toBe('system');
  });
});

describe('storeTheme', () => {
  test('stores light/dark and removes key for system', () => {
    const s = memoryStorage();
    storeTheme(s, 'dark');
    expect(s.data.theme).toBe('dark');
    storeTheme(s, 'system');
    expect('theme' in s.data).toBe(false);
  });
  test('blocked storage does not throw', () => {
    expect(() => storeTheme(throwingStorage, 'dark')).not.toThrow();
  });
});

describe('applyTheme', () => {
  test('dark sets class and color-scheme', () => {
    const r = fakeRoot();
    expect(applyTheme('dark', r, false)).toBe('dark');
    expect(r.has('dark')).toBe(true);
    expect(r.style.colorScheme).toBe('dark');
  });
  test('light clears class even if system prefers dark', () => {
    const r = fakeRoot();
    r.classList.toggle('dark', true);
    expect(applyTheme('light', r, true)).toBe('light');
    expect(r.has('dark')).toBe(false);
    expect(r.style.colorScheme).toBe('light');
  });
  test('system follows the OS preference, including a flip', () => {
    const r = fakeRoot();
    expect(applyTheme('system', r, true)).toBe('dark');
    expect(r.has('dark')).toBe(true);
    expect(applyTheme('system', r, false)).toBe('light');
    expect(r.has('dark')).toBe(false);
  });
});

describe('themeInitScript', () => {
  function run(stored: string | null, prefersDark: boolean, storageThrows = false) {
    const r = fakeRoot();
    const doc = { documentElement: r };
    const ls = {
      getItem: () => {
        if (storageThrows) throw new Error('blocked');
        return stored;
      },
    };
    const mm = () => ({ matches: prefersDark });
    new Function('localStorage', 'matchMedia', 'document', themeInitScript)(ls, mm, doc);
    return r;
  }
  test('stored dark applies dark', () => {
    expect(run('dark', false).has('dark')).toBe(true);
  });
  test('stored light beats a dark OS', () => {
    expect(run('light', true).has('dark')).toBe(false);
  });
  test('nothing stored follows the OS', () => {
    expect(run(null, true).has('dark')).toBe(true);
    expect(run(null, false).has('dark')).toBe(false);
  });
  test('junk value follows the OS', () => {
    expect(run('purple', true).has('dark')).toBe(true);
  });
  test('blocked storage does not throw', () => {
    expect(() => run(null, true, true)).not.toThrow();
  });
});
