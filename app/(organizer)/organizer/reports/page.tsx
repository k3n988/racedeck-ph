import OrganizationDataPage from '@/components/organizer/organization-data-page';

type SearchParams = { eventId?: string; from?: string; to?: string; metric?: string };

export default function ReportsPage({ searchParams }: { searchParams: SearchParams }) {
  const query = new URLSearchParams(Object.entries(searchParams).filter((entry): entry is [string, string] => typeof entry[1] === 'string')).toString();
  const highlightSummaryKey = searchParams.metric === 'gross' ? 'gross_sales' : searchParams.metric === 'net' ? 'net_revenue' : undefined;
  return <OrganizationDataPage title="Organization Reports" endpoint="/api/organizer/reports" columns={[]} query={query} highlightSummaryKey={highlightSummaryKey} />;
}