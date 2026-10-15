import { Link, createFileRoute, useNavigate } from '@tanstack/react-router';
import { Plus, Search, X } from 'lucide-react';
import { useState } from 'react';
import { useCan, useT } from '@/components/app-context';
import { CampaignsTable } from '@/components/campaigns-table';
import { PageHeader } from '@/components/page-header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  STATUSES,
  campaignsSearchSchema,
  type CampaignStatus,
  type CampaignsSearch,
} from '@/lib/campaigns';

export const Route = createFileRoute('/_app/campaigns/')({
  head: () => ({ meta: [{ title: 'Campaigns - listmonk' }] }),
  validateSearch: (s): CampaignsSearch => campaignsSearchSchema.parse(s) as CampaignsSearch,
  component: CampaignsPage,
});

const ALL = 'all';

function CampaignsPage() {
  const t = useT();
  const can = useCan();
  const search = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  const [query, setQuery] = useState(search.query ?? '');

  const go = (patch: Partial<CampaignsSearch>, resetPage = true) =>
    void navigate({
      search: (prev) => ({ ...prev, ...(resetPage ? { page: undefined } : {}), ...patch }),
    });
  const hasFilters = !!(search.status || search.type || search.tag || search.query);

  return (
    <>
      <PageHeader
        title={t('globals.terms.campaigns')}
        actions={
          can('campaigns:manage', 'campaigns:manage_all') ? (
            <Button asChild data-testid="btn-new">
              <Link to="/campaigns/new">
                <Plus /> {t('globals.buttons.new')}
              </Link>
            </Button>
          ) : null
        }
      />
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <form
          className="relative w-full sm:w-72"
          onSubmit={(e) => {
            e.preventDefault();
            go({ query: query.trim() || undefined });
          }}
        >
          <Search className="text-muted-foreground absolute top-1/2 left-3 size-4 -translate-y-1/2" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t('campaigns.queryPlaceholder')}
            aria-label={t('globals.buttons.search')}
            data-testid="query"
            className="pl-9"
          />
        </form>
        <Select
          value={search.status?.[0] ?? ALL}
          onValueChange={(v) => go({ status: v === ALL ? undefined : [v as CampaignStatus] })}
        >
          <SelectTrigger className="w-auto min-w-36 gap-2" aria-label={t('globals.fields.status')}>
            <span className="text-muted-foreground">{t('globals.fields.status')}:</span>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>—</SelectItem>
            {STATUSES.map((s) => (
              <SelectItem key={s} value={s}>
                {t(`campaigns.status.${s}`)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {search.type ? (
          <Button variant="secondary" size="sm" onClick={() => go({ type: undefined })}>
            {search.type === 'optin' ? t('lists.optin') : search.type} <X />
          </Button>
        ) : null}
        {search.tag?.map((tag) => (
          <Button
            key={tag}
            variant="secondary"
            size="sm"
            data-testid="btn-remove-filter"
            onClick={() =>
              go({
                tag: search.tag!.filter((x) => x !== tag).length
                  ? search.tag!.filter((x) => x !== tag)
                  : undefined,
              })
            }
          >
            #{tag} <X />
          </Button>
        ))}
        {hasFilters ? (
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
      <CampaignsTable search={search} onSearch={go} />
    </>
  );
}
