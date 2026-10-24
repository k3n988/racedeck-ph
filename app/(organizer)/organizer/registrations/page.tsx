import OrganizationDataPage from '@/components/organizer/organization-data-page';

type SearchParams = { eventId?: string; status?: string; from?: string; to?: string };

export default function RegistrationsPage({ searchParams }: { searchParams: SearchParams }) {
  const query = new URLSearchParams(Object.entries(searchParams).filter((entry): entry is [string, string] => typeof entry[1] === 'string')).toString();
  return <OrganizationDataPage title="Registrations" endpoint="/api/organizer/registrations" columns={['registration_number', 'event_id', 'status', 'first_name', 'last_name', 'created_at']} query={query} />;
}