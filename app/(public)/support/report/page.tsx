import SupportReportForm from '@/components/support/support-report-form';
import { loadAuthContext } from '@/lib/auth/permissions';

export default async function SupportReportPage() {
  const auth = await loadAuthContext();
  const organizer = Boolean(auth?.memberships.length);
  return (
    <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6 lg:py-14">
      <div className="mb-7">
        <p className="text-sm font-bold uppercase tracking-[0.14em] text-orange-600">RaceDeck Support</p>
        <h1 className="mt-2 text-3xl font-black tracking-tight text-[#071b41]">Report an issue</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
          {organizer
            ? 'Tell us what happened. Your report will be linked to your organizer account.'
            : 'Participants can submit a report using the email and registration number from their event confirmation.'}
        </p>
      </div>
      <SupportReportForm organizer={organizer} email={auth?.user.email ?? ''} />
    </main>
  );
}
