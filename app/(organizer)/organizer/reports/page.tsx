import ReportsDashboard from '@/components/organizer/reports-dashboard';

type SearchParams = { eventId?: string; from?: string; to?: string };

function manilaDate(value: Date) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Manila', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(value);
  const part = (type: string) => parts.find((item) => item.type === type)?.value ?? '';
  return `${part('year')}-${part('month')}-${part('day')}`;
}

export default function ReportsPage({ searchParams }: { searchParams: SearchParams }) {
  const today = manilaDate(new Date());
  const [year, month, day] = today.split('-').map(Number);
  const previousYear = year - 1;
  const lastDayOfPreviousMonth = new Date(Date.UTC(previousYear, month, 0)).getUTCDate();
  const defaultFrom = `${previousYear}-${String(month).padStart(2, '0')}-${String(Math.min(day, lastDayOfPreviousMonth)).padStart(2, '0')}`;

  return <ReportsDashboard
    initialEventId={searchParams.eventId ?? ''}
    initialFrom={searchParams.from ?? defaultFrom}
    initialTo={searchParams.to ?? today}
    initialPeriod={searchParams.from || searchParams.to ? 'custom' : '12m'}
  />;
}
