import { can, type AppUser } from './permissions';

export interface NavItem {
  key: string;
  label: string;
  path: string;
  perms: string[];
  // Query params that select this item among others on the same path.
  search?: Record<string, string>;
}

export interface NavGroup {
  key: string;
  label: string;
  icon: string;
  items: NavItem[];
}

const item = (
  key: string,
  label: string,
  path: string,
  perms: string[] = [],
  search?: Record<string, string>,
): NavItem => ({ key, label, path, perms, ...(search ? { search } : {}) });

// The sidebar. A single-item group renders as a plain link.
export const NAV: NavGroup[] = [
  {
    key: 'dashboard',
    label: 'menu.dashboard',
    icon: 'grid',
    items: [item('dashboard', 'menu.dashboard', '/admin', [])],
  },
  {
    key: 'lists',
    label: 'globals.terms.lists',
    icon: 'list',
    items: [
      item('lists.all', 'menu.allLists', '/admin/lists', []),
      item('lists.archived', 'lists.archived', '/admin/lists', [], { status: 'archived' }),
      item('lists.analytics', 'globals.terms.analytics', '/admin/lists/analytics', []),
      item('lists.forms', 'menu.forms', '/admin/lists/forms', []),
    ],
  },
  {
    key: 'subscribers',
    label: 'globals.terms.subscribers',
    icon: 'at-sign',
    items: [
      item('subscribers.all', 'menu.allSubscribers', '/admin/subscribers', [
        'subscribers:get',
        'subscribers:get_all',
      ]),
      item('subscribers.import', 'menu.import', '/admin/subscribers/import', [
        'subscribers:import',
      ]),
      item('subscribers.bounces', 'globals.terms.bounces', '/admin/subscribers/bounces', [
        'bounces:get',
      ]),
    ],
  },
  {
    key: 'campaigns',
    label: 'globals.terms.campaigns',
    icon: 'send',
    items: [
      item('campaigns.all', 'menu.allCampaigns', '/admin/campaigns', [
        'campaigns:get',
        'campaigns:get_all',
      ]),
      item('campaigns.new', 'menu.newCampaign', '/admin/campaigns/new', [
        'campaigns:manage',
        'campaigns:manage_all',
      ]),
      item('campaigns.media', 'menu.media', '/admin/campaigns/media', [
        'media:get',
        'media:manage',
      ]),
      item('campaigns.templates', 'globals.terms.templates', '/admin/templates', ['templates:get']),
      item('campaigns.analytics', 'globals.terms.analytics', '/admin/campaigns/analytics', [
        'campaigns:get_analytics',
      ]),
    ],
  },
  {
    key: 'users',
    label: 'globals.terms.users',
    icon: 'users',
    items: [
      item('users.users', 'globals.terms.users', '/admin/users', ['users:get']),
      item('users.user-roles', 'users.userRoles', '/admin/users/roles', ['roles:get']),
      item('users.list-roles', 'users.listRoles', '/admin/users/roles/lists', ['roles:get']),
    ],
  },
  {
    key: 'settings',
    label: 'menu.settings',
    icon: 'settings',
    items: [
      item('settings.all', 'menu.settings', '/admin/settings', ['settings:get']),
      item('settings.logs', 'menu.logs', '/admin/settings/logs', ['settings:get']),
      item('settings.maintenance', 'menu.maintenance', '/admin/settings/maintenance', [
        'settings:maintain',
      ]),
    ],
  },
];

export function visibleNav(user: AppUser): NavGroup[] {
  return NAV.map((g) => ({
    ...g,
    items: g.items.filter((i) => i.perms.length === 0 || can(user, ...i.perms)),
  })).filter((g) => g.items.length > 0);
}

// The sidebar item that owns this router path (the longest matching prefix), so "/users/5"
// keeps Users active while "/users/roles/5" belongs to User roles. Items sharing a path are
// told apart by their `search` params ("/lists?status=archived").
export function activeNavItem(
  pathname: string,
  search: Record<string, unknown> = {},
): NavItem | undefined {
  let best: NavItem | undefined;
  let bestScore = -1;
  for (const g of NAV) {
    for (const i of g.items) {
      const p = i.path.replace(/^\/admin/, '') || '/';
      if (!(pathname === p || pathname.startsWith(`${p}/`))) continue;
      if (i.search && !Object.entries(i.search).every(([k, v]) => search[k] === v)) continue;
      const score = p.length * 2 + (i.search ? 1 : 0);
      if (score > bestScore) {
        best = i;
        bestScore = score;
      }
    }
  }
  return best;
}
