import { describe, expect, test } from 'bun:test';
import {
  canUpload,
  importParams,
  isDone,
  isRunning,
  progress,
  statusAfterModeChange,
  type ImportForm,
} from './import';

const form = (over: Partial<ImportForm> = {}): ImportForm => ({
  mode: 'subscribe',
  subStatus: 'unconfirmed',
  delim: ',',
  lists: [1],
  overwriteUserInfo: false,
  overwriteSubStatus: false,
  file: new File(['a'], 'a.csv'),
  ...over,
});

describe('canUpload', () => {
  test('needs a file', () => expect(canUpload(form({ file: null }))).toBe(false));
  test('subscribe needs at least one list', () => {
    expect(canUpload(form({ lists: [] }))).toBe(false);
    expect(canUpload(form())).toBe(true);
  });
  test('blocklist does not need lists', () =>
    expect(canUpload(form({ mode: 'blocklist', lists: [] }))).toBe(true));
  test('a delimiter of exactly one character', () => {
    expect(canUpload(form({ delim: '' }))).toBe(false);
    expect(canUpload(form({ delim: ';' }))).toBe(true);
  });
});

describe('statusAfterModeChange', () => {
  test('subscribe defaults to unconfirmed, blocklist to unsubscribed', () => {
    expect(statusAfterModeChange('subscribe')).toBe('unconfirmed');
    expect(statusAfterModeChange('blocklist')).toBe('unsubscribed');
  });
});

describe('importParams', () => {
  test('maps the form to the API params', () => {
    expect(importParams(form({ overwriteUserInfo: true, lists: [2, 3] }))).toEqual({
      mode: 'subscribe',
      subscription_status: 'unconfirmed',
      delim: ',',
      lists: [2, 3],
      overwrite_userinfo: true,
      overwrite_subscription_status: false,
    });
  });
});

describe('status helpers', () => {
  test('progress is a rounded-up percentage, 0 without a total', () => {
    expect(progress({ status: 'importing', imported: 1, total: 3 })).toBe(34);
    expect(progress({ status: 'importing', imported: 0, total: 0 })).toBe(0);
    expect(progress({ status: 'finished', imported: 5, total: 5 })).toBe(100);
  });
  test('running and done', () => {
    expect(isRunning({ status: 'importing', imported: 0, total: 0 })).toBe(true);
    expect(isRunning({ status: 'stopping', imported: 0, total: 0 })).toBe(true);
    expect(isDone({ status: 'finished', imported: 0, total: 0 })).toBe(true);
    expect(isDone({ status: 'failed', imported: 0, total: 0 })).toBe(true);
    expect(isDone({ status: 'none', imported: 0, total: 0 })).toBe(false);
  });
});
