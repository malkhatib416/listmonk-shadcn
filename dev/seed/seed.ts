// Fills a dev listmonk with fake data. Run against a freshly installed instance:
//
//   cd dev/seed && bun install && bun seed.ts
//
// Env: LISTMONK_URL (http://localhost:9000), LISTMONK_USER/PASSWORD (admin/listmonk),
// SEED (number, for reproducible data), SEED_PSQL (command that reads SQL on stdin;
// default: docker exec into the dev compose db container).
import { faker } from '@faker-js/faker';

const URL_ = (process.env.LISTMONK_URL ?? 'http://localhost:9000').replace(/\/$/, '');
const USER = process.env.LISTMONK_USER ?? 'admin';
const PASS = process.env.LISTMONK_PASSWORD ?? 'listmonk';
const PSQL = process.env.SEED_PSQL ?? 'docker exec -i dev-db-1 psql -v ON_ERROR_STOP=1 -U listmonk-dev -d listmonk-dev';
if (process.env.SEED) faker.seed(Number(process.env.SEED));

let cookie = '';

async function login() {
  const res = await fetch(`${URL_}/admin/login`, {
    method: 'POST',
    redirect: 'manual',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ username: USER, password: PASS, next: '/admin' }),
  });
  const set = res.headers.getSetCookie().map((c) => c.split(';')[0]).join('; ');
  if (!set.includes('session=')) throw new Error(`login failed (${res.status}); is the instance up and installed?`);
  cookie = set;
}

async function api<T = any>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${URL_}${path}`, {
    method,
    headers: { Cookie: cookie, 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`${method} ${path} -> ${res.status} ${text.slice(0, 200)}`);
  return (JSON.parse(text) as { data: T }).data;
}

const pick = <T>(xs: T[]): T => faker.helpers.arrayElement(xs);
const sqlStr = (s: string) => `'${s.replaceAll("'", "''")}'`;

async function runSQL(sql: string) {
  const p = Bun.spawn(['sh', '-c', PSQL], { stdin: 'pipe', stdout: 'inherit', stderr: 'inherit' });
  p.stdin.write(sql);
  p.stdin.end();
  if ((await p.exited) !== 0) throw new Error('psql failed');
}

// ---- Lists -------------------------------------------------------------
const LIST_NAMES = [
  'Product updates', 'Weekly digest', 'Beta testers', 'Customers', 'Webinar attendees',
  'Newsletter', 'Press & partners', 'Open source contributors', 'Event invites', 'Churned users',
  'Trial users', 'Enterprise leads',
];

async function seedLists() {
  const ids: number[] = [];
  for (const [i, name] of LIST_NAMES.entries()) {
    const l = await api('POST', '/api/lists', {
      name,
      type: i % 4 === 3 ? 'private' : pick(['public', 'private']),
      optin: pick(['single', 'single', 'double']),
      tags: faker.helpers.arrayElements(['marketing', 'product', 'eu', 'us', 'vip', 'b2b', 'b2c'], { min: 0, max: 3 }),
      description: faker.lorem.sentence(),
      status: i === 9 ? 'archived' : 'active',
    });
    ids.push(l.id);
  }
  return ids;
}

// ---- Subscribers -------------------------------------------------------
async function seedSubscribers(listIDs: number[], n: number) {
  const used = new Set<string>();
  const ids: number[] = [];
  for (let i = 0; i < n; i += 1) {
    const first = faker.person.firstName();
    const last = faker.person.lastName();
    let email = faker.internet.email({ firstName: first, lastName: last }).toLowerCase();
    if (used.has(email)) email = `${i}.${email}`;
    used.add(email);
    try {
      const s = await api('POST', '/api/subscribers', {
        email,
        name: `${first} ${last}`,
        status: faker.helpers.weightedArrayElement([
          { weight: 90, value: 'enabled' },
          { weight: 10, value: 'blocklisted' },
        ]),
        lists: faker.helpers.arrayElements(listIDs, { min: 1, max: 4 }),
        preconfirm_subscriptions: faker.datatype.boolean(0.7),
        attribs: {
          city: faker.location.city(),
          country: faker.location.country(),
          plan: pick(['free', 'pro', 'team', 'enterprise']),
          company: faker.company.name(),
        },
      });
      ids.push(s.id);
    } catch (e) {
      console.warn(String(e));
    }
  }
  return ids;
}

// ---- Templates ---------------------------------------------------------
const TEMPLATE_BODY = (accent: string) => `<!doctype html>
<html><body style="margin:0;background:#f5f5f4;font-family:Helvetica,Arial,sans-serif">
<table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:32px 16px">
<table width="600" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:12px;border:1px solid #e7e5e4">
<tr><td style="padding:24px 32px;border-bottom:3px solid ${accent};font-size:18px;font-weight:700">{{ .Campaign.FromEmail }}</td></tr>
<tr><td style="padding:32px;line-height:1.6;color:#292524">{{ template "content" . }}</td></tr>
<tr><td style="padding:16px 32px;font-size:12px;color:#78716c">
<a href="{{ UnsubscribeURL }}" style="color:#78716c">Unsubscribe</a></td></tr>
</table></td></tr></table>{{ TrackView }}</body></html>`;

async function seedTemplates() {
  const ids: number[] = [];
  for (const [name, accent] of [['Newsletter', '#0055d4'], ['Announcement', '#16a34a'], ['Promo', '#dc2626']] as const) {
    const t = await api('POST', '/api/templates', { name, type: 'campaign', subject: '', body: TEMPLATE_BODY(accent) });
    ids.push(t.id);
  }
  return ids;
}

// ---- Campaigns ---------------------------------------------------------
async function seedCampaigns(listIDs: number[], templateIDs: number[]) {
  const subjects = [
    'October product update', 'Introducing our new dashboard', 'Your weekly digest', 'Join us at the webinar',
    'Black Friday early access', 'We have moved to a new address', 'Security notice for all users',
    'Welcome aboard', 'How teams use listmonk', 'Year in review',
  ];
  const out: { id: number; name: string }[] = [];
  for (const [i, subject] of subjects.entries()) {
    const type = pick(['html', 'markdown', 'richtext', 'plain']) as string;
    const para = () => faker.lorem.paragraph();
    const body =
      type === 'markdown' ? `# ${subject}\n\n${para()}\n\n- ${faker.lorem.sentence()}\n- ${faker.lorem.sentence()}\n\n[Read more](https://example.com)`
      : type === 'plain' ? `${para()}\n\n${para()}`
      : `<h2>${subject}</h2><p>${para()}</p><p>${para()}</p><p><a href="https://example.com/${faker.lorem.slug(2)}">Read more</a></p>`;
    const c = await api('POST', '/api/campaigns', {
      name: `${subject} (${faker.date.recent({ days: 60 }).toISOString().slice(0, 10)})`,
      subject,
      type: 'regular',
      content_type: type,
      body,
      lists: faker.helpers.arrayElements(listIDs, { min: 1, max: 3 }),
      template_id: pick(templateIDs),
      tags: faker.helpers.arrayElements(['newsletter', 'promo', 'product', 'ops'], { min: 0, max: 2 }),
      from_email: 'listmonk <noreply@example.com>',
      ...(i === 1 ? { send_at: faker.date.soon({ days: 14 }).toISOString() } : {}),
    });
    out.push({ id: c.id, name: c.name });
  }
  return out;
}

// ---- Users and roles ---------------------------------------------------
async function seedUsers(listIDs: number[]) {
  const userRoles = [
    ['Campaign editor', ['campaigns:get_all', 'campaigns:manage_all', 'campaigns:get_analytics', 'templates:get', 'media:get', 'media:manage']],
    ['Subscriber manager', ['subscribers:get_all', 'subscribers:manage', 'subscribers:import', 'bounces:get', 'bounces:manage']],
    ['Read only', ['lists:get_all', 'subscribers:get_all', 'campaigns:get_all', 'templates:get', 'bounces:get']],
  ] as const;
  const roleIDs: number[] = [];
  for (const [name, permissions] of userRoles) {
    roleIDs.push((await api('POST', '/api/roles/users', { name, permissions: [...permissions] })).id);
  }
  const listRoles: number[] = [];
  for (const name of ['EU lists', 'Marketing lists']) {
    const lists = faker.helpers.arrayElements(listIDs, { min: 2, max: 4 }).map((id) => ({ id, permissions: ['list:get', 'list:manage'] }));
    listRoles.push((await api('POST', '/api/roles/lists', { name, lists })).id);
  }
  for (let i = 0; i < 5; i += 1) {
    const name = faker.person.fullName();
    const username = faker.internet.username({ firstName: name.split(' ')[0] }).toLowerCase().replace(/[^a-z0-9._-]/g, '');
    try {
      await api('POST', '/api/users', {
        username,
        name,
        email: faker.internet.email({ firstName: name.split(' ')[0] }).toLowerCase(),
        type: 'user',
        status: i === 4 ? 'disabled' : 'enabled',
        password_login: true,
        password: 'password123456',
        password2: 'password123456',
        user_role_id: pick(roleIDs),
        list_role_id: i % 2 ? pick(listRoles) : undefined,
      });
    } catch (e) {
      console.warn(String(e));
    }
  }
  await api('POST', '/api/users', {
    username: 'ci-bot', name: 'CI bot', type: 'api', status: 'enabled', user_role_id: roleIDs[2],
  }).catch((e) => console.warn(String(e)));
}

// ---- Stats and bounces (SQL: no API for these) ------------------------
async function seedStats(campaigns: { id: number }[], subscriberIDs: number[]) {
  const sql: string[] = [];
  // Most campaigns are "sent": finished with views and clicks spread over the last weeks.
  const sent = campaigns.filter((_, i) => i !== 1 && i < 8);
  sql.push(`INSERT INTO links (uuid, url) VALUES ${[
    'https://example.com/pricing', 'https://example.com/blog/launch', 'https://example.com/docs', 'https://example.com/signup', 'https://example.com/changelog',
  ].map((u) => `(gen_random_uuid(), ${sqlStr(u)})`).join(',')} ON CONFLICT DO NOTHING;`);

  for (const c of sent) {
    const toSend = faker.number.int({ min: 120, max: Math.max(150, subscriberIDs.length) });
    const started = faker.date.recent({ days: 45 });
    sql.push(`UPDATE campaigns SET status='finished', to_send=${toSend}, sent=${toSend}, started_at=${sqlStr(started.toISOString())}, updated_at=${sqlStr(started.toISOString())} WHERE id=${c.id};`);
    const views = faker.number.int({ min: Math.floor(toSend * 0.25), max: Math.floor(toSend * 0.6) });
    const rows: string[] = [];
    for (let i = 0; i < views; i += 1) {
      const at = new Date(started.getTime() + faker.number.int({ min: 0, max: 5 * 86400_000 }));
      rows.push(`(${c.id}, ${pick(subscriberIDs)}, ${sqlStr(at.toISOString())})`);
    }
    sql.push(`INSERT INTO campaign_views (campaign_id, subscriber_id, created_at) VALUES ${rows.join(',')};`);
    const clicks: string[] = [];
    for (let i = 0; i < Math.floor(views * 0.35); i += 1) {
      const at = new Date(started.getTime() + faker.number.int({ min: 0, max: 5 * 86400_000 }));
      clicks.push(`(${c.id}, (SELECT id FROM links ORDER BY random() LIMIT 1), ${pick(subscriberIDs)}, ${sqlStr(at.toISOString())})`);
    }
    if (clicks.length) sql.push(`INSERT INTO link_clicks (campaign_id, link_id, subscriber_id, created_at) VALUES ${clicks.join(',')};`);
  }

  const bounces: string[] = [];
  for (let i = 0; i < 40; i += 1) {
    const c = pick(sent);
    const type = faker.helpers.weightedArrayElement([
      { weight: 55, value: 'soft' }, { weight: 35, value: 'hard' }, { weight: 10, value: 'complaint' },
    ]);
    const meta = JSON.stringify({ reason: pick(['mailbox full', 'user unknown', 'spam complaint', 'domain not found', 'message too large']), code: pick(['4.2.2', '5.1.1', '5.7.1']) });
    bounces.push(`(${pick(subscriberIDs)}, ${c.id}, '${type}', ${sqlStr(pick(['api', 'ses', 'mailbox']))}, ${sqlStr(meta)}::jsonb, ${sqlStr(faker.date.recent({ days: 30 }).toISOString())})`);
  }
  sql.push(`INSERT INTO bounces (subscriber_id, campaign_id, type, source, meta, created_at) VALUES ${bounces.join(',')};`);
  await runSQL(sql.join('\n'));
}

// -----------------------------------------------------------------------
await login();
const lists = await seedLists();
console.log(`lists: ${lists.length}`);
const subs = await seedSubscribers(lists, Number(process.env.SUBSCRIBERS ?? 300));
console.log(`subscribers: ${subs.length}`);
const templates = await seedTemplates();
const campaigns = await seedCampaigns(lists, templates);
console.log(`templates: ${templates.length}, campaigns: ${campaigns.length}`);
await seedUsers(lists);
await seedStats(campaigns, subs);
console.log('done');
