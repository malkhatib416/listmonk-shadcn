import { describe, expect, test } from 'bun:test';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

// Every literal translation key used in the app must exist in the English language file,
// otherwise the UI would show a raw key.
const EN: Record<string, string> = JSON.parse(
  readFileSync(join(import.meta.dir, '../../i18n/en.json'), 'utf8'),
);

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    if (statSync(p).isDirectory()) return f === 'ui' ? [] : files(p);
    return /\.(ts|tsx)$/.test(f) && !f.endsWith('.test.ts') && !f.endsWith('.gen.ts') ? [p] : [];
  });
}

// t('a.b'), t.tc('a.b', n), label: 'a.b' in nav.ts
const RE_CALL = /\bt(?:\.tc)?\(\s*'([a-z][A-Za-z0-9]*(?:\.[A-Za-z0-9-]+)+)'/g;
const RE_NAV = /\b(?:label|item\([^,]+,)\s*'([a-z][A-Za-z0-9]*(?:\.[A-Za-z0-9-]+)+)'/g;

describe('i18n keys', () => {
  test('every key used in src exists in i18n/en.json', () => {
    const missing: string[] = [];
    for (const f of files(join(import.meta.dir))) {
      const src = readFileSync(f, 'utf8');
      for (const re of [RE_CALL, RE_NAV]) {
        for (const m of src.matchAll(re)) {
          if (!((m[1] as string) in EN)) missing.push(`${f.split('/src/')[1]}: ${m[1]}`);
        }
      }
    }
    expect(missing).toEqual([]);
  });
});
