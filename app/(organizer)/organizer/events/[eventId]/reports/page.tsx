'use client';

import { ToastFeedback } from '@/components/toast-feedback';
import { useCallback, useEffect, useMemo, useState } from 'react';

type Report = {
  event: { name: string; overall_capacity: number | null };
  category_performance: Array<{ id: string; name: string; registrations: number; confirmed: number; capacity: number | null; available: number | null; gross_sales: number }>;
  summary: { total_registrations: number; confirmed_registrations: number; capacity: number | null; available_slots: number | null };
  operational: { race_kits_claimed: number; race_kits_unclaimed: number; results: Record<string, number>; published_result_batches?: number; certificates_issued: number };
  financial: { gross_registration_sales: number; discounts: number; refunds: number; racedeck_fees: number; paid_total?: number; net_organizer_revenue: number; payments: { total: number; successful: number; by_status?: Record<string, number> } } | null;
  email_delivery: Record<string, number>;
  access: { financial: boolean };
};

const money = (value: number) => `₱${value.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const controlClass = 'mt-1.5 min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 outline-none transition focus:border-orange-500 focus:ring-4 focus:ring-orange-100 disabled:bg-slate-100';
const labelClass = 'block text-xs font-semibold uppercase tracking-wide text-slate-500';
const metricName = (value: string) => value.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());

export default function OrganizerEventReportsPage({ params }: { params: { eventId: string } }) {
  const [report, setReport] = useState<Report | null>(null);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [registrationStatus, setRegistrationStatus] = useState('');
  const [paymentStatus, setPaymentStatus] = useState('');
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState('');

  const query = useMemo(() => {
    const search = new URLSearchParams();
    if (from) search.set('from', `${from}T00:00:00+08:00`);
    if (to) search.set('to', `${to}T23:59:59.999+08:00`);
    if (categoryId) search.set('category_id', categoryId);
    if (registrationStatus) search.set('registration_status', registrationStatus);
    if (paymentStatus) search.set('payment_status', paymentStatus);
    return search.toString();
  }, [from, to, categoryId, registrationStatus, paymentStatus]);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const response = await fetch(`/api/organizer/events/${params.eventId}/reports${query ? `?${query}` : ''}`, { cache: 'no-store' });
      const body = await response.json().catch(() => ({})) as Report & { error?: string };
      if (!response.ok) throw new Error(body.error ?? 'Reports could not be loaded.');
      setReport(body);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Reports could not be loaded.');
    } finally {
      setLoading(false);
    }
  }, [params.eventId, query]);

  useEffect(() => { void load(); }, [load]);

  async function download() {
    setExporting(true);
    setError('');
    try {
      const response = await fetch(`/api/organizer/events/${params.eventId}/reports${query ? `?${query}&export=csv` : '?export=csv'}`);
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.error ?? 'Report export could not be prepared.');
      }
      const url = URL.createObjectURL(await response.blob());
      const link = document.createElement('a');
      link.href = url;
      link.download = `${params.eventId}-report.csv`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Report export could not be prepared.');
    } finally {
      setExporting(false);
    }
  }

  function resetFilters() {
    setFrom('');
    setTo('');
    setCategoryId('');
    setRegistrationStatus('');
    setPaymentStatus('');
  }

  const dateRangeInvalid = Boolean(from && to && from > to);

  if (loading && !report) return <main className="min-h-full bg-[#f4f6fa] px-4 py-6 sm:px-6 lg:px-8"><div className="mx-auto max-w-7xl space-y-5" role="status"><span className="sr-only">Loading event reports…</span><div className="h-8 w-52 animate-pulse rounded bg-slate-200" /><div className="h-20 animate-pulse rounded-2xl bg-white" /><div className="h-48 animate-pulse rounded-2xl bg-white" /></div></main>;
  if (!report && error) return <main className="min-h-full bg-[#f4f6fa] px-4 py-6 sm:px-6 lg:px-8"><div className="mx-auto max-w-7xl space-y-4"><ToastFeedback message={String(error)} tone="auto"><div className="flex flex-wrap items-center justify-between gap-3"><span>{error}</span><button type="button" onClick={() => void load()} className="shrink-0 font-semibold underline underline-offset-2">Try again</button></div></ToastFeedback></div></main>;
  if (!report) return null;

  const cards = [
    { label: 'Registrations', value: report.summary.total_registrations.toLocaleString(), detail: 'Matching filters' },
    { label: 'Confirmed', value: report.summary.confirmed_registrations.toLocaleString(), detail: 'Matching filters' },
    { label: 'Event capacity', value: report.summary.capacity === null ? 'Unlimited' : report.summary.capacity.toLocaleString(), detail: 'Configured total' },
    { label: 'Available slots', value: report.summary.available_slots === null ? '—' : report.summary.available_slots.toLocaleString(), detail: 'Based on event total' },
    ...(report.financial ? [
      { label: 'Gross sales', value: money(report.financial.gross_registration_sales), detail: 'Registration payments' },
      { label: 'Net organizer revenue', value: money(report.financial.net_organizer_revenue), detail: 'After refunds and fees' },
    ] : []),
  ];

  return <main className="min-h-full bg-[#f4f6fa] px-4 py-6 sm:px-6 lg:px-8" aria-busy={loading}>
    <div className="mx-auto max-w-7xl space-y-6">
      <header className="flex flex-col gap-4 border-b border-slate-200 pb-5 sm:flex-row sm:items-end sm:justify-between">
        <div><p className="text-xs font-bold uppercase tracking-[0.16em] text-orange-600">Event operations</p><h1 className="mt-1 text-2xl font-extrabold tracking-tight text-[#071b41] sm:text-3xl">Reports</h1><p className="mt-2 text-sm text-slate-600">Performance and operations summary for <span className="font-semibold text-slate-800">{report.event.name}</span>.</p></div>
        <button type="button" onClick={() => void download()} disabled={loading || exporting} className="min-h-11 shrink-0 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-bold text-[#0b2b5b] transition hover:border-orange-300 hover:bg-orange-50 disabled:cursor-wait disabled:opacity-50">{exporting ? 'Preparing export…' : 'Export CSV'}</button>
      </header>

      {error && <ToastFeedback message={String(error)} tone="auto"><div className="flex flex-wrap items-center justify-between gap-3"><span>{error}</span><button type="button" onClick={() => void load()} className="shrink-0 font-semibold underline underline-offset-2">Refresh report</button></div></ToastFeedback>}
      {loading && <p role="status" className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900">Updating report for the selected filters…</p>}

      <section aria-label="Report summary" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {cards.map((card) => <article key={card.label} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5"><p className="text-sm font-semibold text-slate-500">{card.label}</p><p className="mt-2 break-words text-2xl font-extrabold tracking-tight text-[#071b41]">{card.value}</p><p className="mt-1 text-xs text-slate-500">{card.detail}</p></article>)}
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-2"><div><h2 className="text-lg font-bold text-[#071b41]">Report filters</h2><p className="mt-1 text-sm text-slate-600">Filters update the report automatically. Dates use Philippine local time.</p></div><button type="button" onClick={resetFilters} disabled={loading || !(from || to || categoryId || registrationStatus || paymentStatus)} className="min-h-9 rounded-lg px-3 text-sm font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-40">Clear filters</button></div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          <label className={labelClass}>From<input type="date" max={to || undefined} value={from} disabled={loading} onChange={(event) => setFrom(event.target.value)} className={controlClass} /></label>
          <label className={labelClass}>To<input type="date" min={from || undefined} value={to} disabled={loading} onChange={(event) => setTo(event.target.value)} className={controlClass} /></label>
          <label className={labelClass}>Category<select value={categoryId} disabled={loading} onChange={(event) => setCategoryId(event.target.value)} className={controlClass}><option value="">All categories</option>{report.category_performance.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select></label>
          <label className={labelClass}>Registration status<select value={registrationStatus} disabled={loading} onChange={(event) => setRegistrationStatus(event.target.value)} className={controlClass}><option value="">All statuses</option><option value="pending_payment">Pending payment</option><option value="confirmed">Confirmed</option><option value="cancelled">Cancelled</option><option value="transferred">Transferred</option><option value="refunded">Refunded</option><option value="expired">Expired</option></select></label>
          <label className={labelClass}>Payment status<select value={paymentStatus} disabled={loading} onChange={(event) => setPaymentStatus(event.target.value)} className={controlClass}><option value="">All statuses</option><option value="pending">Pending</option><option value="processing">Processing</option><option value="succeeded">Paid</option><option value="failed">Failed</option><option value="partially_refunded">Partially refunded</option><option value="refunded">Refunded</option></select></label>
        </div>
        {dateRangeInvalid && <p role="alert" className="mt-3 text-sm font-medium text-red-700">The start date must be before or the same as the end date.</p>}
      </section>

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 px-5 py-4 sm:px-6"><h2 className="text-lg font-bold text-[#071b41]">Category performance</h2><p className="mt-1 text-sm text-slate-600">Registration counts reflect the selected filters; capacity reflects the event setup.</p></div>
        {report.category_performance.length === 0 ? <p className="px-5 py-8 text-center text-sm text-slate-600">No categories are configured for this event.</p> : <div className="overflow-x-auto"><table className="w-full min-w-[700px] text-left text-sm"><thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500"><tr><th className="px-5 py-3">Category</th><th className="px-5 py-3">Registrations</th><th className="px-5 py-3">Confirmed</th><th className="px-5 py-3">Capacity</th><th className="px-5 py-3">Available</th>{report.financial && <th className="px-5 py-3">Gross sales</th>}</tr></thead><tbody className="divide-y divide-slate-100">{report.category_performance.map((category) => <tr key={category.id} className="text-slate-700 hover:bg-slate-50/70"><td className="px-5 py-3.5 font-semibold text-[#071b41]">{category.name}</td><td className="px-5 py-3.5">{category.registrations.toLocaleString()}</td><td className="px-5 py-3.5">{category.confirmed.toLocaleString()}</td><td className="px-5 py-3.5">{category.capacity?.toLocaleString() ?? 'Unlimited'}</td><td className="px-5 py-3.5">{category.available?.toLocaleString() ?? '—'}</td>{report.financial && <td className="whitespace-nowrap px-5 py-3.5">{money(category.gross_sales)}</td>}</tr>)}</tbody></table></div>}
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        <MetricPanel title="Race kits" entries={[["Claimed", report.operational.race_kits_claimed], ["Unclaimed", report.operational.race_kits_unclaimed]]} />
        <MetricPanel title="Race results" entries={Object.entries(report.operational.results).map(([status, count]) => [metricName(status), count] as [string, number]).concat(report.operational.published_result_batches === undefined ? [] : [['Published batches', report.operational.published_result_batches]])} footer={`Certificates issued: ${report.operational.certificates_issued.toLocaleString()}`} />
        <MetricPanel title="Email delivery" entries={Object.entries(report.email_delivery).map(([status, count]) => [metricName(status), count])} />
      </section>

      {report.financial && <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6"><div className="mb-4"><h2 className="text-lg font-bold text-[#071b41]">Financial summary</h2><p className="mt-1 text-sm text-slate-600">Only users with financial reporting permission can see these figures.</p></div><div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><FinancialMetric label="Gross registration sales" value={money(report.financial.gross_registration_sales)} /><FinancialMetric label="Discounts" value={money(report.financial.discounts)} /><FinancialMetric label="Refunds" value={money(report.financial.refunds)} /><FinancialMetric label="RaceDeck and processing fees" value={money(report.financial.racedeck_fees)} /><FinancialMetric label="Net organizer revenue" value={money(report.financial.net_organizer_revenue)} /><FinancialMetric label="Successful payments" value={`${report.financial.payments.successful.toLocaleString()} / ${report.financial.payments.total.toLocaleString()}`} />{Object.entries(report.financial.payments.by_status ?? {}).map(([status, count]) => <FinancialMetric key={status} label={`${metricName(status)} payments`} value={count.toLocaleString()} />)}</div></section>}
    </div>
  </main>;
}

function MetricPanel({ title, entries, footer }: { title: string; entries: Array<[string, number]>; footer?: string }) {
  return <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><h2 className="font-bold text-[#071b41]">{title}</h2>{entries.length ? <dl className="mt-3 divide-y divide-slate-100">{entries.map(([label, value]) => <div key={label} className="flex items-center justify-between gap-3 py-2 text-sm"><dt className="text-slate-600">{label}</dt><dd className="font-bold tabular-nums text-slate-900">{value.toLocaleString()}</dd></div>)}</dl> : <p className="mt-3 text-sm text-slate-500">No data available.</p>}{footer && <p className="mt-3 border-t border-slate-100 pt-3 text-sm text-slate-600">{footer}</p>}</section>;
}

function FinancialMetric({ label, value }: { label: string; value: string }) {
  return <div className="rounded-xl bg-slate-50 p-3"><p className="text-xs font-semibold text-slate-500">{label}</p><p className="mt-1 break-words text-base font-bold tabular-nums text-[#071b41]">{value}</p></div>;
}
