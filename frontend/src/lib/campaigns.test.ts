import { describe, expect, test } from 'bun:test';
import {
  campaignActions,
  campaignsSearchSchema,
  mergeRunningStats,
  progressPercent,
  stoppedRunning,
  statusTone,
  type Campaign,
} from './campaigns';

const camp = (over: Partial<Campaign>): Campaign => ({
  id: 1,
  uuid: 'u',
  name: 'C',
  subject: 'S',
  status: 'draft',
  type: 'regular',
  content_type: 'html',
  tags: [],
  lists: [],
  sent: 0,
  to_send: 0,
  views: 0,
  clicks: 0,
  bounces: 0,
  send_at: null,
  started_at: null,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
  ...over,
});

describe('campaignActions', () => {
  test('a draft without a send date can start; with one it can be scheduled', () => {
    expect(campaignActions(camp({ status: 'draft' }))).toMatchObject({
      canStart: true,
      canSchedule: false,
    });
    expect(
      campaignActions(camp({ status: 'draft', send_at: '2027-01-01T00:00:00Z' })),
    ).toMatchObject({
      canStart: false,
      canSchedule: true,
    });
  });
  test('running: pause and cancel', () => {
    expect(campaignActions(camp({ status: 'running' }))).toMatchObject({
      canPause: true,
      canResume: false,
      canCancel: true,
      canStart: false,
    });
  });
  test('paused: resume and cancel', () => {
    expect(campaignActions(camp({ status: 'paused' }))).toMatchObject({
      canResume: true,
      canCancel: true,
      canPause: false,
    });
  });
  test('finished and cancelled are final, only scheduled can be unscheduled', () => {
    for (const status of ['finished', 'cancelled'] as const) {
      expect(campaignActions(camp({ status }))).toMatchObject({
        canStart: false,
        canPause: false,
        canResume: false,
        canCancel: false,
        isDone: true,
      });
    }
    expect(campaignActions(camp({ status: 'scheduled' })).canUnschedule).toBe(true);
  });
});

describe('statusTone', () => {
  test('maps every status', () => {
    expect(statusTone('draft')).toBe('neutral');
    expect(statusTone('scheduled')).toBe('info');
    expect(statusTone('running')).toBe('info');
    expect(statusTone('paused')).toBe('warning');
    expect(statusTone('cancelled')).toBe('danger');
    expect(statusTone('finished')).toBe('success');
  });
});

describe('progressPercent', () => {
  test('floor of sent/to_send, 0 without a total', () => {
    expect(progressPercent(50, 200)).toBe(25);
    expect(progressPercent(1, 3)).toBe(33);
    expect(progressPercent(5, 0)).toBe(0);
  });
});

describe('mergeRunningStats', () => {
  test('live numbers replace the table row for the same campaign only', () => {
    const rows = [camp({ id: 1, sent: 1, to_send: 10 }), camp({ id: 2, sent: 5, to_send: 5 })];
    const out = mergeRunningStats(rows, [
      { id: 1, sent: 7, to_send: 10, rate: 30, status: 'running' },
    ]);
    expect(out[0]).toMatchObject({ sent: 7, to_send: 10, rate: 30 });
    expect(out[1]).toMatchObject({ sent: 5, to_send: 5 });
  });
  test('no live stats leaves rows as they are', () => {
    const rows = [camp({ id: 1 })];
    expect(mergeRunningStats(rows, [])).toEqual(rows);
  });
});

describe('stoppedRunning', () => {
  const live = (id: number) => ({ id, sent: 1, to_send: 2, rate: 0, status: 'running' });
  test('a row still shown as running but missing from the live stats has stopped', () => {
    const rows = [camp({ id: 1, status: 'running' }), camp({ id: 2, status: 'running' })];
    expect(stoppedRunning(rows, [live(1)])).toBe(true);
  });
  test('all running rows present, or none running, means nothing stopped', () => {
    expect(stoppedRunning([camp({ id: 1, status: 'running' })], [live(1)])).toBe(false);
    expect(stoppedRunning([camp({ id: 1, status: 'draft' })], [])).toBe(false);
  });
  test('before the first live answer nothing is judged', () => {
    expect(stoppedRunning([camp({ id: 1, status: 'running' })], undefined)).toBe(false);
  });
});

describe('campaignsSearchSchema', () => {
  test('filters and sort', () => {
    expect(
      campaignsSearchSchema.parse({
        page: '2',
        query: 'news',
        status: 'running',
        type: 'optin',
        tag: ['a', 'b'],
        order_by: 'created_at',
        order: 'desc',
      }),
    ).toEqual({
      page: 2,
      query: 'news',
      status: ['running'],
      type: 'optin',
      tag: ['a', 'b'],
      order_by: 'created_at',
      order: 'desc',
    });
  });
  test('both campaign types are valid filters', () => {
    expect(campaignsSearchSchema.parse({ type: 'regular' })).toEqual({ type: 'regular' });
    expect(campaignsSearchSchema.parse({ type: 'optin' })).toEqual({ type: 'optin' });
  });
  test('several statuses', () => {
    expect(campaignsSearchSchema.parse({ status: ['draft', 'paused'] })).toEqual({
      status: ['draft', 'paused'],
    });
  });
  test('junk is dropped', () => {
    expect(campaignsSearchSchema.parse({ status: 'weird', type: 'x', order_by: 'id' })).toEqual({});
  });
});
