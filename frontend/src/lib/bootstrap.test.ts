import { describe, expect, test } from 'bun:test';
import { loadBootstrap } from './bootstrap';

function fakeFetch(map: Record<string, unknown>, calls: string[] = []) {
  return (async (path: string) => {
    calls.push(path);
    if (!(path in map)) throw new Error(`unexpected ${path}`);
    const v = map[path];
    if (v instanceof Error) throw v;
    return v;
  }) as never;
}

describe('loadBootstrap', () => {
  test('combines config, profile and the configured language', async () => {
    const calls: string[] = [];
    const out = await loadBootstrap(
      fakeFetch(
        {
          '/api/config': { lang: 'fr', version: 'v1' },
          '/api/profile': { id: 1, username: 'a' },
          '/api/lang/fr': { 'logs.title': 'Journaux' },
        },
        calls,
      ),
    );
    expect(out.config.lang).toBe('fr');
    expect(out.user.username).toBe('a');
    expect(out.messages['logs.title']).toBe('Journaux');
    expect(calls.slice(0, 2).sort()).toEqual(['/api/config', '/api/profile']);
    expect(calls[2]).toBe('/api/lang/fr');
  });

  test('a failed call rejects the whole bootstrap', async () => {
    await expect(
      loadBootstrap(
        fakeFetch({
          '/api/config': new Error('down'),
          '/api/profile': { id: 1 },
        }),
      ),
    ).rejects.toThrow('down');
  });
});
