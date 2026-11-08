'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

type Decision = 'approved' | 'needs_changes' | 'rejected';
const labels: Record<Decision, string> = { approved: 'Approve organizer', needs_changes: 'Request changes', rejected: 'Reject application' };

export default function OrganizerReviewActions({ organizationId, reviewStatus }: { organizationId: string; reviewStatus: string }) {
  const router = useRouter();
  const [notes, setNotes] = useState('');
  const [decision, setDecision] = useState<Decision | null>(null);
  const [message, setMessage] = useState('');
  const [isError, setIsError] = useState(false);
  const [busy, setBusy] = useState(false);

  if (reviewStatus !== 'pending_review') return message ? <p role={isError ? 'alert' : 'status'} className={`rounded-xl border bg-white p-4 text-sm ${isError ? 'border-red-200 text-red-700' : 'border-emerald-200 text-emerald-800'}`}>{message}</p> : null;

  async function submit() {
    if (!decision) return;
    if (decision !== 'approved' && !notes.trim()) { setMessage('Give the organizer a reason for this decision.'); setIsError(true); return; }
    setBusy(true);
    setMessage('');
    try {
      const response = await fetch(`/api/admin/organizers/${organizationId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: decision, reviewer_notes: notes.trim() || null }) });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error ?? 'Review could not be saved.');
      setMessage(result.warnings?.length ? `Decision saved. Notification issue: ${result.warnings.join(', ')}.` : 'Decision saved. The organizer can see the result.');
      setIsError(false);
      setDecision(null);
      router.refresh();
    } catch (cause) { setMessage(cause instanceof Error ? cause.message : 'Review could not be saved.'); setIsError(true); }
    finally { setBusy(false); }
  }

  return <section aria-label="Organizer review decision" className="rounded-xl border border-orange-200 bg-white p-5 shadow-sm"><h2 className="font-extrabold text-[#071b41]">Review decision</h2><p className="mt-1 text-sm text-slate-600">Check the organization profile and submitted documents before deciding.</p>
    <label htmlFor="organizer-review-notes" className="mt-4 block text-sm font-semibold text-[#071b41]">Feedback to organizer <span className="font-normal text-slate-500">(required for changes or rejection)</span></label>
    <textarea id="organizer-review-notes" value={notes} onChange={(event) => setNotes(event.target.value)} rows={4} maxLength={5000} disabled={busy} placeholder="Give specific, actionable feedback." className="mt-2 w-full rounded-lg border border-slate-300 p-3 text-sm focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-100" />
    <p className="mt-1 text-right text-xs text-slate-500">{notes.length}/5000</p>
    <div className="mt-3 flex flex-wrap gap-2">{(['approved', 'needs_changes', 'rejected'] as const).map((option) => <button key={option} type="button" disabled={busy} onClick={() => { setDecision(option); setMessage(''); }} className={`rounded-lg border px-3 py-2 text-sm font-bold disabled:opacity-50 ${decision === option ? option === 'approved' ? 'border-emerald-700 bg-emerald-700 text-white' : option === 'rejected' ? 'border-red-700 bg-red-700 text-white' : 'border-orange-600 bg-orange-600 text-white' : 'border-slate-300 text-slate-700 hover:border-orange-300'}`}>{labels[option]}</button>)}</div>
    {decision && <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-4"><p className="text-sm font-bold text-[#071b41]">Confirm: {labels[decision]}</p><p className="mt-1 text-sm text-slate-600">{decision === 'approved' ? 'This activates the organization and allows it to submit events.' : decision === 'needs_changes' ? 'The organizer can update and resubmit the application.' : 'The organizer will see your rejection reason.'}</p><div className="mt-3 flex gap-2"><button type="button" disabled={busy || (decision !== 'approved' && !notes.trim())} onClick={() => void submit()} className="rounded-lg bg-[#071b41] px-4 py-2 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-50">{busy ? 'Saving…' : 'Confirm decision'}</button><button type="button" disabled={busy} onClick={() => setDecision(null)} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700">Cancel</button></div></div>}
    {message && <p role={isError ? 'alert' : 'status'} className={`mt-3 text-sm ${isError ? 'text-red-700' : 'text-emerald-700'}`}>{message}</p>}
  </section>;
}
