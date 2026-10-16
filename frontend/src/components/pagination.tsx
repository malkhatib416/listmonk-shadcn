import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useT } from '@/components/app-context';
import { Button } from '@/components/ui/button';
import { lastPage, pageWindow, rangeLabel } from '@/lib/paging';

// Page controls for a server-paginated table.
export function Pagination({
  page,
  perPage,
  total,
  onPage,
}: {
  page: number;
  perPage: number;
  total: number;
  onPage: (page: number) => void;
}) {
  const t = useT();
  const last = lastPage(total, perPage);
  const { from, to } = rangeLabel(page, perPage, total);
  if (total === 0) return null;

  return (
    <nav aria-label="Pagination" className="mt-4 flex flex-wrap items-center justify-between gap-3">
      <p className="text-muted-foreground text-sm">
        {from}–{to} / {total}
      </p>
      {last > 1 ? (
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            aria-label="Previous page"
            disabled={page <= 1}
            onClick={() => onPage(page - 1)}
          >
            <ChevronLeft />
          </Button>
          {pageWindow(page, last).map((p, i) =>
            p === 'gap' ? (
              <span key={`gap-${i}`} className="text-muted-foreground px-1">
                …
              </span>
            ) : (
              <Button
                key={p}
                variant={p === page ? 'secondary' : 'ghost'}
                size="sm"
                aria-label={t('globals.terms.page', { n: p })}
                aria-current={p === page ? 'page' : undefined}
                onClick={() => onPage(p)}
              >
                {p}
              </Button>
            ),
          )}
          <Button
            variant="ghost"
            size="icon"
            aria-label="Next page"
            disabled={page >= last}
            onClick={() => onPage(page + 1)}
          >
            <ChevronRight />
          </Button>
        </div>
      ) : null}
    </nav>
  );
}
