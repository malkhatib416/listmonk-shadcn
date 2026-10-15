import { queryOptions } from '@tanstack/react-query';
import { apiFetch } from './api';
import type { PageResults } from './paging';

export interface FormList {
  uuid: string;
  name: string;
  description: string;
}

export interface Captcha {
  enabled: boolean;
  provider?: string | null;
  key?: string | null;
}

export function escapeAttr(v: string): string {
  return v
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// The HTML snippet to embed a subscription form for the selected lists.
export function formHtml(o: {
  lists: FormList[];
  selected: string[];
  redirect: string;
  rootUrl: string;
  captcha: Captcha;
  t: (key: string) => string;
}): string {
  if (o.selected.length === 0) return '';
  const { rootUrl: root, t } = o;
  // Built from pieces so this file can be embedded in a <script> without closing it.
  const script = 'script';

  let h =
    `<form method="post" action="${root}/subscription/form" class="listmonk-form">\n` +
    '  <div>\n' +
    `    <h3>${t('public.sub')}</h3>\n` +
    '    <input type="hidden" name="nonce" />\n';
  if (o.redirect)
    h += `    <input type="hidden" name="next" value="${escapeAttr(o.redirect)}" />\n`;
  h +=
    '\n' +
    `    <p><input type="email" name="email" required placeholder="${t('subscribers.email')}" /></p>\n` +
    `    <p><input type="text" name="name" placeholder="${t('public.subName')}" /></p>\n\n`;

  for (const uuid of o.selected) {
    const l = o.lists.find((x) => x.uuid === uuid);
    if (!l) continue;
    const id = l.uuid.slice(0, 5);
    h +=
      '    <p>\n' +
      `      <input id="${id}" type="checkbox" name="l" checked value="${l.uuid}" />\n` +
      `      <label for="${id}">${l.name}</label>\n`;
    if (l.description) h += `      <br />\n      <span>${l.description}</span>\n`;
    h += '    </p>\n';
  }

  if (o.captcha.enabled) {
    if (o.captcha.provider === 'altcha') {
      h +=
        '\n' +
        `    <altcha-widget challengeurl="${root}/api/public/captcha/altcha"></altcha-widget>\n` +
        `    <${script} type="module" src="${root}/public/static/altcha.umd.js" async defer></${script}>\n`;
    } else if (o.captcha.provider === 'hcaptcha') {
      h +=
        '\n' +
        `    <div class="h-captcha" data-sitekey="${o.captcha.key}"></div>\n` +
        `    <${script} src="https://js.hcaptcha.com/1/api.js" async defer></${script}>\n`;
    }
  }

  h += `\n    <input type="submit" value="${t('public.sub')} " />\n  </div>\n</form>`;
  return h;
}

export const publicListsQuery = queryOptions({
  queryKey: ['lists', 'public'],
  queryFn: async () =>
    (await apiFetch<PageResults<FormList>>('/api/lists?type=public&per_page=all')).results ?? [],
});
