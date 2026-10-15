import { useQuery } from '@tanstack/react-query';
import { Link, createFileRoute, useNavigate } from '@tanstack/react-router';
import {
  CheckCircle2,
  Code2,
  Copy,
  Eye,
  FileCode2,
  MoreHorizontal,
  Pencil,
  Plus,
  Search,
  Send,
  Terminal,
  Trash2,
  X,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { useApp, useCan, useT } from '@/components/app-context';
import { useConfirm } from '@/components/confirm-dialog';
import { DataTable, type Column } from '@/components/data-table';
import { EmptyState } from '@/components/empty-state';
import { PageHeader } from '@/components/page-header';
import { PreviewDialog, type PreviewSource } from '@/components/preview-dialog';
import { PromptDialog } from '@/components/prompt-dialog';
import { StatusBadge } from '@/components/status-badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useApiMutation } from '@/hooks/use-api-mutation';
import { apiFetch } from '@/lib/api';
import { formatDate } from '@/lib/format';
import {
  filterTemplates,
  templatesQuery,
  templatesSearchSchema,
  type Template,
  type TemplateType,
} from '@/lib/templates';

export const Route = createFileRoute('/_app/templates/')({
  head: () => ({ meta: [{ title: 'Templates - listmonk' }] }),
  validateSearch: (s): { type?: TemplateType } => templatesSearchSchema.parse(s),
  component: TemplatesPage,
});

const ALL = 'all';

function TypeBadge({ type }: { type: TemplateType }) {
  const t = useT();
  if (type === 'tx')
    return (
      <StatusBadge tone="warning">
        <Terminal className="size-3" /> {t.tc('globals.terms.tx', 1)}
      </StatusBadge>
    );
  return (
    <span className="flex flex-wrap gap-1">
      <StatusBadge tone="info">
        <Send className="size-3" /> {t.tc('globals.terms.campaign', 1)}
      </StatusBadge>
      <StatusBadge>
        {type === 'campaign_visual' ? <Eye className="size-3" /> : <Code2 className="size-3" />}
        {type === 'campaign_visual' ? t('campaigns.contentType.visual') : 'HTML'}
      </StatusBadge>
    </span>
  );
}

function TemplatesPage() {
  const t = useT();
  const can = useCan();
  const confirm = useConfirm();
  const { config } = useApp();
  const search = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  const { data, isPending, error } = useQuery(templatesQuery);
  const [query, setQuery] = useState('');
  const [preview, setPreview] = useState<PreviewSource | null>(null);
  const [cloning, setCloning] = useState<Template | null>(null);
  const canManage = can('templates:manage');

  const templates = useMemo(() => data ?? [], [data]);
  const rows = useMemo(
    () => filterTemplates(templates, { type: search.type, query }),
    [templates, search.type, query],
  );

  const invalidate = [['templates']];
  const del = useApiMutation({
    mutationFn: (x: Template) => apiFetch(`/api/templates/${x.id}`, { method: 'DELETE' }),
    invalidate,
    success: (_d, x) => t('globals.messages.deleted', { name: x.name }),
  });
  const setDefault = useApiMutation({
    mutationFn: (x: Template) => apiFetch(`/api/templates/${x.id}/default`, { method: 'PUT' }),
    invalidate,
    success: (_d, x) => t('globals.messages.updated', { name: x.name }),
  });
  const clone = useApiMutation({
    mutationFn: async ({ from, name }: { from: Template; name: string }) => {
      const full = await apiFetch<Template>(`/api/templates/${from.id}`);
      return apiFetch<Template>('/api/templates', {
        method: 'POST',
        body: JSON.stringify({
          name,
          type: full.type,
          subject: full.subject,
          body: full.body,
          body_source: full.body_source,
        }),
      });
    },
    invalidate,
    success: (d) => t('globals.messages.created', { name: d.name }),
    onSuccess: () => setCloning(null),
  });

  const columns: Column<Template>[] = [
    {
      id: 'name',
      header: t('globals.fields.name'),
      compare: (a, b) => a.name.localeCompare(b.name),
      cell: (x) => (
        <div className="flex items-center gap-3">
          <span className="bg-secondary text-secondary-foreground flex size-8 items-center justify-center rounded-lg">
            {x.type === 'tx' ? <Terminal className="size-4" /> : <FileCode2 className="size-4" />}
          </span>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <Link
                to="/templates/$id"
                params={{ id: String(x.id) }}
                className="font-medium hover:underline"
              >
                {x.name}
              </Link>
              {x.is_default ? (
                <StatusBadge tone="success" dot>
                  {t('templates.default')}
                </StatusBadge>
              ) : null}
            </div>
            {x.type === 'tx' && x.subject ? (
              <div className="text-muted-foreground truncate text-xs">{x.subject}</div>
            ) : null}
          </div>
        </div>
      ),
    },
    {
      id: 'type',
      header: t('globals.fields.type'),
      compare: (a, b) => a.type.localeCompare(b.type),
      cell: (x) => <TypeBadge type={x.type} />,
    },
    {
      id: 'created_at',
      header: t('globals.fields.createdAt'),
      compare: (a, b) => a.created_at.localeCompare(b.created_at),
      cell: (x) => (
        <span className="text-muted-foreground">{formatDate(x.created_at, config.lang)}</span>
      ),
    },
    {
      id: 'actions',
      header: <span className="sr-only">{t('globals.buttons.more')}</span>,
      className: 'w-12 text-right',
      cell: (x) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" aria-label={t('globals.buttons.more')}>
              <MoreHorizontal />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem
              data-testid="btn-preview"
              onClick={() => setPreview({ title: x.name, path: `/api/templates/${x.id}/preview` })}
            >
              <Eye /> {t('templates.preview')}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild data-testid="btn-edit">
              <Link to="/templates/$id" params={{ id: String(x.id) }}>
                <Pencil /> {t('globals.buttons.edit')}
              </Link>
            </DropdownMenuItem>
            {canManage ? (
              <>
                <DropdownMenuItem data-testid="btn-clone" onClick={() => setCloning(x)}>
                  <Copy /> {t('globals.buttons.clone')}
                </DropdownMenuItem>
                {!x.is_default && x.type === 'campaign' ? (
                  <DropdownMenuItem
                    data-testid="btn-set-default"
                    onClick={async () => {
                      if (await confirm({ title: t('templates.default'), description: x.name }))
                        setDefault.mutate(x);
                    }}
                  >
                    <CheckCircle2 /> {t('templates.makeDefault')}
                  </DropdownMenuItem>
                ) : null}
                {!x.is_default ? (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      variant="destructive"
                      data-testid="btn-delete"
                      onClick={async () => {
                        const ok = await confirm({
                          title: t('globals.buttons.delete'),
                          description: t('globals.messages.confirm'),
                          confirmLabel: t('globals.buttons.delete'),
                          destructive: true,
                        });
                        if (ok) del.mutate(x);
                      }}
                    >
                      <Trash2 /> {t('globals.buttons.delete')}
                    </DropdownMenuItem>
                  </>
                ) : null}
              </>
            ) : null}
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title={t('globals.terms.templates')}
        description={isPending ? undefined : String(rows.length)}
        actions={
          canManage ? (
            <Button asChild data-testid="btn-new">
              <Link to="/templates/new">
                <Plus /> {t('globals.buttons.new')}
              </Link>
            </Button>
          ) : null
        }
      />
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="relative w-full sm:w-64">
          <Search className="text-muted-foreground absolute top-1/2 left-3 size-4 -translate-y-1/2" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t('globals.buttons.search')}
            aria-label={t('globals.buttons.search')}
            data-testid="query"
            className="pl-9"
          />
        </div>
        <Select
          value={search.type ?? ALL}
          onValueChange={(v) =>
            void navigate({ search: v === ALL ? {} : { type: v as TemplateType } })
          }
        >
          <SelectTrigger className="w-auto min-w-40 gap-2" aria-label={t('globals.fields.type')}>
            <span className="text-muted-foreground">{t('globals.fields.type')}:</span>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>—</SelectItem>
            <SelectItem value="campaign">{t.tc('templates.typeCampaignHTML', 1)}</SelectItem>
            <SelectItem value="campaign_visual">
              {t.tc('templates.typeCampaignVisual', 1)}
            </SelectItem>
            <SelectItem value="tx">{t.tc('templates.typeTransactional', 1)}</SelectItem>
          </SelectContent>
        </Select>
        {search.type || query ? (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setQuery('');
              void navigate({ search: {} });
            }}
          >
            <X /> {t('globals.buttons.clear')}
          </Button>
        ) : null}
      </div>
      {error ? (
        <p className="text-destructive text-sm">{error.message}</p>
      ) : (
        <DataTable
          columns={columns}
          rows={rows}
          getRowId={(x) => x.id}
          loading={isPending}
          rowTestId="template-row"
          empty={<EmptyState icon={FileCode2} title={t('globals.messages.emptyState')} />}
        />
      )}
      <PreviewDialog source={preview} onClose={() => setPreview(null)} />
      <PromptDialog
        open={cloning !== null}
        title={t('globals.buttons.clone')}
        initial={cloning ? t('campaigns.copyOf', { name: cloning.name }) : ''}
        confirmLabel={t('globals.buttons.clone')}
        busy={clone.isPending}
        onClose={() => setCloning(null)}
        onSubmit={(name) => cloning && clone.mutate({ from: cloning, name })}
      />
    </>
  );
}
