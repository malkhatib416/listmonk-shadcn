import { describe, expect, test } from 'bun:test';
import { renderBuiltUrl } from './build-url';

describe('renderBuiltUrl', () => {
  test('JS-resolved URLs use the runtime root path', () => {
    const out = renderBuiltUrl('assets/chunk-abc.js', { hostType: 'js', ssr: false });
    expect(out).toEqual({
      runtime: `(window._LM_ROOT||'')+"/admin/app/"+"assets/chunk-abc.js"`,
    });
  });
  test('SSR keeps the default (no window on the server)', () => {
    expect(renderBuiltUrl('assets/chunk-abc.js', { hostType: 'js', ssr: true })).toBeUndefined();
  });
  test('CSS URLs (fonts, images) are relative to the stylesheet so they follow the root path', () => {
    expect(renderBuiltUrl('assets/Geist-abc.woff2', { hostType: 'css', ssr: false })).toEqual({
      relative: true,
    });
  });
  test('HTML URLs keep the default (Go rewrites the shell)', () => {
    expect(renderBuiltUrl('assets/app.css', { hostType: 'html', ssr: false })).toBeUndefined();
  });
});
