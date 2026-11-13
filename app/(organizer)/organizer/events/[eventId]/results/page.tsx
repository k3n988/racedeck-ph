'use client';

import { ToastFeedback } from '@/components/toast-feedback';
import { FormEvent, useState } from 'react';

type Batch = { id: string; validation_status: string; publication_status: string; row_count: number; valid_row_count: number; unmatched_row_count: number };
type Preview = { id: string; source_row_number: number; source_bib: string; corrected_bib?: string; validation_status: string; participant_display_name: string | null; result_status: string };

const controlClass = 'min-h-11 rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-orange-500 focus:ring-4 focus:ring-orange-100 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500';
const statusClass = (status: string) => status === 'valid' || status === 'published' ? 'bg-emerald-50 text-emerald-700' : status === 'unmatched' || status === 'invalid' ? 'bg-amber-50 text-amber-800' : 'bg-slate-100 text-slate-600';

export default function OrganizerEventResultsPage({ params }: { params: { eventId: string } }) {
  const [batch, setBatch] = useState<Batch | null>(null);
  const [preview, setPreview] = useState<Preview[]>([]);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [editingRow, setEditingRow] = useState<string | null>(null);
  const [bibDraft, setBibDraft] = useState('');

  async function upload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    setBusy(true);
    setMessage('');
    try {
      const response = await fetch(`/api/organizer/events/${params.eventId}/results`, { method: 'POST', body: new FormData(form) });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error ?? 'Results could not be imported.');
      setBatch(body.batch);
      setPreview(body.preview ?? []);
      setEditingRow(null);
      form.reset();
      setMessage('Results validated. Correct unmatched bibs or exclude those rows before publishing.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Results could not be imported.');
    } finally {
      setBusy(false);
    }
  }

  async function correct(row: Preview, correctedBib = '', exclude = false) {
    if (!batch) return;
    setBusy(true);
    setMessage('');
    try {
      const response = await fetch(`/api/organizer/events/${params.eventId}/results`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ batch_id: batch.id, result_id: row.id, bib_code: correctedBib.trim(), exclude }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error ?? 'Result row could not be updated.');
      const nextPreview = preview.map((item) => item.id === row.id ? {
        ...item,
        corrected_bib: exclude ? undefined : correctedBib.trim(),
        validation_status: exclude ? 'excluded' : 'valid',
        participant_display_name: exclude ? 'Excluded from publication' : 'Matched to registration',
      } : item);
      setPreview(nextPreview);
      setBatch({
        ...batch,
        valid_row_count: nextPreview.filter((item) => item.validation_status === 'valid').length,
        unmatched_row_count: body.unmatched_row_count,
        validation_status: body.unmatched_row_count ? 'invalid' : 'valid',
      });
      setEditingRow(null);
      setMessage(exclude ? 'Row excluded from published results.' : 'Bib corrected and matched to a registration.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Result row could not be updated.');
    } finally {
      setBusy(false);
    }
  }

  async function publish() {
    if (!batch || batch.unmatched_row_count > 0 || batch.valid_row_count === 0 || batch.publication_status === 'published') return;
    if (!window.confirm('Publish these results and queue notifications for participants with matched results?')) return;
    setBusy(true);
    setMessage('');
    try {
      const response = await fetch(`/api/organizer/events/${params.eventId}/results`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ batch_id: batch.id }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error ?? 'Results could not be published.');
      setBatch({ ...batch, publication_status: 'published' });
      setMessage(`Results published. Notifications were queued for ${body.notified_participants ?? 0} participant${body.notified_participants === 1 ? '' : 's'}.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Results could not be published.');
    } finally {
      setBusy(false);
    }
  }

  const validCount = preview.filter((row) => row.validation_status === 'valid').length;
  const unmatchedCount = preview.filter((row) => row.validation_status === 'unmatched').length;
  const excludedCount = preview.filter((row) => row.validation_status === 'excluded').length;

  return <main className="min-h-full bg-[#f4f6fa] px-4 py-6 sm:px-6 lg:px-8">
    <div className="mx-auto max-w-7xl space-y-6">
      <header className="border-b border-slate-200 pb-5">
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-orange-600">Event operations</p>
        <h1 className="mt-1 text-2xl font-extrabold tracking-tight text-[#071b41] sm:text-3xl">Results</h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">Import a CSV, match each result to an active participant bib, review the preview, then publish when every row is resolved.</p>
      </header>

      {message && <ToastFeedback message={String(message)} tone="auto" />}

      <form onSubmit={(event) => void upload(event)} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <div className="mb-5"><h2 className="text-lg font-bold text-[#071b41]">Import results CSV</h2><p className="mt-1 text-sm text-slate-600">Required column: <code className="rounded bg-slate-100 px-1.5 py-0.5 text-xs">bib</code> or <code className="rounded bg-slate-100 px-1.5 py-0.5 text-xs">bib_number</code>. Optional columns: <code className="rounded bg-slate-100 px-1.5 py-0.5 text-xs">status</code> and <code className="rounded bg-slate-100 px-1.5 py-0.5 text-xs">gun_time</code>.</p></div>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <label className="block min-w-0 flex-1 text-sm font-semibold text-slate-700">CSV file
            <input required name="file" type="file" accept=".csv,text/csv" disabled={busy} className={`${controlClass} mt-1.5 h-auto file:mr-3 file:rounded-lg file:border-0 file:bg-slate-100 file:px-3 file:py-1.5 file:text-xs file:font-bold file:text-slate-700`} />
          </label>
          <button disabled={busy} className="min-h-11 shrink-0 rounded-xl bg-orange-600 px-5 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-orange-700 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-orange-200 disabled:cursor-wait disabled:opacity-60">{busy ? 'Working…' : 'Upload and validate'}</button>
        </div>
      </form>

      {batch && <>
        <section aria-label="Results batch summary" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <SummaryCard label="Source rows" value={batch.row_count.toLocaleString()} />
          <SummaryCard label="Matched" value={validCount.toLocaleString()} tone="success" />
          <SummaryCard label="Unmatched" value={unmatchedCount.toLocaleString()} tone={unmatchedCount ? 'warning' : 'neutral'} />
          <SummaryCard label="Excluded" value={excludedCount.toLocaleString()} />
        </section>

        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-col gap-3 border-b border-slate-100 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
            <div><div className="flex flex-wrap items-center gap-2"><h2 className="text-lg font-bold text-[#071b41]">Review results</h2><span className={`rounded-full px-2.5 py-1 text-xs font-bold capitalize ${statusClass(batch.publication_status === 'published' ? 'published' : batch.validation_status)}`}>{batch.publication_status === 'published' ? 'Published' : batch.validation_status}</span></div><p className="mt-1 text-sm text-slate-600">{unmatchedCount ? 'Every unmatched row must be corrected or excluded before publishing.' : 'All remaining rows are matched and ready to publish.'}</p></div>
            <button type="button" disabled={busy || unmatchedCount > 0 || validCount === 0 || batch.publication_status === 'published'} onClick={() => void publish()} className="min-h-11 shrink-0 rounded-xl bg-[#0b2b5b] px-4 py-2.5 text-sm font-bold text-white transition hover:bg-[#123b78] disabled:cursor-not-allowed disabled:opacity-50">{batch.publication_status === 'published' ? 'Results published' : busy ? 'Publishing…' : 'Publish results'}</button>
          </div>
          {preview.length === 0 ? <p className="p-8 text-center text-sm text-slate-600">This batch has no remaining result rows.</p> : <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500"><tr><th className="px-5 py-3">CSV row</th><th className="px-5 py-3">Bib</th><th className="px-5 py-3">Participant match</th><th className="px-5 py-3">Result</th><th className="px-5 py-3">Validation</th><th className="px-5 py-3">Actions</th></tr></thead>
              <tbody className="divide-y divide-slate-100">{preview.map((row) => <tr key={row.id} className="text-slate-700 hover:bg-slate-50/70">
                <td className="px-5 py-3.5">{row.source_row_number}</td>
                <td className="px-5 py-3.5 font-mono font-bold text-[#0b2b5b]">{row.corrected_bib ?? row.source_bib}</td>
                <td className="px-5 py-3.5">{row.participant_display_name ?? 'No participant match'}</td>
                <td className="px-5 py-3.5 uppercase">{row.result_status}</td>
                <td className="px-5 py-3.5"><span className={`rounded-full px-2.5 py-1 text-xs font-bold capitalize ${statusClass(row.validation_status)}`}>{row.validation_status}</span></td>
                <td className="px-5 py-3.5">{row.validation_status === 'unmatched' && batch.publication_status !== 'published' ? editingRow === row.id ? <div className="flex min-w-64 items-center gap-2"><input aria-label={`Correct bib for CSV row ${row.source_row_number}`} value={bibDraft} onChange={(event) => setBibDraft(event.target.value)} className="min-h-9 w-32 rounded-lg border border-slate-300 px-2 text-sm focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-100" /><button type="button" disabled={busy || !bibDraft.trim()} onClick={() => void correct(row, bibDraft)} className="rounded-lg bg-orange-600 px-2.5 py-2 text-xs font-bold text-white disabled:opacity-50">Save</button><button type="button" disabled={busy} onClick={() => setEditingRow(null)} className="rounded-lg border border-slate-300 px-2.5 py-2 text-xs font-semibold text-slate-700">Cancel</button></div> : <div className="flex gap-2"><button type="button" disabled={busy} onClick={() => { setEditingRow(row.id); setBibDraft(row.source_bib); }} className="rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs font-semibold text-[#0b2b5b] hover:bg-slate-50 disabled:opacity-50">Correct bib</button><button type="button" disabled={busy} onClick={() => void correct(row, '', true)} className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-semibold text-slate-600 hover:border-red-300 hover:bg-red-50 hover:text-red-700 disabled:opacity-50">Exclude</button></div> : '—'}</td>
              </tr>)}</tbody>
            </table>
          </div>}
        </section>
      </>}
    </div>
  </main>;
}

function SummaryCard({ label, value, tone = 'neutral' }: { label: string; value: string; tone?: 'neutral' | 'success' | 'warning' }) {
  const iconTone = tone === 'success' ? 'bg-emerald-50 text-emerald-700' : tone === 'warning' ? 'bg-amber-50 text-amber-800' : 'bg-slate-100 text-slate-600';
  return <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><p className="text-sm font-medium text-slate-500">{label}</p><p className="mt-2 flex items-center gap-2 text-2xl font-extrabold text-[#071b41]"><span className={`h-2.5 w-2.5 rounded-full ${iconTone}`} aria-hidden="true" />{value}</p></article>;
}
