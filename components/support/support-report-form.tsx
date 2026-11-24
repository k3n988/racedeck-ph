'use client';

import { useState, type FormEvent } from 'react';

const categories = [
  ['general_account', 'Account'],
  ['event', 'Event'],
  ['registration', 'Registration'],
  ['payment', 'Payment'],
  ['refund', 'Refund'],
  ['race_kit', 'Race kit'],
] as const;

export default function SupportReportForm({ organizer, email }: { organizer: boolean; email: string }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [reference, setReference] = useState('');

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError('');
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    try {
      const response = await fetch('/api/support-cases', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          case_type: form.get('case_type'),
          subject: form.get('subject'),
          description: form.get('description'),
          email: String(form.get('email') ?? ''),
          registration_number: String(form.get('registration_number') ?? ''),
        }),
      });
      const body = await response.json().catch(() => ({})) as { error?: string; case_reference?: string };
      if (!response.ok || !body.case_reference) {
        setError(body.error ?? 'Your report could not be submitted. Please try again.');
        return;
      }
      setReference(body.case_reference);
      formElement.reset();
    } catch {
      setError('Your report could not be submitted. Check your connection and try again.');
    } finally {
      setBusy(false);
    }
  }

  if (reference) return (
    <section role="status" className="rounded-2xl border border-emerald-200 bg-white p-6 shadow-sm">
      <p className="text-lg font-bold text-[#071b41]">Your report was submitted.</p>
      <p className="mt-2 text-sm text-slate-600">Save this reference so you can include it if you contact us again:</p>
      <p className="mt-3 inline-block rounded-lg bg-emerald-50 px-3 py-2 font-mono text-sm font-bold text-emerald-800">{reference}</p>
      <button type="button" onClick={() => setReference('')} className="mt-5 block text-sm font-bold text-orange-700 hover:text-orange-800">Submit another report</button>
    </section>
  );

  return (
    <form onSubmit={submit} className="space-y-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
      {!organizer && <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="support-email" className="mb-1.5 block text-sm font-semibold text-slate-700">Registration email</label>
          <input id="support-email" name="email" type="email" required defaultValue={email} maxLength={320} autoComplete="email" className="w-full rounded-lg border border-slate-300 px-3.5 py-3 text-sm outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-100" />
        </div>
        <div>
          <label htmlFor="support-registration" className="mb-1.5 block text-sm font-semibold text-slate-700">Registration number</label>
          <input id="support-registration" name="registration_number" required maxLength={80} placeholder="REG-2026-123456" className="w-full rounded-lg border border-slate-300 px-3.5 py-3 text-sm outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-100" />
        </div>
      </div>}
      <div>
        <label htmlFor="support-category" className="mb-1.5 block text-sm font-semibold text-slate-700">Issue type</label>
        <select id="support-category" name="case_type" defaultValue="general_account" className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-3 text-sm outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-100">
          {categories.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
      </div>
      <div>
        <label htmlFor="support-subject" className="mb-1.5 block text-sm font-semibold text-slate-700">Subject</label>
        <input id="support-subject" name="subject" required minLength={4} maxLength={160} placeholder="Briefly describe the issue" className="w-full rounded-lg border border-slate-300 px-3.5 py-3 text-sm outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-100" />
      </div>
      <div>
        <label htmlFor="support-description" className="mb-1.5 block text-sm font-semibold text-slate-700">What happened?</label>
        <textarea id="support-description" name="description" required minLength={10} maxLength={5000} rows={6} placeholder="Include the details that will help our support team review your report." className="w-full resize-y rounded-lg border border-slate-300 px-3.5 py-3 text-sm outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-100" />
      </div>
      {error && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      <button type="submit" disabled={busy} className="rounded-lg bg-[#071b41] px-5 py-3 text-sm font-bold text-white hover:bg-[#102b58] disabled:cursor-wait disabled:opacity-60">{busy ? 'Submitting...' : 'Submit report'}</button>
    </form>
  );
}
