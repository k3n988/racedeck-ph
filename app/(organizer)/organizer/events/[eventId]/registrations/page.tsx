import RegistrationsTable from './registrations-table';

export default function OrganizerRegistrationsPage({ params }: { params: { eventId: string } }) {
  return (
    <main className="min-h-full bg-[#f4f6fa] px-4 pb-6 pt-2 sm:px-6 sm:pt-3 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-5">
        <RegistrationsTable eventId={params.eventId} />
      </div>
    </main>
  );
}
