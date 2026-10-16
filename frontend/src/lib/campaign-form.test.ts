import { describe, expect, test } from 'bun:test';
import {
  buildPayload,
  canArchive,
  canEdit,
  canSchedule,
  canStart,
  canUnschedule,
  formFromCampaign,
  parseArchiveMeta,
  tabFromHash,
  toLocalInput,
  type CampaignDetail,
} from './campaign-form';

const defaults = { fromEmail: 'me <me@x.y>', templateId: 3, messenger: 'email' };

const detail = (o: Partial<CampaignDetail> = {}): CampaignDetail =>
  ({
    id: 7,
    uuid: 'u',
    name: 'N',
    subject: 'S',
    status: 'draft',
    type: 'regular',
    content_type: 'richtext',
    tags: ['a'],
    lists: [{ id: 1, name: 'L' }],
    from_email: 'f@x.y',
    messenger: 'email',
    template_id: 2,
    body: '<p>x</p>',
    body_source: null,
    altbody: null,
    headers: [],
    attribs: {},
    media: [],
    archive: false,
    archive_slug: null,
    archive_template_id: null,
    archive_meta: {},
    send_at: null,
    ...o,
  }) as CampaignDetail;

describe('formFromCampaign', () => {
  test('new campaign takes the server defaults', () => {
    const f = formFromCampaign(null, defaults);
    expect(f.from_email).toBe('me <me@x.y>');
    expect(f.template_id).toBe(3);
    expect(f.archive_template_id).toBe(3);
    expect(f.content_type).toBe('richtext');
    expect(f.messenger).toBe('email');
    expect(f.sendLater).toBe(false);
  });

  test('existing campaign is mapped and JSON fields are pretty printed', () => {
    const f = formFromCampaign(
      detail({ headers: [{ 'X-A': 'b' }], attribs: { k: 1 }, send_at: '2030-01-02T03:04:00Z' }),
      defaults,
    );
    expect(f.lists).toEqual([1]);
    expect(f.headersStr).toBe('[\n    {\n        "X-A": "b"\n    }\n]');
    expect(f.attribsStr).toBe('{\n    "k": 1\n}');
    expect(f.sendLater).toBe(true);
    expect(f.sendAtLocal).toMatch(/^2030-01-0[12]T\d\d:\d\d$/);
    expect(f.template_id).toBe(2);
  });

  test('null altbody stays null, text stays text', () => {
    expect(formFromCampaign(detail(), defaults).altbody).toBeNull();
    expect(formFromCampaign(detail({ altbody: 'hi' }), defaults).altbody).toBe('hi');
  });
});

describe('toLocalInput', () => {
  test('empty and invalid inputs give an empty string', () => {
    expect(toLocalInput(null)).toBe('');
    expect(toLocalInput('nope')).toBe('');
  });
});

describe('buildPayload', () => {
  const base = formFromCampaign(detail(), defaults);

  test('maps the form to the API shape', () => {
    const r = buildPayload({ ...base, lists: [1, 2], tags: ['t'] });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.payload).toMatchObject({
      name: 'N',
      lists: [1, 2],
      type: 'regular',
      tags: ['t'],
      send_at: null,
      headers: [],
      attribs: {},
      template_id: 2,
      altbody: null,
      media: [],
    });
  });

  test('send later serialises as an ISO instant', () => {
    const r = buildPayload({ ...base, sendLater: true, sendAtLocal: '2030-05-06T07:08' });
    expect(r.ok && r.payload.send_at).toBe(new Date('2030-05-06T07:08').toISOString());
  });

  test('send later switched off drops the date', () => {
    const r = buildPayload({ ...base, sendLater: false, sendAtLocal: '2030-05-06T07:08' });
    expect(r.ok && r.payload.send_at).toBeNull();
  });

  test('plain campaigns never send an alt body', () => {
    const r = buildPayload({ ...base, content_type: 'plain', altbody: 'x' });
    expect(r.ok && r.payload.altbody).toBeNull();
  });

  test('only persisted media ids are sent', () => {
    const r = buildPayload({
      ...base,
      media: [
        { id: 4, filename: 'a.png' },
        { id: 0, filename: 'gone.png' },
      ],
    });
    expect(r.ok && r.payload.media).toEqual([4]);
  });

  test.each([
    ['headersStr', '[bad', 'headers'],
    ['attribsStr', '{bad', 'attribs'],
  ] as const)('invalid %s is reported by field', (key, value, field) => {
    const r = buildPayload({ ...base, [key]: value });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.field).toBe(field);
  });

  test('archive meta is validated only when archiving', () => {
    expect(buildPayload({ ...base, archive: false, archiveMetaStr: '{bad' }).ok).toBe(true);
    const r = buildPayload({ ...base, archive: true, archiveMetaStr: '{bad' });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.field).toBe('archive_meta');
  });

  test('empty headers and attribs fields are accepted', () => {
    const r = buildPayload({ ...base, headersStr: '  ', attribsStr: '' });
    expect(r.ok && r.payload.headers).toEqual([]);
    expect(r.ok && r.payload.attribs).toBeNull();
  });
});

describe('parseArchiveMeta', () => {
  test('parses whatever is in the box, even when archiving is switched off', () => {
    expect(parseArchiveMeta('{"name":"x"}')).toEqual({ ok: true, meta: { name: 'x' } });
    expect(parseArchiveMeta('  ')).toEqual({ ok: true, meta: {} });
  });
  test('bad JSON is reported', () => {
    expect(parseArchiveMeta('{bad').ok).toBe(false);
  });
});

describe('status rules', () => {
  test('only draft, scheduled and paused campaigns are editable', () => {
    expect(['draft', 'scheduled', 'paused'].every((s) => canEdit(s as never))).toBe(true);
    expect(['running', 'cancelled', 'finished'].some((s) => canEdit(s as never))).toBe(false);
  });

  test('start, schedule and unschedule follow the status and send date', () => {
    expect(canStart('draft', false)).toBe(true);
    expect(canStart('paused', false)).toBe(true);
    expect(canStart('draft', true)).toBe(false);
    expect(canSchedule('draft', true, '2030-01-01T00:00')).toBe(true);
    expect(canSchedule('draft', true, '')).toBe(false);
    expect(canUnschedule('scheduled')).toBe(true);
    expect(canUnschedule('draft')).toBe(false);
  });

  test('cancelled and opt-in campaigns cannot be archived', () => {
    expect(canArchive('finished', 'regular')).toBe(true);
    expect(canArchive('cancelled', 'regular')).toBe(false);
    expect(canArchive('draft', 'optin')).toBe(false);
  });
});

describe('tabFromHash', () => {
  test('reads the tab from #tab=<id> and defaults to the campaign tab', () => {
    expect(tabFromHash('tab=content')).toBe('content');
    expect(tabFromHash('#tab=archive')).toBe('archive');
    expect(tabFromHash('tab=nope')).toBe('campaign');
    expect(tabFromHash('')).toBe('campaign');
    expect(tabFromHash(undefined)).toBe('campaign');
  });
});
