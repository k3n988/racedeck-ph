'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

type Decision = 'approved' | 'needs_changes' | 'rejected';

export default function EventReviewActions({ eventId, reviewStatus }: { eventId: string; reviewStatus: string }) {
  const router = useRouter();
  const [feedback, setFeedback] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  async function decide(decision: Decision) {
    if (decision !== 'approved' && !feedback.trim()) {
      setMessage('Enter feedback before requesting changes or rejecting the event.');
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
      setMessage(`Event ${decision.replaceAll('_', ' ')}. The organizer can see this decision.`);
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Review could not be saved.');
    } finally {
      setBusy(false);
    }
  }

  if (reviewStatus !== 'pending_review') return null;
  return <div className="space-y-2 rounded-lg border border-orange-200 bg-orange-50 p-3">
    <label className="block text-xs font-semibold text-slate-700">Review feedback
      <textarea value={feedback} onChange={(event) => setFeedback(event.target.value)} maxLength={5000} rows={3} className="mt-1 w-full rounded border border-slate-300 bg-white p-2 text-sm" placeholder="Required when requesting changes or rejecting" />
    </label>
    <div className="flex flex-wrap gap-2">
      <button disabled={busy} onClick={() => void decide('approved')} className="rounded bg-emerald-700 px-3 py-2 text-xs font-bold text-white disabled:opacity-50">Approve</button>
      <button disabled={busy} onClick={() => void decide('needs_changes')} className="rounded bg-orange-600 px-3 py-2 text-xs font-bold text-white disabled:opacity-50">Request changes</button>
      <button disabled={busy} onClick={() => void decide('rejected')} className="rounded bg-red-700 px-3 py-2 text-xs font-bold text-white disabled:opacity-50">Reject</button>
    </div>
    {message && <p role="status" className="text-xs text-slate-700">{message}</p>}
  </div>;
}
