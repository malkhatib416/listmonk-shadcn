import { describe, expect, test } from 'bun:test';
import { buildNotices } from './notices';
import type { ServerConfig } from './bootstrap';

const config = (over: Partial<ServerConfig> = {}): ServerConfig => ({
  root_url: '',
  lang: 'en',
  version: 'v1',
  messengers: [],
  permissions: [],
  needs_restart: false,
  has_legacy_user: false,
  update: null,
  ...over,
});

describe('buildNotices', () => {
  test('nothing to show', () => expect(buildNotices(config())).toEqual([]));

  test('needs restart', () => {
    expect(buildNotices(config({ needs_restart: true }))).toEqual([{ kind: 'restart' }]);
  });

  test('legacy user', () => {
    expect(buildNotices(config({ has_legacy_user: true }))).toEqual([{ kind: 'legacy-user' }]);
  });

  test('a new release, with its date', () => {
    const update = {
      update: { is_new: true, release_version: 'v9.0.0', release_date: '2026-01-02', url: 'u' },
      messages: [],
    };
    expect(buildNotices(config({ update }))).toEqual([
      { kind: 'update', version: 'v9.0.0 (02 Jan 2026)', url: 'u' },
    ]);
  });

  test('a release without a parseable date shows the bare version', () => {
    const update = {
      update: { is_new: true, release_version: 'v9.0.0', release_date: '', url: 'u' },
      messages: [],
    };
    expect(buildNotices(config({ update }))).toEqual([
      { kind: 'update', version: 'v9.0.0', url: 'u' },
    ]);
  });

  test('not a new release is ignored, broadcast messages are kept', () => {
    const update = {
      update: { is_new: false, release_version: 'v1', release_date: '', url: '' },
      messages: [
        { title: 'Hi', description: 'd', url: '', priority: 'high' },
        { title: 'FYI', description: '', url: 'x', priority: 'low' },
      ],
    };
    expect(buildNotices(config({ update }))).toEqual([
      { kind: 'message', title: 'Hi', description: 'd', url: '', high: true },
      { kind: 'message', title: 'FYI', description: '', url: 'x', high: false },
    ]);
  });

  test('order: restart, update, messages, legacy user', () => {
    const update = {
      update: { is_new: true, release_version: 'v2', release_date: '', url: 'u' },
      messages: [{ title: 'm', description: '', url: '', priority: '' }],
    };
    const kinds = buildNotices(config({ needs_restart: true, has_legacy_user: true, update })).map(
      (n) => n.kind,
    );
    expect(kinds).toEqual(['restart', 'update', 'message', 'legacy-user']);
  });
});
