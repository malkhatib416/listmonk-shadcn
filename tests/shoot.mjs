import { chromium } from '@playwright/test';
const base = 'http://localhost:9000';
const browser = await chromium.launch();
let id;
const pages = [
  ['dashboard', '/admin'],
  ['campaigns', '/admin/campaigns'],
  ['campaign-content', '/admin/campaigns/ID#tab=content'],
  ['campaign-form', '/admin/campaigns/ID'],
  ['settings-general', '/admin/settings'],
  ['settings-smtp', '/admin/settings#tab=smtp'],
];
for (const scheme of ['light', 'dark']) {
  for (const [w, h] of [[1440, 900], [375, 812]]) {
    const ctx = await browser.newContext({ viewport: { width: w, height: h }, colorScheme: scheme });
    const page = await ctx.newPage();
    await page.goto(`${base}/admin/login`);
    await page.fill('#username', 'admin'); await page.fill('#password', 'listmonk');
    await page.click('button[type=submit]');
    await page.waitForURL('**/admin**');
    id = (await (await page.request.get(`${base}/api/campaigns`)).json()).data.results[0].id;
    for (const [name, url] of pages) {
      await page.goto(base + url.replace('ID', id));
      await page.waitForTimeout(1800);
      await page.screenshot({ path: `shots/${name}-${scheme}-${w}.png` });
    }
    await ctx.close();
  }
}
await browser.close();
