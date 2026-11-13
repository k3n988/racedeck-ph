'use client';

import { ToastFeedback } from '@/components/toast-feedback';
import { useEffect, useState } from 'react';

type OrganizationDataPageProps = {
  title: string;
  endpoint: string;
  columns: string[];
  highlightSummaryKey?: string;
  query?: string;
};

export default function OrganizationDataPage({ title, endpoint, columns, highlightSummaryKey, query }: OrganizationDataPageProps) {
  const [data, setData] = useState<Record<string, unknown> | null>(null);
  const [message, setMessage] = useState('Loading…');

  useEffect(() => {
    let cancelled = false;
    void fetch(`${endpoint}${query ? `?${query}` : ''}`, { cache: 'no-store' })
      .then(async (response) => {
        const body = await response.json();
        if (!response.ok) throw new Error(body.error ?? 'Data could not be loaded.');
        if (!cancelled) { setData(body); setMessage(''); }
      })
      .catch((error) => { if (!cancelled) setMessage(error instanceof Error ? error.message : 'Data could not be loaded.'); });
    return () => { cancelled = true; };
  }, [endpoint, query]);

  const rows = Array.isArray(data?.payments) ? data.payments : Array.isArray(data?.registrations) ? data.registrations : [];
  const summary = data?.summary as Record<string, unknown> | undefined;

  return <main className="mx-auto max-w-7xl space-y-6 p-6">
    <h1 className="text-2xl font-semibold">{title}</h1>
    {message && <ToastFeedback message={String(message)} tone="info"><p role="status">{message}</p></ToastFeedback>}
    {summary && <section className="grid gap-4 md:grid-cols-4">{Object.entries(summary).map(([key, value]) => {
      const selected = key === highlightSummaryKey;
      return <div key={key} aria-current={selected ? 'true' : undefined} className={`rounded border p-4 ${selected ? 'border-orange-400 bg-orange-50 ring-1 ring-orange-200' : ''}`}>
        <p className="text-sm text-gray-600">{key.replaceAll('_', ' ')}{selected && <span className="ml-2 rounded-full bg-orange-100 px-2 py-0.5 text-[10px] font-bold uppercase text-orange-700">Selected</span>}</p>
        <p className="text-xl font-semibold">{typeof value === 'number' ? value.toFixed(2) : String(value)}</p>
      </div>;
    })}</section>}
    {!message && rows.length > 0 && <div className="overflow-x-auto rounded border"><table className="w-full text-left text-sm"><thead className="border-b bg-gray-50"><tr>{columns.map((column) => <th key={column} className="p-3">{column}</th>)}</tr></thead><tbody>{(rows as Record<string, unknown>[]).map((row, index) => <tr key={String(row.id ?? index)} className="border-b">{columns.map((column) => <td key={column} className="p-3">{String(row[column] ?? '—')}</td>)}</tr>)}</tbody></table></div>}
    {!message && rows.length === 0 && !summary && <p className="rounded border p-6 text-sm">No records found.</p>}
  </main>;
}
