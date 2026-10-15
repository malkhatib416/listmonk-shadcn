import { Link, useRouterState, type LinkProps } from '@tanstack/react-router';
import { ChevronRight } from 'lucide-react';
import { useApp, useT } from '@/components/app-context';
import { NavIcon } from '@/components/nav-icon';
import { UserMenu } from '@/components/user-menu';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarRail,
} from '@/components/ui/sidebar';
import { hardHref } from '@/lib/basepath';
import { visibleNav, type NavItem } from '@/lib/nav';

// Router paths drop the /admin prefix (see lib/basepath.ts).
const routerPath = (item: NavItem) => item.path.replace(/^\/admin/, '') || '/';

type ItemLinkProps = {
  item: NavItem;
  label: string;
  active: boolean;
  sub?: boolean;
};

// Ported pages navigate client side. Everything else is a plain link: the browser
// loads the old Go page.
function ItemLink({ item, label, active, sub }: ItemLinkProps) {
  const Button = sub ? SidebarMenuSubButton : SidebarMenuButton;
  return (
    <Button asChild isActive={active}>
      {item.ported ? (
        <Link to={routerPath(item) as LinkProps['to']}>
          <span>{label}</span>
        </Link>
      ) : (
        <a href={hardHref(window._LM_ROOT, item.path)}>
          <span>{label}</span>
        </a>
      )}
    </Button>
  );
}

export function AppSidebar() {
  const { user } = useApp();
  const t = useT();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const groups = visibleNav(user);
  const isActive = (item: NavItem) => item.ported && routerPath(item) === pathname;

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <a
          href={hardHref(window._LM_ROOT, '/admin')}
          className="flex h-10 items-center px-2 dark:invert"
        >
          <img
            src={hardHref(window._LM_ROOT, '/admin/static/logo.svg')}
            alt="listmonk"
            className="h-6"
          />
        </a>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarMenu>
            {groups.map((group) => {
              const only = group.items.length === 1 ? group.items[0]! : null;
              if (only) {
                return (
                  <SidebarMenuItem key={group.key}>
                    <SidebarMenuButton asChild tooltip={t(group.label)} isActive={isActive(only)}>
                      <a href={hardHref(window._LM_ROOT, only.path)}>
                        <NavIcon name={group.icon} />
                        <span>{t(group.label)}</span>
                      </a>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              }
              const open = group.items.some(isActive);
              return (
                <Collapsible
                  key={group.key}
                  asChild
                  defaultOpen={open}
                  className="group/collapsible"
                >
                  <SidebarMenuItem>
                    <CollapsibleTrigger asChild>
                      <SidebarMenuButton tooltip={t(group.label)}>
                        <NavIcon name={group.icon} />
                        <span>{t(group.label)}</span>
                        <ChevronRight className="ml-auto transition-transform group-data-[state=open]/collapsible:rotate-90" />
                      </SidebarMenuButton>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <SidebarMenuSub>
                        {group.items.map((item) => (
                          <SidebarMenuSubItem key={item.key}>
                            <ItemLink
                              item={item}
                              label={t(item.label)}
                              active={isActive(item)}
                              sub
                            />
                          </SidebarMenuSubItem>
                        ))}
                      </SidebarMenuSub>
                    </CollapsibleContent>
                  </SidebarMenuItem>
                </Collapsible>
              );
            })}
          </SidebarMenu>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        <UserMenu />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
