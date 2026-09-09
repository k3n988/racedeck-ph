import OrganizationDataPage from '@/components/organizer/organization-data-page';
export default function RegistrationsPage() { return <OrganizationDataPage title="Registrations" endpoint="/api/organizer/registrations" columns={['registration_number', 'event_id', 'status', 'first_name', 'last_name', 'created_at']} />; }
