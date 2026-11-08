'use client';

import { useEffect, useState } from 'react';

type Payment = { id: string; amount_due: number; amount_paid: number; amount_refunded: number; currency: string; status: string; gateway: string; gateway_payment_id: string | null; checkout_url: string | null; expires_at: string | null; paid_at: string | null };
type Row = { id: string; registration_number: string; events: { name: string } | null; payments: Payment[]; payment_receipts: Array<{ receipt_reference: string; storage_reference: string | null }>; invoices: Array<{ invoice_reference: string; invoice_number: number; status: string; storage_reference: string | null }> };

const isPending = (status: string) => status === 'pending' || status === 'processing';

export default function PaymentsPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [message, setMessage] = useState('Loading payments...');

  useEffect(() => {
    void fetch('/api/participant/payments').then(async response => {
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error ?? 'Payments could not be loaded');
      setRows(body.registrations ?? []); setMessage('');
    }).catch(error => setMessage(error instanceof Error ? error.message : 'Payments could not be loaded'));
  }, []);

  return <main className="mx-auto max-w-5xl space-y-6 p-6">
    <h1 className="text-3xl font-semibold">Payments</h1>
    {message && <p role="status">{message}</p>}
    {!message && (rows.length ? <div className="space-y-4">{rows.flatMap(row => row.payments.map(payment => {
      const paid = payment.status === 'succeeded';
      const receipt = row.payment_receipts[0];
      const invoice = row.invoices.find(item => item.status === 'issued');
      return <article key={payment.id} className="rounded border p-4">
        <h2 className="font-semibold">{row.events?.name ?? 'Race event'}</h2>
        <p className="text-sm text-gray-600">Registration {row.registration_number} · {payment.status}</p>
        <p className="mt-2">{paid ? 'Total paid' : 'Amount due'}: {payment.currency} {Number(paid ? payment.amount_paid : payment.amount_due).toFixed(2)} · Refunded: {Number(payment.amount_refunded).toFixed(2)}</p>
        <p className="text-sm">Method: {payment.gateway} · Transaction: {payment.gateway_payment_id ?? '-'} · {payment.paid_at ? new Date(payment.paid_at).toLocaleString() : '-'}</p>
        {isPending(payment.status) && payment.checkout_url && <p className="mt-3 text-sm text-amber-800">Payment is pending verification. <a className="font-semibold underline" href={payment.checkout_url}>Continue to secure checkout</a>{payment.expires_at && <> · Expires {new Date(payment.expires_at).toLocaleString()}</>}</p>}
        {paid && <div className="mt-3 flex gap-3 text-sm">{receipt && <a className="underline" href={`/api/participant/payments/${payment.id}/receipt`}>Download Receipt</a>}{invoice && <a className="underline" href={`/api/participant/payments/${payment.id}/invoice`}>Download Invoice</a>}</div>}
      </article>;
    }))}</div> : <p className="rounded border p-6 text-sm">No payment records found.</p>)}
  </main>;
}
