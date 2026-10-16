import { describe, expect, test } from 'bun:test';
import { parseSearch, stringifySearch } from './search';

describe('parseSearch', () => {
  test('plain key=value pairs stay strings', () => {
    expect(parseSearch('?type=public&page=2')).toEqual({ type: 'public', page: '2' });
  });
  test('a repeated key becomes an array', () => {
    expect(parseSearch('?tag=a&tag=b&x=1')).toEqual({ tag: ['a', 'b'], x: '1' });
  });
  test('empty and leading-? forms', () => {
    expect(parseSearch('')).toEqual({});
    expect(parseSearch('?')).toEqual({});
    expect(parseSearch('type=a')).toEqual({ type: 'a' });
  });
});

describe('stringifySearch', () => {
  test('arrays become repeated params, undefined and empty are dropped', () => {
    expect(stringifySearch({ tag: ['a', 'b'], type: 'x', gone: undefined, blank: '' })).toBe(
      '?tag=a&tag=b&type=x',
    );
  });
  test('numbers and booleans', () => {
    expect(stringifySearch({ page: 2, all: true })).toBe('?page=2&all=true');
  });
  test('nothing to write', () => expect(stringifySearch({})).toBe(''));
  test('round trip keeps special characters', () => {
    const s = stringifySearch({ query: 'a&b c', tag: ['x y'] });
    expect(parseSearch(s)).toEqual({ query: 'a&b c', tag: 'x y' });
  });
});
