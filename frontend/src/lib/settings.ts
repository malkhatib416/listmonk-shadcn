// Settings: the shapes the API returns, the display form derived from them, and the pure
// rules for turning one into the other. The page itself lives in components/settings/.

export const SETTINGS_TABS = [
  'general',
  'performance',
  'privacy',
  'security',
  'media',
  'smtp',
  'bounces',
  'messengers',
  'appearance',
] as const;
export type SettingsTab = (typeof SETTINGS_TABS)[number];

export interface SmtpServer {
  name: string;
  enabled: boolean;
  host: string;
  hello_hostname: string;
  port: number;
  auth_protocol: string;
  username: string;
  password: string;
  email_headers: Record<string, string>[];
  from_addresses: string[];
  max_conns: number;
  max_msg_retries: number;
  msg_retry_delay: string;
  idle_timeout: string;
  wait_timeout: string;
  tls_type: string;
  tls_skip_verify: boolean;
}

export interface Messenger {
  enabled: boolean;
  root_url: string;
  name: string;
  username: string;
  password: string;
  max_conns: number;
  max_msg_retries: number;
  timeout: string;
}

export interface BounceMailbox {
  enabled: boolean;
  type: string;
  host: string;
  port: number;
  auth_protocol: string;
  username: string;
  password: string;
  return_path: string;
  tls_enabled: boolean;
  tls_skip_verify: boolean;
  scan_interval: string;
}

export interface BounceAction {
  count: number;
  action: string;
}

interface OidcBase {
  enabled: boolean;
  provider_url: string;
  provider_name: string;
  client_id: string;
  client_secret: string;
  auto_create_users: boolean;
}

interface OidcRole<Id> {
  claim: string;
  match: string;
  user_role_id: Id;
  list_role_id: Id;
}

export interface Captcha {
  altcha: { enabled: boolean; complexity: number };
  hcaptcha: { enabled: boolean; key: string; secret: string };
}

// Keys whose shape is the same on the wire and in the form.
interface SettingsShared {
  'app.site_name': string;
  'app.root_url': string;
  'app.logo_url': string;
  'app.favicon_url': string;
  'app.lang': string;
  'app.from_email': string;
  'app.notify_emails': string[];
  'app.enable_public_subscription_page': boolean;
  'app.send_optin_confirmation': boolean;
  'app.show_optin_page': boolean;
  'app.enable_public_archive': boolean;
  'app.enable_public_archive_rss_content': boolean;
  'app.check_updates': boolean;
  'app.concurrency': number;
  'app.message_rate': number;
  'app.batch_size': number;
  'app.max_send_errors': number;
  'app.message_sliding_window': boolean;
  'app.message_sliding_window_rate': number;
  'app.message_sliding_window_duration': string;
  'app.cache_slow_queries': boolean;
  'app.cache_slow_queries_interval': string;
  'privacy.disable_tracking': boolean;
  'privacy.individual_tracking': boolean;
  'privacy.record_optin_ip': boolean;
  'privacy.unsubscribe_header': boolean;
  'privacy.allow_blocklist': boolean;
  'privacy.allow_preferences': boolean;
  'privacy.allow_export': boolean;
  'privacy.allow_wipe': boolean;
  'security.captcha': Captcha;
  'security.trusted_urls': string[];
  'upload.extensions': string[];
  'upload.provider': string;
  'upload.filesystem.upload_path': string;
  'upload.filesystem.upload_uri': string;
  'upload.s3.aws_default_region': string;
  'upload.s3.aws_access_key_id': string;
  'upload.s3.aws_secret_access_key': string;
  'upload.s3.bucket_type': string;
  'upload.s3.bucket': string;
  'upload.s3.bucket_path': string;
  'upload.s3.expiry': string;
  'upload.s3.url': string;
  'upload.s3.public_url': string;
  'bounce.enabled': boolean;
  'bounce.actions': { soft: BounceAction; hard: BounceAction; complaint: BounceAction };
  'bounce.webhooks_enabled': boolean;
  'bounce.ses_enabled': boolean;
  'bounce.azure': {
    enabled: boolean;
    shared_secret: string;
    shared_secret_header: string;
  };
  'bounce.sendgrid_enabled': boolean;
  'bounce.sendgrid_key': string;
  'bounce.postmark': { enabled: boolean; username: string; password: string };
  'bounce.forwardemail': { enabled: boolean; key: string };
  'bounce.lettermint': { enabled: boolean; key: string };
  'appearance.admin.custom_css': string;
  'appearance.admin.custom_js': string;
  'appearance.public.custom_css': string;
  'appearance.public.custom_js': string;
}

// What GET/PUT /api/settings carry.
export interface SettingsApi extends SettingsShared {
  'privacy.domain_blocklist': string[] | null;
  'privacy.domain_allowlist': string[] | null;
  'security.oidc': OidcBase & {
    default_user_role_id: number | null;
    default_list_role_id: number | null;
    roles: OidcRole<number | null>[];
  };
  'bounce.mailboxes': BounceMailbox[];
  smtp: SmtpServer[];
  messengers: Messenger[];
}

export interface SmtpRow extends SmtpServer {
  // The custom headers as editable JSON text, and whether the editor is open.
  strEmailHeaders: string;
  showHeaders: boolean;
}

// What the page edits: lists of lines as text, role ids as select values ('' = none).
export interface SettingsForm extends SettingsShared {
  'privacy.domain_blocklist': string;
  'privacy.domain_allowlist': string;
  'security.oidc': OidcBase & {
    default_user_role_id: string;
    default_list_role_id: string;
    roles: OidcRole<string>[];
  };
  'bounce.mailboxes': BounceMailbox[];
  smtp: SmtpRow[];
  messengers: Messenger[];
}

// Keys of the form whose value is of type T, for typed field components.
export type KeyOf<T> = {
  [K in keyof SettingsForm]: SettingsForm[K] extends T ? K : never;
}[keyof SettingsForm];

// The server masks stored secrets with bullets; an untouched field comes back masked.
export const isDummy = (pwd: string | null | undefined): boolean =>
  !pwd || [...pwd].every((c) => c === '•');
export const hasDummy = (pwd: string): boolean => pwd.includes('•');

export const countLines = (s: string): number => s.split('\n').filter((l) => l.trim()).length;
export const textToLines = (s: string): string[] =>
  s
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);

const defaultMailbox = (): BounceMailbox => ({
  enabled: false,
  type: 'pop',
  host: '',
  port: 995,
  auth_protocol: 'userpass',
  username: '',
  password: '',
  return_path: '',
  tls_enabled: true,
  tls_skip_verify: false,
  scan_interval: '15m',
});

export function normalizeSettings(raw: SettingsApi): SettingsForm {
  const d = structuredClone(raw);
  const oidc = d['security.oidc'];
  return {
    ...d,
    'privacy.domain_blocklist': (d['privacy.domain_blocklist'] ?? []).join('\n'),
    'privacy.domain_allowlist': (d['privacy.domain_allowlist'] ?? []).join('\n'),
    'security.oidc': {
      ...oidc,
      default_user_role_id: oidc.default_user_role_id ? String(oidc.default_user_role_id) : '',
      default_list_role_id: oidc.default_list_role_id ? String(oidc.default_list_role_id) : '',
      roles: (oidc.roles ?? []).map((r) => ({
        ...r,
        user_role_id: r.user_role_id ? String(r.user_role_id) : '',
        list_role_id: r.list_role_id ? String(r.list_role_id) : '',
      })),
    },
    'bounce.mailboxes':
      Array.isArray(d['bounce.mailboxes']) && d['bounce.mailboxes'].length > 0
        ? d['bounce.mailboxes']
        : [defaultMailbox()],
    smtp: (d.smtp ?? []).map((s) => ({
      ...s,
      strEmailHeaders: JSON.stringify(s.email_headers ?? [], null, 4),
      showHeaders: false,
    })),
    messengers: d.messengers ?? [],
  };
}

export type PayloadResult =
  | { ok: true; payload: SettingsApi }
  | { ok: false; kind: 'dummy'; name: string }
  | { ok: false; kind: 'headers'; index: number; detail: string };

const toId = (v: string): number | null => (v ? parseInt(v, 10) : null);

export function buildSettingsPayload(form: SettingsForm): PayloadResult {
  const f = structuredClone(form);
  let dummy = '';

  // Each secret is either untouched (masked: send empty so the server keeps it), replaced,
  // or half-edited (reject, the user must clear it and type the whole thing).
  const secret = (holder: Record<string, unknown>, key: string, name: string) => {
    const v = holder[key] as string;
    if (isDummy(v)) holder[key] = '';
    else if (hasDummy(v)) dummy = name;
  };

  const smtp: Omit<SmtpRow, 'strEmailHeaders' | 'showHeaders'>[] = [];
  for (const [i, row] of f.smtp.entries()) {
    const { strEmailHeaders, showHeaders: _show, ...s } = row;
    s.host = s.host?.trim();
    secret(s as unknown as Record<string, unknown>, 'password', `smtp #${i + 1}`);
    const text = strEmailHeaders.trim();
    if (text && text !== '[]') {
      try {
        s.email_headers = JSON.parse(text) as Record<string, string>[];
      } catch (e) {
        return { ok: false, kind: 'headers', index: i, detail: String(e) };
      }
    } else {
      s.email_headers = [];
    }
    smtp.push(s);
  }

  for (const [i, m] of f['bounce.mailboxes'].entries()) {
    m.host = m.host?.trim();
    secret(m as unknown as Record<string, unknown>, 'password', `bounce #${i + 1}`);
  }
  secret(f as unknown as Record<string, unknown>, 'upload.s3.aws_secret_access_key', 's3');
  secret(f as unknown as Record<string, unknown>, 'bounce.sendgrid_key', 'sendgrid');
  secret(
    f['bounce.azure'] as unknown as Record<string, unknown>,
    'shared_secret',
    'azure shared secret',
  );
  secret(f['security.captcha'].hcaptcha as unknown as Record<string, unknown>, 'secret', 'captcha');
  secret(f['security.oidc'] as unknown as Record<string, unknown>, 'client_secret', 'oidc');
  secret(f['bounce.postmark'] as unknown as Record<string, unknown>, 'password', 'postmark');
  secret(f['bounce.forwardemail'] as unknown as Record<string, unknown>, 'key', 'forwardemail');
  secret(f['bounce.lettermint'] as unknown as Record<string, unknown>, 'key', 'lettermint');
  for (const [i, m] of f.messengers.entries()) {
    secret(m as unknown as Record<string, unknown>, 'password', `messenger #${i + 1}`);
  }
  if (dummy) return { ok: false, kind: 'dummy', name: dummy };

  const oidc = f['security.oidc'];
  const lower = (s: string) => textToLines(s).map((l) => l.toLowerCase());
  return {
    ok: true,
    payload: {
      ...f,
      smtp: smtp as SmtpServer[],
      'security.trusted_urls': f['security.trusted_urls'].map((u) => u.trim()).filter(Boolean),
      'privacy.domain_blocklist': lower(f['privacy.domain_blocklist']),
      'privacy.domain_allowlist': lower(f['privacy.domain_allowlist']),
      'security.oidc': {
        ...oidc,
        default_user_role_id: toId(oidc.default_user_role_id),
        default_list_role_id: toId(oidc.default_list_role_id),
        roles: oidc.roles.map((r) => ({
          ...r,
          user_role_id: toId(r.user_role_id),
          list_role_id: toId(r.list_role_id),
        })),
      },
    },
  };
}

// The body of POST /api/settings/smtp/test: one server as edited, and who to mail.
export function smtpTestPayload(
  row: SmtpRow,
  email: string,
): { ok: true; payload: SmtpServer & { email: string } } | { ok: false; detail: string } {
  const { strEmailHeaders, showHeaders: _show, ...server } = row;
  const text = strEmailHeaders.trim();
  if (text && text !== '[]') {
    try {
      server.email_headers = JSON.parse(text) as Record<string, string>[];
    } catch (e) {
      return { ok: false, detail: String(e) };
    }
  } else {
    server.email_headers = [];
  }
  return { ok: true, payload: { ...server, email } };
}

// The S3 endpoint follows the region unless it was set to a non-AWS URL.
export function deriveS3URL(current: string, region: string): string {
  if (current !== '' && !/amazonaws\.com/.test(current)) return current;
  return `https://s3.${region}.amazonaws.com`;
}

export const addSmtp = (): SmtpRow => ({
  name: '',
  enabled: true,
  host: '',
  hello_hostname: '',
  port: 587,
  auth_protocol: 'none',
  username: '',
  password: '',
  email_headers: [],
  strEmailHeaders: '[]',
  showHeaders: false,
  from_addresses: [],
  max_conns: 10,
  max_msg_retries: 2,
  msg_retry_delay: '10ms',
  idle_timeout: '15s',
  wait_timeout: '5s',
  tls_type: 'STARTTLS',
  tls_skip_verify: false,
});

export const addMessenger = (): Messenger => ({
  enabled: true,
  root_url: '',
  name: '',
  username: '',
  password: '',
  max_conns: 25,
  max_msg_retries: 2,
  timeout: '5s',
});

// Quick-fill values for known SMTP providers.
export const SMTP_PRESETS = {
  gmail: {
    label: 'Gmail',
    host: 'smtp.gmail.com',
    port: 465,
    auth_protocol: 'login',
    tls_type: 'TLS',
  },
  ses: {
    label: 'Amazon SES',
    host: 'email-smtp.YOUR-REGION.amazonaws.com',
    port: 465,
    auth_protocol: 'login',
    tls_type: 'TLS',
  },
  azure: {
    label: 'Azure ACS',
    host: 'smtp.azurecomm.net',
    port: 587,
    auth_protocol: 'login',
    tls_type: 'STARTTLS',
  },
  mailgun: {
    label: 'Mailgun',
    host: 'smtp.mailgun.org',
    port: 465,
    auth_protocol: 'login',
    tls_type: 'TLS',
  },
  mailjet: {
    label: 'Mailjet',
    host: 'in-v3.mailjet.com',
    port: 465,
    auth_protocol: 'cram',
    tls_type: 'TLS',
  },
  sendgrid: {
    label: 'Sendgrid',
    host: 'smtp.sendgrid.net',
    port: 465,
    auth_protocol: 'login',
    tls_type: 'TLS',
  },
  postmark: {
    label: 'Postmark',
    host: 'smtp.postmarkapp.com',
    port: 587,
    auth_protocol: 'cram',
    tls_type: 'STARTTLS',
  },
  forwardemail: {
    label: 'Forward Email',
    host: 'smtp.forwardemail.net',
    port: 465,
    auth_protocol: 'login',
    tls_type: 'TLS',
  },
  lettermint: {
    label: 'Lettermint',
    host: 'smtp.lettermint.co',
    port: 465,
    auth_protocol: 'login',
    tls_type: 'TLS',
  },
} as const;
export type SmtpPreset = keyof typeof SMTP_PRESETS;

export function fillSmtp(row: SmtpRow, preset: SmtpPreset): SmtpRow {
  const { label: _label, ...p } = SMTP_PRESETS[preset];
  return { ...row, ...p, username: '', password: '', hello_hostname: '', tls_skip_verify: false };
}

export const OIDC_PROVIDERS = {
  google: { name: 'Google', url: 'https://accounts.google.com' },
  microsoft: { name: 'Microsoft', url: 'https://login.microsoftonline.com/{TENANT_HERE}/v2.0' },
  apple: { name: 'Apple', url: 'https://appleid.apple.com' },
} as const;

// ---- Search -------------------------------------------------------------

// Every searchable block of settings and the words that find it.
export const SETTINGS_BLOCKS: Record<string, { tab: SettingsTab; keywords: string }> = {
  'general.site': {
    tab: 'general',
    keywords: 'site name root url logo favicon language locale branding domain title',
  },
  'general.email': {
    tab: 'general',
    keywords: 'from email address admin notification emails sender',
  },
  'general.subscription': {
    tab: 'general',
    keywords: 'subscription public page opt-in optin confirmation double signup',
  },
  'general.archive': { tab: 'general', keywords: 'public archive rss feed campaigns' },
  'general.updates': {
    tab: 'general',
    keywords: 'check updates version announcements notifications',
  },
  'performance.main': {
    tab: 'performance',
    keywords:
      'performance concurrency message rate batch size errors threshold throughput sending speed workers',
  },
  'performance.sliding': {
    tab: 'performance',
    keywords: 'sliding window rate limit throttle duration cap sending',
  },
  'performance.cache': {
    tab: 'performance',
    keywords: 'cache slow queries dashboard cron interval materialized stats',
  },
  'privacy.tracking': {
    tab: 'privacy',
    keywords:
      'privacy tracking open click individual subscriber opt-in ip analytics one-click unsubscribe header',
  },
  'privacy.permissions': {
    tab: 'privacy',
    keywords: 'privacy permissions blocklist preferences export wipe gdpr data subscriber rights',
  },
  'privacy.domains': {
    tab: 'privacy',
    keywords: 'domain blocklist allowlist email address filter block allow deny',
  },
  'security.oidc': {
    tab: 'security',
    keywords:
      'oidc sso single sign-on openid connect authentication login provider identity roles mapping claims groups',
  },
  'security.captcha': {
    tab: 'security',
    keywords: 'captcha altcha hcaptcha spam bot protection public form verification',
  },
  'security.trusted': {
    tab: 'security',
    keywords: 'trusted urls cors cross-origin api access allowed hosts',
  },
  'media.extensions': {
    tab: 'media',
    keywords: 'upload file extensions media attachments allowed types images',
  },
  'media.provider': { tab: 'media', keywords: 'media upload provider storage filesystem s3' },
  'media.filesystem': { tab: 'media', keywords: 'filesystem local upload path uri directory disk' },
  'media.s3': {
    tab: 'media',
    keywords: 's3 aws bucket region access key secret cloud object storage endpoint',
  },
  'smtp.servers': {
    tab: 'smtp',
    keywords:
      'smtp mail server outgoing email sending host port tls authentication login relay gmail ses sendgrid mailgun postmark from headers retries',
  },
  'bounces.enable': {
    tab: 'bounces',
    keywords: 'bounce processing email delivery failures soft hard complaint enable',
  },
  'bounces.soft': {
    tab: 'bounces',
    keywords: 'bounce soft action count threshold unsubscribe blocklist delete',
  },
  'bounces.hard': {
    tab: 'bounces',
    keywords: 'bounce hard action count threshold unsubscribe blocklist delete',
  },
  'bounces.complaint': {
    tab: 'bounces',
    keywords: 'bounce complaint action count threshold unsubscribe blocklist delete',
  },
  'bounces.mailbox': { tab: 'bounces', keywords: 'bounce mailbox pop imap scan inbox host poll' },
  'bounces.webhooks': { tab: 'bounces', keywords: 'bounce webhook notifications endpoint enable' },
  'bounces.ses': { tab: 'bounces', keywords: 'bounce ses amazon sns aws webhook' },
  'bounces.azure': { tab: 'bounces', keywords: 'bounce azure webhook shared secret header' },
  'bounces.sendgrid': { tab: 'bounces', keywords: 'bounce sendgrid webhook key' },
  'bounces.postmark': { tab: 'bounces', keywords: 'bounce postmark webhook username password' },
  'bounces.forwardemail': {
    tab: 'bounces',
    keywords: 'bounce forwardemail forward email webhook key',
  },
  'bounces.lettermint': { tab: 'bounces', keywords: 'bounce lettermint webhook key' },
  'messengers.list': {
    tab: 'messengers',
    keywords: 'messenger sms push notification webhook postback external channel',
  },
  'appearance.admin-css': {
    tab: 'appearance',
    keywords: 'appearance admin custom css style theme ui',
  },
  'appearance.admin-js': {
    tab: 'appearance',
    keywords: 'appearance admin custom javascript js script ui',
  },
  'appearance.public-css': {
    tab: 'appearance',
    keywords: 'appearance public custom css style theme subscription page',
  },
  'appearance.public-js': {
    tab: 'appearance',
    keywords: 'appearance public custom javascript js script subscription page',
  },
};

export interface SearchMatch {
  tabs: Set<SettingsTab>;
  blocks: Set<string>;
}

// Blocks matching every search term, or null when there is nothing to filter by (empty
// query, or no block matches, in which case everything is shown as usual).
export function matchingBlocks(query: string): SearchMatch | null {
  const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (terms.length === 0) return null;
  const tabs = new Set<SettingsTab>();
  const blocks = new Set<string>();
  for (const [id, b] of Object.entries(SETTINGS_BLOCKS)) {
    if (terms.every((t) => b.keywords.includes(t))) {
      blocks.add(id);
      tabs.add(b.tab);
    }
  }
  return blocks.size === 0 ? null : { tabs, blocks };
}
