import { describe, expect, test } from 'bun:test';
import { adminPrefix, adminRewrite, hardHref } from './basepath';

const run = (prefix: string, dir: 'input' | 'output', path: string) => {
  const url = new URL(`http://x${path}`);
  const out = adminRewrite(prefix)[dir]({ url });
  return out.pathname + out.search + out.hash;
};

describe('adminPrefix', () => {
  test('no root path', () => {
    expect(adminPrefix(undefined)).toBe('/admin');
    expect(adminPrefix('')).toBe('/admin');
  });
  test('with root path', () => {
    expect(adminPrefix('/lm')).toBe('/lm/admin');
  });
});

describe('adminRewrite input (browser URL -> router URL)', () => {
  test('strips the prefix', () => {
    expect(run('/admin', 'input', '/admin/next')).toBe('/next');
    expect(run('/lm/admin', 'input', '/lm/admin/next?a=1#h')).toBe('/next?a=1#h');
  });
  test('the bare prefix is the router root', () => {
    expect(run('/admin', 'input', '/admin')).toBe('/');
    expect(run('/lm/admin', 'input', '/lm/admin')).toBe('/');
  });
  test('a sibling path that merely starts with the prefix is untouched', () => {
    expect(run('/admin', 'input', '/administrator')).toBe('/administrator');
  });
  test('paths outside the prefix are untouched (shell prerender requests "/")', () => {
    expect(run('/admin', 'input', '/')).toBe('/');
  });
});

describe('adminRewrite output (router URL -> browser URL)', () => {
  test('adds the prefix', () => {
    expect(run('/admin', 'output', '/next')).toBe('/admin/next');
    expect(run('/lm/admin', 'output', '/next?a=1#h')).toBe('/lm/admin/next?a=1#h');
  });
  test('root maps to the bare prefix', () => {
    expect(run('/admin', 'output', '/')).toBe('/admin');
    expect(run('/lm/admin', 'output', '/')).toBe('/lm/admin');
  });
});

describe('hardHref', () => {
  test('prefixes the root path', () => {
    expect(hardHref('/lm', '/admin/lists')).toBe('/lm/admin/lists');
    expect(hardHref('', '/admin/lists')).toBe('/admin/lists');
    expect(hardHref(undefined, '/admin/lists')).toBe('/admin/lists');
  });
});
