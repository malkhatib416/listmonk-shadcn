import { useQuery } from '@tanstack/react-query';
import { Copy, Plus, Trash2, TriangleAlert } from 'lucide-react';
import { toast } from 'sonner';
import { useApp, useCan, useT } from '@/components/app-context';
import {
  FieldArea,
  FieldNumber,
  FieldSelect,
  FieldSwitch,
  FieldText,
  Row,
  SettingsCard,
  SubCard,
  useBind,
  useSettings,
} from '@/components/settings/fields';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { listRolesQuery, userRolesQuery } from '@/lib/roles';
import { OIDC_PROVIDERS } from '@/lib/settings';

// Radix selects cannot hold an empty value, so "none" is a sentinel.
const NONE = 'none';
const toSel = (v: string) => v || NONE;
const fromSel = (v: string) => (v === NONE ? '' : v);

function isRemoteRoot(rootUrl: string): boolean {
  try {
    const h = new URL(rootUrl).hostname;
    return h !== 'localhost' && h !== '127.0.0.1';
  } catch {
    return false;
  }
}

function Oidc() {
  const t = useT();
  const can = useCan();
  const { config } = useApp();
  const { form, update } = useSettings();
  const o = form['security.oidc'];
  const patch = (p: Partial<typeof o>) => update((d) => Object.assign(d['security.oidc'], p));
  const canRoles = can('roles:get');
  const userRoles = useQuery({ ...userRolesQuery, enabled: canRoles }).data ?? [];
  const listRoles = useQuery({ ...listRolesQuery, enabled: canRoles }).data ?? [];
  const redirect = `${config.root_url}/auth/oidc`;
  const userOptions = [
    { value: NONE, label: '—' },
    ...userRoles.map((r) => ({ value: String(r.id), label: r.name })),
  ];
  const mappingUser = [
    { value: NONE, label: `— ${t('globals.terms.default')} —` },
    ...userRoles.map((r) => ({ value: String(r.id), label: r.name })),
  ];
  const listOptions = [
    { value: NONE, label: `— ${t('globals.terms.none')} —` },
    ...listRoles.map((r) => ({ value: String(r.id), label: r.name })),
  ];
  const mappingList = [
    { value: NONE, label: `— ${t('globals.terms.default')} —` },
    ...listRoles.map((r) => ({ value: String(r.id), label: r.name })),
  ];

  return (
    <SettingsCard block="security.oidc" title={t('settings.security.enableOIDC')}>
      <FieldSwitch
        label={t('globals.buttons.enable')}
        hint={t('settings.security.OIDCHelp')}
        value={o.enabled}
        onChange={(enabled) => patch({ enabled })}
      />
      {o.enabled ? (
        <>
          <div className="flex flex-col gap-2">
            <FieldText
              label={t('settings.security.OIDCURL')}
              type="url"
              pattern="https?://.*"
              maxLength={300}
              placeholder="https://login.yoursite.com"
              required
              value={o.provider_url}
              onChange={(provider_url) => patch({ provider_url })}
            />
            <div className="flex gap-3 text-sm">
              {Object.entries(OIDC_PROVIDERS).map(([k, p]) => (
                <button
                  key={k}
                  type="button"
                  className="text-primary hover:underline"
                  onClick={() => patch({ provider_url: p.url, provider_name: p.name })}
                >
                  {p.name}
                </button>
              ))}
            </div>
          </div>
          <FieldText
            label={t('settings.security.OIDCName')}
            maxLength={200}
            value={o.provider_name}
            onChange={(provider_name) => patch({ provider_name })}
          />
          <FieldText
            label={t('settings.security.OIDCClientID')}
            maxLength={200}
            required
            value={o.client_id}
            onChange={(client_id) => patch({ client_id })}
          />
          <FieldText
            label={t('settings.security.OIDCClientSecret')}
            type="password"
            maxLength={200}
            required
            value={o.client_secret}
            onChange={(client_secret) => patch({ client_secret })}
          />
          <div className="flex flex-col gap-2">
            <Label htmlFor="oidc-redirect">{t('settings.security.OIDCRedirectURL')}</Label>
            <div className="flex gap-2">
              <Input id="oidc-redirect" readOnly value={redirect} />
              <Button
                type="button"
                variant="outline"
                size="icon"
                title={t('globals.messages.clickToCopy')}
                aria-label={t('globals.messages.clickToCopy')}
                onClick={() => {
                  void navigator.clipboard?.writeText(redirect);
                  toast.success(t('globals.messages.copied'));
                }}
              >
                <Copy />
              </Button>
            </div>
            {isRemoteRoot(config.root_url) ? null : (
              <p className="text-destructive flex items-center gap-1.5 text-xs">
                <TriangleAlert className="size-3.5" /> {t('settings.security.OIDCRedirectWarning')}
              </p>
            )}
          </div>

          <FieldSwitch
            label={t('settings.security.OIDCAutoCreateUsers')}
            hint={t('settings.security.OIDCAutoCreateUsersHelp')}
            value={o.auto_create_users}
            onChange={(auto_create_users) => patch({ auto_create_users })}
          />
          <SubCard title={t('users.roles')} disabled={!o.auto_create_users}>
            <FieldSelect
              label={t('settings.security.OIDCDefaultUserRole')}
              hint={t('settings.security.OIDCDefaultRoleHelp')}
              options={userOptions}
              value={toSel(o.default_user_role_id)}
              onChange={(v) => patch({ default_user_role_id: fromSel(v) })}
            />
            <FieldSelect
              label={t('settings.security.OIDCDefaultListRole')}
              hint={t('settings.security.OIDCDefaultRoleHelp')}
              options={listOptions}
              value={toSel(o.default_list_role_id)}
              onChange={(v) => patch({ default_list_role_id: fromSel(v) })}
            />
          </SubCard>

          <SubCard title={t('settings.security.OIDCRoleMapping')} disabled={!o.auto_create_users}>
            <p className="text-muted-foreground text-xs">
              {t('settings.security.OIDCRoleMappingHelp')}
            </p>
            {o.roles.map((m, n) => (
              <SubCard key={n} title={`#${n + 1}`}>
                <Row>
                  <FieldText
                    label={t('settings.security.OIDCClaim')}
                    placeholder="groups"
                    required
                    value={m.claim}
                    onChange={(v) => update((d) => (d['security.oidc'].roles[n]!.claim = v))}
                  />
                  <FieldText
                    label={t('globals.terms.value')}
                    placeholder="editors"
                    required
                    value={m.match}
                    onChange={(v) => update((d) => (d['security.oidc'].roles[n]!.match = v))}
                  />
                </Row>
                <Row>
                  <FieldSelect
                    label={t.tc('users.userRole', 1)}
                    options={mappingUser}
                    value={toSel(m.user_role_id)}
                    onChange={(v) =>
                      update((d) => (d['security.oidc'].roles[n]!.user_role_id = fromSel(v)))
                    }
                  />
                  <FieldSelect
                    label={t.tc('users.listRole', 2)}
                    options={mappingList}
                    value={toSel(m.list_role_id)}
                    onChange={(v) =>
                      update((d) => (d['security.oidc'].roles[n]!.list_role_id = fromSel(v)))
                    }
                  />
                </Row>
                <div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="text-destructive"
                    onClick={() => update((d) => d['security.oidc'].roles.splice(n, 1))}
                  >
                    <Trash2 /> {t('globals.buttons.remove')}
                  </Button>
                </div>
              </SubCard>
            ))}
            <div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() =>
                  update((d) =>
                    d['security.oidc'].roles.push({
                      claim: '',
                      match: '',
                      user_role_id: '',
                      list_role_id: '',
                    }),
                  )
                }
              >
                <Plus /> {t('globals.buttons.addNew')}
              </Button>
            </div>
          </SubCard>
        </>
      ) : null}
    </SettingsCard>
  );
}

function Captcha() {
  const t = useT();
  const { form, update } = useSettings();
  const c = form['security.captcha'];
  const enabled = c.altcha.enabled || c.hcaptcha.enabled;
  const provider = c.hcaptcha.enabled ? 'hcaptcha' : 'altcha';
  const setProvider = (p: 'altcha' | 'hcaptcha') =>
    update((d) => {
      d['security.captcha'].altcha.enabled = p === 'altcha';
      d['security.captcha'].hcaptcha.enabled = p === 'hcaptcha';
    });

  return (
    <SettingsCard block="security.captcha" title={t('settings.security.enableCaptcha')}>
      <FieldSwitch
        label={t('globals.buttons.enable')}
        hint={t('settings.security.enableCaptchaHelp')}
        value={enabled}
        onChange={(on) =>
          update((d) => {
            d['security.captcha'].altcha.enabled = on;
            d['security.captcha'].hcaptcha.enabled = false;
          })
        }
      />
      {enabled ? (
        <>
          <RadioGroup
            value={provider}
            onValueChange={(v) => setProvider(v as 'altcha' | 'hcaptcha')}
            className="flex gap-6"
          >
            <Label className="gap-2 font-normal">
              <RadioGroupItem value="altcha" /> ALTCHA
            </Label>
            <Label className="gap-2 font-normal">
              <RadioGroupItem value="hcaptcha" /> hCaptcha (deprecated)
            </Label>
          </RadioGroup>
          {provider === 'altcha' ? (
            <FieldNumber
              label={t('settings.security.altchaComplexity')}
              hint={t('settings.security.altchaComplexityHelp')}
              min={1000}
              max={1000000}
              value={c.altcha.complexity}
              onChange={(v) => update((d) => (d['security.captcha'].altcha.complexity = v))}
            />
          ) : (
            <>
              <FieldText
                label={t('settings.security.captchaKey')}
                hint={t('settings.security.captchaKeyHelp')}
                maxLength={200}
                value={c.hcaptcha.key}
                onChange={(v) => update((d) => (d['security.captcha'].hcaptcha.key = v))}
              />
              <FieldText
                label={t('settings.security.captchaSecret')}
                type="password"
                maxLength={200}
                value={c.hcaptcha.secret}
                onChange={(v) => update((d) => (d['security.captcha'].hcaptcha.secret = v))}
              />
            </>
          )}
        </>
      ) : null}
    </SettingsCard>
  );
}

export function SecurityTab() {
  const t = useT();
  const bind = useBind();
  const urls = bind('security.trusted_urls');

  return (
    <>
      <Oidc />
      <Captcha />
      <SettingsCard block="security.trusted" title={`${t('settings.security.trustedURLs')} / CORS`}>
        <FieldArea
          label={`${t('settings.security.trustedURLs')} / CORS`}
          hint={t('settings.security.trustedURLsHelp')}
          rows={5}
          placeholder="https://example.com"
          name={urls.name}
          value={urls.value.join('\n')}
          onChange={(v) => urls.onChange(v.split('\n'))}
        />
      </SettingsCard>
    </>
  );
}
