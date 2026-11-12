'use client';

import { ToastFeedback } from '@/components/toast-feedback';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Trash2 } from 'lucide-react';

export default function DeleteEventButton({ eventId, eventName }: { eventId: string; eventName: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function removeEvent() {
    if (!window.confirm(`Permanently delete “${eventName}”? This cannot be undone. Events with registrations or payment history cannot be deleted.`)) return;

    setBusy(true);
    setError('');
    try {
      const response = await fetch(`/api/admin/events/${eventId}`, { method: 'DELETE' });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error ?? 'Event could not be deleted.');
      router.replace('/admin/events');
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Event could not be deleted.');
    } finally {
      setBusy(false);
    }
  }

  return <div className="flex flex-col items-end gap-2">
    <button type="button" onClick={() => void removeEvent()} disabled={busy} className="inline-flex items-center gap-2 rounded-lg border border-red-200 bg-white px-4 py-2.5 text-sm font-bold text-red-700 hover:border-red-400 hover:bg-red-50 disabled:cursor-wait disabled:opacity-60">
      <Trash2 size={16} aria-hidden="true" />{busy ? 'Deleting…' : 'Delete event'}
    </button>
    {error && <ToastFeedback message={String(error)} tone="error"><p role="alert" className="max-w-72 text-right text-sm text-red-700">{error}</p></ToastFeedback>}
  </div>;
}
