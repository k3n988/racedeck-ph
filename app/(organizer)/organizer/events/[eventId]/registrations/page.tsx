import RegistrationsTable from './registrations-table';

export default function OrganizerRegistrationsPage({ params }: { params: { eventId: string } }) {
  return (
    <main className="min-h-full bg-[#f4f6fa] px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-5">
        <header className="border-b border-slate-200 pb-5">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-orange-600">Event operations</p>
          <h1 className="mt-1 text-2xl font-extrabold tracking-tight text-[#071b41] sm:text-3xl">Registrations</h1>
          <p className="mt-2 text-sm text-slate-600">Search participants, review registration status, and export the current results.</p>
        </header>
      <RegistrationsTable eventId={params.eventId} />
      </div>
    </main>
  );
}
