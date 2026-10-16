import { createFileRoute } from '@tanstack/react-router';
import { AnalyticsPage } from '@/components/analytics-page';
import { analyticsSearchSchema, type AnalyticsSearch } from '@/lib/analytics';

export const Route = createFileRoute('/_app/campaigns/analytics')({
  head: () => ({ meta: [{ title: 'Analytics - listmonk' }] }),
  validateSearch: (s): AnalyticsSearch => analyticsSearchSchema.parse(s) as AnalyticsSearch,
  component: function CampaignAnalytics() {
    return <AnalyticsPage resource="campaigns" search={Route.useSearch()} />;
  },
});
