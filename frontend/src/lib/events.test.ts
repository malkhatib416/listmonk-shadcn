import { describe, expect, test } from 'bun:test';
import { errorEventMessage } from './events';

describe('errorEventMessage', () => {
  test('strips the file.go:123: log prefix', () => {
    const data = JSON.stringify({ type: 'error', message: 'init.go:99: could not connect' });
    expect(errorEventMessage(data)).toBe('could not connect');
  });

  test('keeps a message without a log prefix', () => {
    expect(errorEventMessage(JSON.stringify({ type: 'error', message: 'plain' }))).toBe('plain');
  });

  test('ignores other event types, empty messages and junk', () => {
    expect(errorEventMessage(JSON.stringify({ type: 'info', message: 'x' }))).toBeNull();
    expect(errorEventMessage(JSON.stringify({ type: 'error', message: '' }))).toBeNull();
    expect(errorEventMessage('not json')).toBeNull();
    expect(errorEventMessage('null')).toBeNull();
  });
});
