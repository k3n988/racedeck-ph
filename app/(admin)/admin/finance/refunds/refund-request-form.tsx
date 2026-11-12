'use client';

import { ToastFeedback } from '@/components/toast-feedback';
import { useRouter } from 'next/navigation';
import { useRef, useState } from 'react';

type PaymentPreview = {
  id: string;
  registration: string;
  participant: string;
  event: string;
  organizer: string;
  status: string;
  gateway: string;
  currency: string;
  paid: number;
  reserved: number;
  available: number;
};

const money = (amount: number, currency: string) => new Intl.NumberFormat('en-PH', { style: 'currency', currency }).format(amount);

export default function RefundRequestForm({ payment }: { payment: PaymentPreview }) {
  const router = useRouter();
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState<'duplicate' | 'fraudulent' | 'requested_by_customer' | 'others'>('requested_by_customer');
  const [notes, setNotes] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [message, setMessage] = useState('');
  const idempotencyKey = useRef('');
  const resetRequest = () => { idempotencyKey.current = ''; setMessage(''); };
  const eligible = (payment.status === 'succeeded' || payment.status === 'partially_refunded') && payment.available >= 0.01 && payment.currency === 'PHP' && payment.gateway === 'paymongo';
  const requested = Number(amount);
  const validAmount = Number.isFinite(requested) && requested >= 0.01 && Math.abs(requested * 100 - Math.round(requested * 100)) < 0.000001 && requested <= payment.available;

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!eligible || !validAmount || !confirmed || submitting || done) return;
    setSubmitting(true);
    setMessage('');
    if (!idempotencyKey.current) idempotencyKey.current = crypto.randomUUID();
    try {
      const response = await fetch('/api/admin/refunds', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Idempotency-Key': idempotencyKey.current },
        body: JSON.stringify({ payment_id: payment.id, amount: requested, reason, notes }),
      });
      if (response.redirected) throw new Error('Your session expired. Sign in again before retrying this refund.');
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error ?? 'Refund request could not be processed.');
      setDone(true);
      setMessage(body.refund?.status === 'succeeded' ? 'Refund completed. Review the updated payment and refund records.' : 'Refund request was recorded. Its gateway status is pending; review the record before taking another action.');
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Refund request could not be processed. Check the records before retrying.');
    } finally {
      setSubmitting(false);
    }
  }

  return <section className="rounded-xl border border-orange-200 bg-white p-5 shadow-sm">
    <div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="text-lg font-extrabold text-[#071b41]">Review payment before refund</h2><p className="mt-1 text-sm text-slate-500">This request is sent to PayMongo. The server checks the actual balance again when you submit.</p></div><a href={`/admin/finance/transactions/${payment.id}`} className="text-sm font-bold text-orange-600 hover:underline">View payment →</a></div>
    <dl className="mt-4 grid gap-3 rounded-lg bg-slate-50 p-4 text-sm sm:grid-cols-2 xl:grid-cols-4"><div><dt className="text-xs font-bold uppercase text-slate-500">Participant</dt><dd className="mt-1 font-semibold">{payment.participant}<span className="block text-xs font-normal text-slate-500">{payment.registration}</span></dd></div><div><dt className="text-xs font-bold uppercase text-slate-500">Event / organizer</dt><dd className="mt-1 font-semibold">{payment.event}<span className="block text-xs font-normal text-slate-500">{payment.organizer}</span></dd></div><div><dt className="text-xs font-bold uppercase text-slate-500">Paid / reserved</dt><dd className="mt-1 font-semibold">{money(payment.paid, payment.currency)}<span className="block text-xs font-normal text-slate-500">{money(payment.reserved, payment.currency)} reserved or refunded</span></dd></div><div><dt className="text-xs font-bold uppercase text-slate-500">Available to request</dt><dd className="mt-1 text-lg font-extrabold text-[#071b41]">{money(payment.available, payment.currency)}</dd></div></dl>
    {!eligible ? <p role="status" className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">{payment.currency !== 'PHP' || payment.gateway !== 'paymongo' ? 'This refund form supports PHP PayMongo payments only.' : 'This payment is not currently eligible for a new refund request.'}</p> : done ? <p role="status" className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">{message}</p> : <form onSubmit={submit} className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-[180px_220px_minmax(180px,1fr)_auto] xl:items-end">
      <label className="text-xs font-bold uppercase tracking-wide text-slate-500">Amount (PHP)<input required type="number" min="0.01" max={payment.available.toFixed(2)} step="0.01" value={amount} onChange={(event) => { setAmount(event.target.value); resetRequest(); }} className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm font-normal" /></label>
      <label className="text-xs font-bold uppercase tracking-wide text-slate-500">Reason<select value={reason} onChange={(event) => { setReason(event.target.value as typeof reason); resetRequest(); }} className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm font-normal normal-case"><option value="requested_by_customer">Customer request</option><option value="duplicate">Duplicate</option><option value="fraudulent">Fraudulent</option><option value="others">Other</option></select></label>
      <label className="text-xs font-bold uppercase tracking-wide text-slate-500">Internal note<input value={notes} maxLength={255} onChange={(event) => { setNotes(event.target.value); resetRequest(); }} placeholder="Optional" className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm font-normal normal-case" /></label>
      <button type="submit" disabled={!confirmed || !validAmount || submitting} className="rounded-lg bg-orange-600 px-4 py-2.5 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-50">{submitting ? 'Submitting…' : 'Request refund'}</button>
      <label className="flex items-start gap-2 text-sm text-slate-700 sm:col-span-2 xl:col-span-4"><input type="checkbox" checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} className="mt-1" /><span>I verified this payment, amount, participant, and reason. I understand a submitted request may move money.</span></label>
      {message && <ToastFeedback message={String(message)} tone="error"><p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800 sm:col-span-2 xl:col-span-4">{message}</p></ToastFeedback>}
    </form>}
  </section>;
}
