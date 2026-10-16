import { describe, expect, test } from 'bun:test';
import { isErrorLine, parseLogLine, parseLogLines } from './logs';

describe('parseLogLine', () => {
  test('splits timestamp, file and message', () => {
    expect(
      parseLogLine('2021/05/01 00:00:00.123456 init.go:99: reading config: config.toml'),
    ).toEqual({
      timestamp: '2021/05/01 00:00:00.123456',
      file: 'init.go:99',
      message: 'reading config: config.toml',
    });
  });

  test('"*" as the file', () => {
    expect(parseLogLine('2021/05/01 00:00:00.123456 *: hello').file).toBe('*');
  });

  test('a line that does not match is kept whole as the message', () => {
    expect(parseLogLine('panic: something odd')).toEqual({
      timestamp: '',
      file: '',
      message: 'panic: something odd',
    });
  });
});

describe('parseLogLines', () => {
  test('drops empty lines', () => {
    expect(parseLogLines(['', 'a', ''])).toHaveLength(1);
  });
  test('empty input', () => expect(parseLogLines([])).toEqual([]));
});

describe('isErrorLine', () => {
  test('flags messages containing "error"', () => {
    expect(isErrorLine({ timestamp: '', file: '', message: 'error sending' })).toBe(true);
    expect(isErrorLine({ timestamp: '', file: '', message: 'all fine' })).toBe(false);
  });
});
