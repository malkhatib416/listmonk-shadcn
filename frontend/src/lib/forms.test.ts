import { describe, expect, test } from 'bun:test';
import { escapeAttr, formHtml, type FormList } from './forms';

const lists: FormList[] = [
  { uuid: 'aaaaa-1111', name: 'News', description: '' },
  { uuid: 'bbbbb-2222', name: 'Deals & offers', description: 'Weekly <b>deals</b>' },
];
const t = (k: string) =>
  ({ 'public.sub': 'Subscribe', 'public.subName': 'Name', 'subscribers.email': 'E-mail' })[k] ?? k;
const base = { rootUrl: 'https://mail.example.com', captcha: { enabled: false } as const, t };

describe('escapeAttr', () => {
  test('escapes the five HTML special characters', () => {
    expect(escapeAttr(`a&b<c>"d'e`)).toBe('a&amp;b&lt;c&gt;&quot;d&#39;e');
  });
});

describe('formHtml', () => {
  test('nothing selected, nothing generated', () => {
    expect(formHtml({ ...base, lists, selected: [], redirect: '' })).toBe('');
  });

  test('posts to the public form with a checkbox per selected list', () => {
    const h = formHtml({ ...base, lists, selected: ['aaaaa-1111'], redirect: '' });
    expect(h).toContain(
      '<form method="post" action="https://mail.example.com/subscription/form" class="listmonk-form">',
    );
    expect(h).toContain('<input type="hidden" name="nonce" />');
    expect(h).toContain('<input id="aaaaa" type="checkbox" name="l" checked value="aaaaa-1111" />');
    expect(h).toContain('<label for="aaaaa">News</label>');
    expect(h).not.toContain('bbbbb-2222');
    expect(h).not.toContain('name="next"');
  });

  test('selected lists appear in the order picked, with their description', () => {
    const h = formHtml({ ...base, lists, selected: ['bbbbb-2222', 'aaaaa-1111'], redirect: '' });
    expect(h.indexOf('bbbbb-2222')).toBeLessThan(h.indexOf('aaaaa-1111'));
    expect(h).toContain('<span>Weekly <b>deals</b></span>');
  });

  test('a redirect URL is escaped into a hidden "next" field', () => {
    const h = formHtml({
      ...base,
      lists,
      selected: ['aaaaa-1111'],
      redirect: 'https://x.test/?a=1&b="2"',
    });
    expect(h).toContain(
      '<input type="hidden" name="next" value="https://x.test/?a=1&amp;b=&quot;2&quot;" />',
    );
  });

  test('an unknown selected uuid is ignored', () => {
    const h = formHtml({ ...base, lists, selected: ['zzz'], redirect: '' });
    expect(h).not.toContain('type="checkbox"');
  });

  test('altcha and hcaptcha add their widgets', () => {
    const alt = formHtml({
      ...base,
      lists,
      selected: ['aaaaa-1111'],
      redirect: '',
      captcha: { enabled: true, provider: 'altcha' },
    });
    expect(alt).toContain(
      '<altcha-widget challengeurl="https://mail.example.com/api/public/captcha/altcha"></altcha-widget>',
    );
    expect(alt).toContain('src="https://mail.example.com/public/static/altcha.umd.js"');
    const hc = formHtml({
      ...base,
      lists,
      selected: ['aaaaa-1111'],
      redirect: '',
      captcha: { enabled: true, provider: 'hcaptcha', key: 'K1' },
    });
    expect(hc).toContain('<div class="h-captcha" data-sitekey="K1"></div>');
    expect(hc).toContain('https://js.hcaptcha.com/1/api.js');
  });

  test('uses the translated labels', () => {
    const h = formHtml({ ...base, lists, selected: ['aaaaa-1111'], redirect: '' });
    expect(h).toContain('<h3>Subscribe</h3>');
    expect(h).toContain('placeholder="E-mail"');
    expect(h).toContain('placeholder="Name"');
    expect(h).toContain('<input type="submit" value="Subscribe " />');
  });
});
