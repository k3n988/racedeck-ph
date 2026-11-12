'use client';

import { ToastFeedback } from '@/components/toast-feedback';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

type Props = { caseId: string; status: string; resolutionNotes: string | null };
export default function CaseWorkflow({ caseId, status, resolutionNotes }: Props) {
  const [nextStatus, setNextStatus] = useState(status);
  const [notes, setNotes] = useState(resolutionNotes ?? '');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const router = useRouter();
  async function save() {
    setSaving(true); setError('');
    try {
      const response = await fetch(`/api/admin/support/${caseId}`, { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ status: nextStatus, resolution_notes: notes }) });
      const payload = await response.json() as { error?: string };
      if (!response.ok) throw new Error(payload.error ?? 'Case could not be saved.');
      router.refresh();
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Case could not be saved.'); }
    finally { setSaving(false); }
  }
  const closed = status === 'closed';
  return <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div><h2 className="font-bold text-[#071b41]">Case workflow</h2><p className="mt-1 text-sm text-slate-500">Resolution notes are required before a case can be resolved. Closed cases cannot be reopened.</p></div><label className="grid max-w-sm gap-1 text-sm font-semibold">Status<select disabled={closed} value={nextStatus} onChange={(event) => setNextStatus(event.target.value)} className="rounded-lg border border-slate-300 px-3 py-2 font-normal"><option value="open">Open</option><option value="in_progress">In progress</option><option value="resolved">Resolved</option>{status === 'closed' && <option value="closed">Closed</option>}</select></label><label className="grid gap-1 text-sm font-semibold">Resolution notes<textarea disabled={closed} value={notes} onChange={(event) => setNotes(event.target.value)} maxLength={5000} rows={4} placeholder="Record the outcome or next action…" className="rounded-lg border border-slate-300 px-3 py-2 font-normal disabled:bg-slate-100" /></label>{error && <ToastFeedback message={String(error)} tone="error"><p role="alert" className="text-sm text-red-700">{error}</p></ToastFeedback>}<button type="button" onClick={save} disabled={saving || closed} className="rounded-lg bg-orange-600 px-4 py-2.5 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-50">{saving ? 'Saving…' : 'Save case update'}</button></section>;
}
