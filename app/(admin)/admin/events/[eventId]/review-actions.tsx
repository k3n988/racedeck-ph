'use client';

import { ToastFeedback } from '@/components/toast-feedback';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

type Decision = 'approved' | 'needs_changes' | 'rejected';
const labels: Record<Decision, string> = {
  approved: 'Approve event',
  needs_changes: 'Request changes',
  rejected: 'Reject event',
};

export default function EventReviewActions({ eventId, reviewStatus, reviewBlocked = false }: { eventId: string; reviewStatus: string; reviewBlocked?: boolean }) {
  const router = useRouter();
  const [feedback, setFeedback] = useState('');
  const [decision, setDecision] = useState<Decision | null>(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState(false);
  const [busy, setBusy] = useState(false);

  if (reviewStatus !== 'pending_review') return null;

  async function submit() {
    if (!decision) return;
    if (decision !== 'approved' && !feedback.trim()) {
      setMessage('Explain what the organizer needs to change or why the event is rejected.');
      setError(true);
      return;
    }
    setBusy(true);
    setMessage('');
    try {
      const response = await fetch(`/api/admin/events/${eventId}/review`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ decision, feedback: feedback.trim() || null }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error ?? 'Review could not be saved.');
      setMessage(`Decision saved: ${decision.replaceAll('_', ' ')}. The organizer can see this result.`);
      setError(false);
      setDecision(null);
      router.refresh();
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : 'Review could not be saved.');
      setError(true);
    } finally {
      setBusy(false);
    }
  }

  return <section aria-label="Event review decision" className="rounded-xl border border-orange-200 bg-white p-5 shadow-sm">
    <h2 className="font-extrabold text-[#071b41]">Review decision</h2>
    <p className="mt-1 text-sm text-slate-600">Check the event details, artwork, categories, and registration dates before deciding.</p>
    {reviewBlocked && <p role="alert" className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">Race categories could not be loaded. Refresh before making a decision.</p>}
    <label htmlFor="review-feedback" className="mt-4 block text-sm font-semibold text-[#071b41]">Feedback to organizer <span className="font-normal text-slate-500">(required for changes or rejection)</span></label>
    <textarea id="review-feedback" value={feedback} onChange={(event) => setFeedback(event.target.value)} maxLength={5000} rows={4} disabled={busy} className="mt-2 w-full rounded-lg border border-slate-300 p-3 text-sm focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-100" placeholder="Give specific, actionable feedback." />
    <p className="mt-1 text-right text-xs text-slate-500">{feedback.length}/5000</p>
    <div className="mt-3 flex flex-wrap gap-2">
      {(['approved', 'needs_changes', 'rejected'] as const).map((option) => <button key={option} type="button" disabled={busy || reviewBlocked} onClick={() => { setDecision(option); setMessage(''); }} className={`rounded-lg border px-3 py-2 text-sm font-bold disabled:opacity-50 ${decision === option ? option === 'approved' ? 'border-emerald-700 bg-emerald-700 text-white' : option === 'rejected' ? 'border-red-700 bg-red-700 text-white' : 'border-orange-600 bg-orange-600 text-white' : 'border-slate-300 text-slate-700 hover:border-orange-300'}`}>{labels[option]}</button>)}
    </div>
    {decision && <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-4">
      <p className="text-sm font-bold text-[#071b41]">Confirm: {labels[decision]}</p>
      <p className="mt-1 text-sm text-slate-600">{decision === 'approved' ? 'The organizer can publish this event after approval. It will not go public automatically.' : decision === 'needs_changes' ? 'The organizer can edit the event and submit it again.' : 'The organizer will see your rejection and feedback.'}</p>
      <div className="mt-3 flex gap-2"><button type="button" disabled={busy || reviewBlocked || (decision !== 'approved' && !feedback.trim())} onClick={() => void submit()} className="rounded-lg bg-[#071b41] px-4 py-2 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-50">{busy ? 'Saving…' : 'Confirm decision'}</button><button type="button" disabled={busy} onClick={() => setDecision(null)} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700">Cancel</button></div>
    </div>}
    {message && <ToastFeedback message={String(message)} tone="error"><p role={error ? 'alert' : 'status'} className={`mt-3 text-sm ${error ? 'text-red-700' : 'text-emerald-700'}`}>{message}</p></ToastFeedback>}
  </section>;
}
