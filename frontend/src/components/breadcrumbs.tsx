import { useRouterState } from '@tanstack/react-router';
import { ChevronRight } from 'lucide-react';
import { useT } from '@/components/app-context';
import { NAV } from '@/lib/nav';

// Where the current (ported) page sits in the sidebar: "Settings / Logs".
export function Breadcrumbs() {
  const t = useT();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const group = NAV.find((g) => g.items.some((i) => i.ported && i.path === `/admin${pathname}`));
  const item = group?.items.find((i) => i.path === `/admin${pathname}`);
  if (!group || !item) return null;

  return (
    <nav
      aria-label="Breadcrumb"
      className="text-muted-foreground flex items-center gap-1.5 text-sm"
    >
      <span>{t(group.label)}</span>
      <ChevronRight className="size-3.5" aria-hidden />
      <span className="text-foreground font-medium" aria-current="page">
        {t(item.label)}
      </span>
    </nav>
  );
}
