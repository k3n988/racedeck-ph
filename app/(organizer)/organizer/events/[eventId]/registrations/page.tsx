import RegistrationsTable from './registrations-table';

export default function OrganizerRegistrationsPage({ params }: { params: { eventId: string } }) {
  return (
    <main className="mx-auto max-w-7xl p-6">
      <RegistrationsTable eventId={params.eventId} />
    </main>
  );
}
