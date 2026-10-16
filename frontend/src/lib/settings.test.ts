import { describe, expect, test } from 'bun:test';
import {
  addMessenger,
  addSmtp,
  buildSettingsPayload,
  countLines,
  deriveS3URL,
  fillSmtp,
  hasDummy,
  isDummy,
  matchingBlocks,
  normalizeSettings,
  smtpTestPayload,
  textToLines,
  type SettingsApi,
} from './settings';

// The subset of the API shape the helpers touch.
const api = (over: Record<string, unknown> = {}): SettingsApi =>
  ({
    'app.notify_emails': [],
    'privacy.domain_blocklist': ['a.com', 'b.com'],
    'privacy.domain_allowlist': null,
    'security.oidc': {
      enabled: false,
      default_user_role_id: null,
      default_list_role_id: 3,
      roles: [{ claim: 'g', match: 'x', user_role_id: 2, list_role_id: null }],
    },
    'security.captcha': {
      altcha: { enabled: false, complexity: 300000 },
      hcaptcha: { enabled: false, key: '', secret: '' },
    },
    'security.trusted_urls': ['https://a.test', 'https://b.test'],
    'upload.s3.aws_secret_access_key': '',
    'bounce.sendgrid_key': '',
    'bounce.azure': { shared_secret: '' },
    'bounce.postmark': { password: '' },
    'bounce.forwardemail': { key: '' },
    'bounce.lettermint': { key: '' },
    'bounce.mailboxes': [],
    smtp: [
      {
        name: 'a',
        host: ' smtp.x ',
        password: '••••',
        email_headers: [{ 'X-A': 'b' }],
      },
    ],
    messengers: [{ name: 'm', password: '' }],
    ...over,
  }) as unknown as SettingsApi;

describe('dummy passwords', () => {
  test('masked or empty values are dummies; mixed ones are partial', () => {
    expect(isDummy('')).toBe(true);
    expect(isDummy('••••')).toBe(true);
    expect(isDummy('••x')).toBe(false);
    expect(hasDummy('••x')).toBe(true);
    expect(hasDummy('secret')).toBe(false);
  });
});

describe('normalizeSettings', () => {
  const f = normalizeSettings(api());

  test('domain lists become one entry per line', () => {
    expect(f['privacy.domain_blocklist']).toBe('a.com\nb.com');
    expect(f['privacy.domain_allowlist']).toBe('');
  });

  test('oidc role ids become select values', () => {
    expect(f['security.oidc'].default_user_role_id).toBe('');
    expect(f['security.oidc'].default_list_role_id).toBe('3');
    expect(f['security.oidc'].roles[0]).toMatchObject({ user_role_id: '2', list_role_id: '' });
  });

  test('smtp servers get a header editor string', () => {
    expect(f.smtp[0]!.strEmailHeaders).toBe('[\n    {\n        "X-A": "b"\n    }\n]');
    expect(f.smtp[0]!.showHeaders).toBe(false);
  });

  test('there is always a bounce mailbox to bind the switch to', () => {
    expect(f['bounce.mailboxes']).toHaveLength(1);
    expect(f['bounce.mailboxes'][0]).toMatchObject({ enabled: false, type: 'pop', port: 995 });
  });

  test('does not mutate the input', () => {
    const raw = api();
    normalizeSettings(raw);
    expect(raw['privacy.domain_blocklist']).toEqual(['a.com', 'b.com']);
  });
});

describe('buildSettingsPayload', () => {
  const build = (mutate?: (f: ReturnType<typeof normalizeSettings>) => void) => {
    const f = normalizeSettings(api());
    mutate?.(f);
    return buildSettingsPayload(f);
  };

  test('masked passwords are sent as empty so the server keeps them', () => {
    const r = build();
    expect(r.ok && r.payload.smtp[0]!.password).toBe('');
  });

  test('a partially masked password is rejected by name', () => {
    const r = build((f) => (f.smtp[0]!.password = '••partial'));
    expect(r).toEqual({ ok: false, kind: 'dummy', name: 'smtp #1' });
    const r2 = build((f) => (f['bounce.sendgrid_key'] = 'a•b'));
    expect(r2).toEqual({ ok: false, kind: 'dummy', name: 'sendgrid' });
  });

  test('a new password is sent as typed', () => {
    const r = build((f) => (f.smtp[0]!.password = 'new-secret'));
    expect(r.ok && r.payload.smtp[0]!.password).toBe('new-secret');
  });

  test('smtp hosts are trimmed and headers parsed; display fields are dropped', () => {
    const r = build();
    expect(r.ok && r.payload.smtp[0]!.host).toBe('smtp.x');
    expect(r.ok && r.payload.smtp[0]!.email_headers).toEqual([{ 'X-A': 'b' }]);
    expect(r.ok && 'strEmailHeaders' in r.payload.smtp[0]!).toBe(false);
    expect(r.ok && 'showHeaders' in r.payload.smtp[0]!).toBe(false);
  });

  test('empty header text means no headers; bad JSON is reported with the server number', () => {
    const empty = build((f) => (f.smtp[0]!.strEmailHeaders = '[]'));
    expect(empty.ok && empty.payload.smtp[0]!.email_headers).toEqual([]);
    const bad = build((f) => (f.smtp[0]!.strEmailHeaders = '[nope'));
    expect(bad.ok).toBe(false);
    if (!bad.ok) expect(bad).toMatchObject({ kind: 'headers', index: 0 });
  });

  test('domain lists are trimmed, lower-cased and de-blanked', () => {
    const r = build((f) => (f['privacy.domain_blocklist'] = '  EXAMPLE.COM  \n\n spam.test\n  '));
    expect(r.ok && r.payload['privacy.domain_blocklist']).toEqual(['example.com', 'spam.test']);
  });

  test('trusted URLs are trimmed and blank lines dropped', () => {
    const r = build((f) => (f['security.trusted_urls'] = [' https://a.test ', '', '  ']));
    expect(r.ok && r.payload['security.trusted_urls']).toEqual(['https://a.test']);
  });

  test('oidc role ids go back to numbers or null', () => {
    const r = build();
    expect(r.ok && r.payload['security.oidc'].default_user_role_id).toBeNull();
    expect(r.ok && r.payload['security.oidc'].default_list_role_id).toBe(3);
    expect(r.ok && r.payload['security.oidc'].roles[0]).toMatchObject({
      user_role_id: 2,
      list_role_id: null,
    });
  });

  test('messenger and bounce mailbox secrets follow the same rule', () => {
    const r = build((f) => {
      f.messengers[0]!.password = '•••';
      f['bounce.mailboxes'][0]!.password = '•••';
    });
    expect(r.ok && r.payload.messengers[0]!.password).toBe('');
    expect(r.ok && r.payload['bounce.mailboxes'][0]!.password).toBe('');
  });
});

describe('text helpers', () => {
  test('countLines ignores blank lines', () => {
    expect(countLines('a\n\n b \n')).toBe(2);
    expect(countLines('')).toBe(0);
  });

  test('textToLines trims and drops blanks', () => {
    expect(textToLines(' a \n\nb\n')).toEqual(['a', 'b']);
    expect(textToLines('')).toEqual([]);
  });
});

describe('deriveS3URL', () => {
  test('follows the region for AWS or empty URLs only', () => {
    expect(deriveS3URL('', 'eu-west-1')).toBe('https://s3.eu-west-1.amazonaws.com');
    expect(deriveS3URL('https://s3.us-east-1.amazonaws.com', 'ap-south-1')).toBe(
      'https://s3.ap-south-1.amazonaws.com',
    );
    expect(deriveS3URL('https://minio.local:9000', 'ap-south-1')).toBe('https://minio.local:9000');
  });
});

describe('smtp and messenger rows', () => {
  test('new rows have the old defaults', () => {
    expect(addSmtp()).toMatchObject({
      enabled: true,
      port: 587,
      tls_type: 'STARTTLS',
      max_conns: 10,
    });
    expect(addMessenger()).toMatchObject({ enabled: true, max_conns: 25, timeout: '5s' });
  });

  test('a provider preset replaces connection details and clears credentials', () => {
    const s = fillSmtp(
      {
        ...addSmtp(),
        name: 'keep',
        username: 'u',
        password: 'p',
        hello_hostname: 'h',
        tls_skip_verify: true,
      },
      'gmail',
    );
    expect(s).toMatchObject({
      name: 'keep',
      host: 'smtp.gmail.com',
      port: 465,
      auth_protocol: 'login',
      tls_type: 'TLS',
      username: '',
      password: '',
      hello_hostname: '',
      tls_skip_verify: false,
    });
  });
});

describe('smtpTestPayload', () => {
  test('sends the row with parsed headers and the recipient, without display fields', () => {
    const r = smtpTestPayload(
      { ...addSmtp(), host: 'h', strEmailHeaders: '[{"X-A":"b"}]' },
      'to@x.y',
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.payload).toMatchObject({
      host: 'h',
      email: 'to@x.y',
      email_headers: [{ 'X-A': 'b' }],
    });
    expect('strEmailHeaders' in r.payload).toBe(false);
  });

  test('bad header JSON is reported', () => {
    expect(smtpTestPayload({ ...addSmtp(), strEmailHeaders: '[x' }, 'a@b.c').ok).toBe(false);
  });
});

describe('matchingBlocks', () => {
  test('all terms must match a block; nothing typed or nothing found means no filter', () => {
    expect(matchingBlocks('')).toBeNull();
    expect(matchingBlocks('   ')).toBeNull();
    expect(matchingBlocks('no-such-setting')).toBeNull();
    const m = matchingBlocks('  RATE   workers  ');
    expect(m).not.toBeNull();
    expect([...m!.tabs]).toEqual(['performance']);
    expect(m!.blocks.has('performance.main')).toBe(true);
  });

  test('a term can match several tabs', () => {
    const m = matchingBlocks('email');
    expect(m!.tabs.has('general')).toBe(true);
    expect(m!.tabs.has('smtp')).toBe(true);
  });
});
