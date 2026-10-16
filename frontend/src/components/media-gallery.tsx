import { useQuery } from '@tanstack/react-query';
import { FileText, ImageIcon, MoreHorizontal, Search, Trash2, Upload } from 'lucide-react';
import { useRef, useState } from 'react';
import { toast } from 'sonner';
import { useApp, useCan, useT } from '@/components/app-context';
import { useConfirm } from '@/components/confirm-dialog';
import { EmptyState } from '@/components/empty-state';
import { PageHeader } from '@/components/page-header';
import { Pagination } from '@/components/pagination';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { useApiMutation } from '@/hooks/use-api-mutation';
import { apiFetch } from '@/lib/api';
import { formatDate } from '@/lib/format';
import { fileExt, mediaQuery, uploadFile, type Media } from '@/lib/media';
import { cn } from '@/lib/utils';

// The media library. `manage` = the Media page (delete, open in a new tab);
// `pick` = a chooser inside a dialog: clicking a file calls onPick.
export function MediaGallery({
  mode = 'manage',
  onPick,
  bare,
}: {
  mode?: 'manage' | 'pick';
  onPick?: (m: Media) => void;
  // No page header (when embedded in a dialog).
  bare?: boolean;
}) {
  const t = useT();
  const can = useCan();
  const confirm = useConfirm();
  const { config } = useApp();
  const canManage = can('media:manage');
  const [page, setPage] = useState(1);
  const [query, setQuery] = useState('');
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const { data, isPending, error, refetch } = useQuery(mediaQuery(page, query));

  const upload = async (files: File[]) => {
    if (files.length === 0 || !canManage) return;
    setUploading(true);
    const errors = (await Promise.all(files.map(uploadFile))).filter(Boolean) as string[];
    setUploading(false);
    errors.forEach((e) => toast.error(e));
    if (errors.length < files.length) toast.success(t('globals.messages.done'));
    await refetch();
  };

  const del = useApiMutation({
    mutationFn: (m: Media) => apiFetch(`/api/media/${m.id}`, { method: 'DELETE' }),
    invalidate: [['media']],
    success: (_d, m) => t('globals.messages.deleted', { name: m.filename }),
  });

  const items = data?.results ?? [];
  const total = data?.total ?? 0;

  return (
    <div
      onDragOver={(e) => {
        if (!canManage) return;
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        void upload([...e.dataTransfer.files]);
      }}
      className={cn('rounded-xl', dragging && 'ring-primary/40 ring-2 ring-offset-4')}
    >
      {bare ? null : (
        <PageHeader
          title={t('media.title')}
          description={
            isPending
              ? undefined
              : `${total}${config.media_provider ? ` · ${config.media_provider}` : ''}`
          }
        />
      )}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="relative w-full sm:w-64">
          <Search className="text-muted-foreground absolute top-1/2 left-3 size-4 -translate-y-1/2" />
          <Input
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setPage(1);
            }}
            placeholder={t('globals.buttons.search')}
            aria-label={t('globals.buttons.search')}
            data-cy="query"
            className="pl-9"
          />
        </div>
        {canManage ? (
          <>
            <input
              ref={input}
              type="file"
              multiple
              hidden
              data-testid="file-input"
              onChange={(e) => {
                void upload([...(e.target.files ?? [])]);
                e.target.value = '';
              }}
            />
            <Button
              className="ml-auto"
              disabled={uploading}
              data-cy="btn-upload"
              onClick={() => input.current?.click()}
            >
              <Upload /> {t('media.upload')}
            </Button>
          </>
        ) : null}
      </div>

      {error ? (
        <p className="text-destructive text-sm">{error.message}</p>
      ) : isPending ? (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
          {Array.from({ length: 10 }, (_, i) => (
            <Skeleton key={i} className="aspect-square" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="bg-card rounded-xl border">
          <EmptyState
            icon={ImageIcon}
            title={t('globals.messages.emptyState')}
            description={canManage ? t('media.uploadHelp') : undefined}
          />
        </div>
      ) : (
        <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
          {items.map((m) => (
            <li
              key={m.id}
              data-cy="media-item"
              className="bg-card group relative overflow-hidden rounded-xl border"
            >
              <a
                href={m.url}
                title={m.filename}
                {...(mode === 'pick'
                  ? {
                      onClick: (e) => {
                        e.preventDefault();
                        onPick?.(m);
                      },
                    }
                  : { target: '_blank', rel: 'noopener noreferrer' })}
                className="bg-muted flex aspect-square items-center justify-center overflow-hidden"
              >
                {m.thumb_url ? (
                  <img
                    src={m.thumb_url}
                    alt={m.filename}
                    className="size-full object-cover"
                    loading="lazy"
                  />
                ) : (
                  <span className="text-muted-foreground flex flex-col items-center gap-1">
                    <FileText className="size-8" />
                    <span className="text-xs font-semibold">{fileExt(m.filename)}</span>
                  </span>
                )}
              </a>
              <div className="flex flex-col gap-0.5 px-3 py-2">
                <span className="truncate text-sm font-medium" title={m.filename}>
                  {m.filename}
                </span>
                <span className="text-muted-foreground text-xs">
                  {formatDate(m.created_at, config.lang)}
                </span>
              </div>
              {canManage && mode === 'manage' ? (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="secondary"
                      size="icon"
                      className="absolute top-2 right-2 size-8 opacity-0 group-focus-within:opacity-100 group-hover:opacity-100 data-[state=open]:opacity-100"
                      aria-label={t('globals.buttons.more')}
                    >
                      <MoreHorizontal />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem
                      variant="destructive"
                      data-cy="btn-delete"
                      onClick={async () => {
                        const ok = await confirm({
                          title: t('globals.buttons.delete'),
                          description: m.filename,
                          confirmLabel: t('globals.buttons.delete'),
                          destructive: true,
                        });
                        if (ok) del.mutate(m);
                      }}
                    >
                      <Trash2 /> {t('globals.buttons.delete')}
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              ) : null}
            </li>
          ))}
        </ul>
      )}
      <Pagination page={page} perPage={data?.per_page ?? 20} total={total} onPage={setPage} />
    </div>
  );
}
