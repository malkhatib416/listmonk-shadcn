import { Link, useRouterState, type LinkProps } from '@tanstack/react-router';
import { ChevronRight } from 'lucide-react';
import { useT } from '@/components/app-context';
import { NAV, activeNavItem } from '@/lib/nav';

// Where the current (ported) page sits in the sidebar: "Users / User roles". On a
// sub-page (an edit form) the section becomes a link back to its list.
export function Breadcrumbs() {
  const t = useT();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const item = activeNavItem(pathname);
  const group = item && NAV.find((g) => g.items.includes(item));
  if (!item || !group) return null;

  const itemPath = item.path.replace(/^\/admin/, '') || '/';
  const isSection = pathname === itemPath;

  return (
    <nav
      aria-label="Breadcrumb"
      className="text-muted-foreground flex items-center gap-1.5 text-sm"
    >
      {t(group.label) !== t(item.label) ? (
        <>
          <span>{t(group.label)}</span>
          <ChevronRight className="size-3.5" aria-hidden />
        </>
      ) : null}
      {isSection ? (
        <span className="text-foreground font-medium" aria-current="page">
          {t(item.label)}
        </span>
      ) : (
        <Link to={itemPath as LinkProps['to']} className="hover:text-foreground">
          {t(item.label)}
        </Link>
      )}
    </nav>
  );
}
