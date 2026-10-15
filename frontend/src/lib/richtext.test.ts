import { describe, expect, test } from 'bun:test';
import { blockFromPath, buildLinkHref, imageAttrs, splitLinkHref, tableHtml } from './richtext';

describe('link tracking', () => {
  test('a tracked href is split into the url and a flag', () => {
    expect(splitLinkHref('https://a.b/c@TrackLink')).toEqual({ url: 'https://a.b/c', track: true });
    expect(splitLinkHref('https://a.b/c')).toEqual({ url: 'https://a.b/c', track: false });
    expect(splitLinkHref(null)).toEqual({ url: '', track: false });
  });

  test('only http(s) links get the tracking suffix', () => {
    expect(buildLinkHref('https://a.b', true)).toBe('https://a.b@TrackLink');
    expect(buildLinkHref('HTTP://a.b', true)).toBe('HTTP://a.b@TrackLink');
    expect(buildLinkHref('mailto:a@b.c', true)).toBe('mailto:a@b.c');
    expect(buildLinkHref('{{ TrackLink "https://a.b" }}', true)).toBe(
      '{{ TrackLink "https://a.b" }}',
    );
    expect(buildLinkHref(' https://a.b ', false)).toBe('https://a.b');
  });
});

describe('imageAttrs', () => {
  test('empty values are dropped', () => {
    expect(imageAttrs({ alt: '', width: '', height: '', float: '', embed: false })).toEqual({});
  });

  test('all values map to attributes', () => {
    expect(
      imageAttrs({ alt: ' x ', width: '10', height: '20', float: 'img-float-left', embed: true }),
    ).toEqual({
      alt: 'x',
      width: '10',
      height: '20',
      class: 'img-float-left',
      'data-embed': 'true',
    });
  });
});

describe('blockFromPath', () => {
  test('finds the innermost heading, quote or code block', () => {
    expect(blockFromPath('BODY>H2')).toBe('H2');
    expect(blockFromPath('BODY>BLOCKQUOTE>P')).toBe('BLOCKQUOTE');
    expect(blockFromPath('BODY>PRE')).toBe('PRE');
    expect(blockFromPath('BODY>P')).toBe('P');
    expect(blockFromPath('')).toBe('P');
  });
});

describe('tableHtml', () => {
  test('builds a header row and body rows', () => {
    const h = tableHtml(2, 3);
    expect(h.match(/<th>/g)).toHaveLength(3);
    expect(h.match(/<td>/g)).toHaveLength(3);
    expect(h.match(/<tr>/g)).toHaveLength(2);
  });
});
