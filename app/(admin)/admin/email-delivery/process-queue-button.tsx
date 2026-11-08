'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { RotateCw } from 'lucide-react';

export default function ProcessQueueButton() {
  const [working, setWorking] = useState(false);
  const [message, setMessage] = useState('');
  const router = useRouter();
  async function processQueue() {
    if (!window.confirm('Process up to 25 queued or retryable emails now? This may send real messages.')) return;
    setWorking(true); setMessage('');
    try {
      const response = await fetch('/api/admin/email-delivery/process', { method: 'POST' });
      const result = await response.json() as { error?: string; accepted?: number; failed?: number; claimed?: number };
      if (!response.ok) throw new Error(result.error ?? 'Email queue could not be processed.');
      setMessage(`Processed ${result.claimed ?? 0} messages · ${result.accepted ?? 0} accepted · ${result.failed ?? 0} failed.`);
      router.refresh();
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Email queue could not be processed.'); }
    finally { setWorking(false); }
  }
  return <div className="flex flex-col items-end gap-2"><button type="button" disabled={working} onClick={processQueue} className="inline-flex items-center gap-2 rounded-lg bg-[#071b41] px-4 py-2.5 text-sm font-bold text-white hover:bg-[#102b5c] disabled:opacity-60"><RotateCw size={16} className={working ? 'animate-spin' : ''} aria-hidden="true" />{working ? 'Processing…' : 'Process email queue'}</button>{message && <p role="status" className="max-w-md text-right text-xs text-slate-600">{message}</p>}</div>;
}
