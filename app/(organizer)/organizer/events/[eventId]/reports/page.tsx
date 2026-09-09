'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

type Report = {
  event: { name: string; overall_capacity: number | null };
  category_performance: Array<{ id: string; name: string; registrations: number; confirmed: number; capacity: number | null; available: number | null; gross_sales: number }>;
  summary: { total_registrations: number; confirmed_registrations: number; capacity: number | null; available_slots: number | null };
  operational: { race_kits_claimed: number; race_kits_unclaimed: number; results: Record<string, number>; certificates_issued: number };
  financial: { gross_registration_sales: number; discounts: number; refunds: number; racedeck_fees: number; net_organizer_revenue: number; payments: { total: number; successful: number } } | null;
  email_delivery: Record<string, number>;
  access: { financial: boolean };
};

const money = (value: number) => `₱${value.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default function OrganizerEventReportsPage({ params }: { params: { eventId: string } }) {
  const [report, setReport] = useState<Report | null>(null);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [registrationStatus, setRegistrationStatus] = useState('');
  const [paymentStatus, setPaymentStatus] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const query = useMemo(() => {
    const search = new URLSearchParams();
    if (from) search.set('from', `${from}T00:00:00.000Z`);
    if (to) search.set('to', `${to}T23:59:59.999Z`);
    if (categoryId) search.set('category_id', categoryId);
    if (registrationStatus) search.set('registration_status', registrationStatus);
    if (paymentStatus) search.set('payment_status', paymentStatus);
    return search.toString();
  }, [from, to, categoryId, registrationStatus, paymentStatus]);

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const response = await fetch(`/api/organizer/events/${params.eventId}/reports${query ? `?${query}` : ''}`);
      const body = await response.json() as Report & { error?: string };
      if (!response.ok) throw new Error(body.error ?? 'Reports could not be loaded');
      setReport(body);
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Reports could not be loaded'); }
    finally { setLoading(false); }
  }, [params.eventId, query]);

  useEffect(() => { void load(); }, [load]);

  if (loading && !report) return <main className="mx-auto max-w-7xl p-6"><p>Loading reports…</p></main>;
  if (error && !report) return <main className="mx-auto max-w-7xl p-6"><p className="text-red-600">{error}</p></main>;
  if (!report) return null;

  const download = () => { window.location.href = `/api/organizer/events/${params.eventId}/reports${query ? `?${query}&export=csv` : '?export=csv'}`; };
  const cards = [
    ['Total Registrations', report.summary.total_registrations.toLocaleString()],
    ['Confirmed', report.summary.confirmed_registrations.toLocaleString()],
    ['Capacity', report.summary.capacity === null ? '—' : report.summary.capacity.toLocaleString()],
    ['Available Slots', report.summary.available_slots === null ? '—' : report.summary.available_slots.toLocaleString()],
    ...(report.financial ? [['Gross Sales', money(report.financial.gross_registration_sales)], ['Net Revenue', money(report.financial.net_organizer_revenue)]] : []),
  ];

  return <main className="mx-auto max-w-7xl space-y-6 p-6">
    <div className="flex flex-wrap items-start justify-between gap-4"><div><h1 className="text-2xl font-semibold">Reports</h1><p className="text-sm text-muted-foreground">{report.event.name}</p></div><button type="button" onClick={download} className="rounded-md border px-4 py-2 text-sm">Export CSV</button></div>
    <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{cards.map(([label, value]) => <div key={label} className="rounded-lg border p-4"><p className="text-sm text-muted-foreground">{label}</p><p className="mt-1 text-xl font-semibold">{value}</p></div>)}</section>
    <section className="rounded-lg border p-4"><div className="grid gap-3 md:grid-cols-5"><label className="text-sm">From<input type="date" value={from} onChange={(event) => setFrom(event.target.value)} className="mt-1 block w-full rounded border p-2" /></label><label className="text-sm">To<input type="date" value={to} onChange={(event) => setTo(event.target.value)} className="mt-1 block w-full rounded border p-2" /></label><label className="text-sm">Category<select value={categoryId} onChange={(event) => setCategoryId(event.target.value)} className="mt-1 block w-full rounded border p-2"><option value="">All categories</option>{report.category_performance.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select></label><label className="text-sm">Registration status<select value={registrationStatus} onChange={(event) => setRegistrationStatus(event.target.value)} className="mt-1 block w-full rounded border p-2"><option value="">All statuses</option><option value="pending">Pending</option><option value="confirmed">Confirmed</option><option value="cancelled">Cancelled</option><option value="expired">Expired</option></select></label><label className="text-sm">Payment status<select value={paymentStatus} onChange={(event) => setPaymentStatus(event.target.value)} className="mt-1 block w-full rounded border p-2"><option value="">All statuses</option><option value="pending">Pending</option><option value="succeeded">Paid</option><option value="failed">Failed</option><option value="refunded">Refunded</option></select></label></div></section>
    {error && <p className="text-sm text-red-600">{error}</p>}
    <section className="rounded-lg border p-4"><h2 className="mb-3 text-lg font-semibold">Category Performance</h2><div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr className="border-b"><th className="p-2">Category</th><th className="p-2">Registrations</th><th className="p-2">Confirmed</th><th className="p-2">Capacity</th><th className="p-2">Available</th>{report.financial && <th className="p-2">Gross Sales</th>}</tr></thead><tbody>{report.category_performance.map((category) => <tr key={category.id} className="border-b"><td className="p-2">{category.name}</td><td className="p-2">{category.registrations}</td><td className="p-2">{category.confirmed}</td><td className="p-2">{category.capacity ?? '—'}</td><td className="p-2">{category.available ?? '—'}</td>{report.financial && <td className="p-2">{money(category.gross_sales)}</td>}</tr>)}</tbody></table></div></section>
    <section className="grid gap-4 md:grid-cols-3"><div className="rounded-lg border p-4"><h2 className="font-semibold">Race Kit</h2><p>Claimed: {report.operational.race_kits_claimed}</p><p>Unclaimed: {report.operational.race_kits_unclaimed}</p></div><div className="rounded-lg border p-4"><h2 className="font-semibold">Results</h2>{Object.entries(report.operational.results).map(([status, count]) => <p key={status}>{status.toUpperCase()}: {count}</p>)}<p>Certificates issued: {report.operational.certificates_issued}</p></div><div className="rounded-lg border p-4"><h2 className="font-semibold">Email Delivery</h2>{Object.entries(report.email_delivery).map(([status, count]) => <p key={status}>{status}: {count}</p>)}</div></section>
    {report.financial && <section className="rounded-lg border p-4"><h2 className="font-semibold">Financial Summary</h2><div className="mt-2 grid gap-2 sm:grid-cols-2"><p>Discounts: {money(report.financial.discounts)}</p><p>Refunds: {money(report.financial.refunds)}</p><p>RaceDeck fees: {money(report.financial.racedeck_fees)}</p><p>Payments: {report.financial.payments.successful} successful / {report.financial.payments.total} total</p></div></section>}
  </main>;
}
