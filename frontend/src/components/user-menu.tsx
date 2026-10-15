import { ChevronsUpDown, LogOut, Monitor, Moon, Sun, User } from 'lucide-react';
import { useApp, useT } from '@/components/app-context';
import { useTheme } from '@/components/theme-provider';
import { UserAvatar } from '@/components/user-avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { SidebarMenu, SidebarMenuButton, SidebarMenuItem } from '@/components/ui/sidebar';
import { apiFetch } from '@/lib/api';
import { hardHref } from '@/lib/basepath';

export function UserMenu() {
  const { user } = useApp();
  const t = useT();
  const { setTheme } = useTheme();
  const label = user.name || user.username;

  const logout = async () => {
    await apiFetch('/api/logout', { method: 'POST' });
    window.location.assign(hardHref(window._LM_ROOT, '/admin/login'));
  };

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton size="lg" aria-label={label}>
              <UserAvatar name={label} src={user.avatar} className="size-8 rounded-lg" />
              <span className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-medium">{label}</span>
                <span className="text-muted-foreground truncate text-xs">{user.username}</span>
              </span>
              <ChevronsUpDown className="ml-auto size-4" />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent side="top" align="start" className="min-w-56">
            <DropdownMenuItem asChild>
              <a href={hardHref(window._LM_ROOT, '/admin/user/profile')}>
                <User /> {t('users.profile')}
              </a>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuLabel className="text-muted-foreground text-xs">Theme</DropdownMenuLabel>
            <DropdownMenuItem onClick={() => setTheme('system')}>
              <Monitor /> {t('globals.terms.system')}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setTheme('light')}>
              <Sun /> {t('users.themeLight')}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setTheme('dark')}>
              <Moon /> {t('users.themeDark')}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={logout}>
              <LogOut /> {t('users.logout')}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
