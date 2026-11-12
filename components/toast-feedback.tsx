'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle, CheckCircle2, Info, X, XCircle } from 'lucide-react';

export type ToastTone = 'success' | 'error' | 'warning' | 'info' | 'auto';

const styles = {
  success: { className: 'border-emerald-200 bg-emerald-50 text-emerald-900', icon: CheckCircle2 },
  error: { className: 'border-red-200 bg-red-50 text-red-900', icon: XCircle },
  warning: { className: 'border-amber-200 bg-amber-50 text-amber-900', icon: AlertTriangle },
  info: { className: 'border-blue-200 bg-blue-50 text-blue-900', icon: Info },
} as const;

export function ToastFeedback({ message, tone = 'auto', children }: { message: string; tone?: ToastTone; children?: ReactNode }) {
  const [root, setRoot] = useState<HTMLElement | null>(null);
  const [visible, setVisible] = useState(Boolean(message));
  const [closing, setClosing] = useState(false);

  useEffect(() => { setRoot(document.getElementById('racedeck-toast-root')); }, []);
  useEffect(() => {
    if (!message) { setVisible(false); return; }
    setVisible(true);
    setClosing(false);
    const timer = window.setTimeout(() => setClosing(true), 5000);
    return () => window.clearTimeout(timer);
  }, [message]);

  useEffect(() => {
    if (!closing) return;
    const timer = window.setTimeout(() => setVisible(false), 180);
    return () => window.clearTimeout(timer);
  }, [closing]);

  if (!root || !visible || !message) return null;
  const resolvedTone = tone === 'auto'
    ? /failed|could not|unable|invalid|error|denied|timed out/i.test(message) ? 'error'
      : /required|missing|incomplete|before continuing|must |warning/i.test(message) ? 'warning'
        : /saved|updated|created|deleted|uploaded|submitted|published|sent|copied|success|complete/i.test(message) ? 'success' : 'info'
    : tone;
  const style = styles[resolvedTone];
  const Icon = style.icon;
  return createPortal(
    <div role={resolvedTone === 'error' || resolvedTone === 'warning' ? 'alert' : 'status'} className={`racedeck-toast pointer-events-auto flex w-full items-start gap-3 rounded-xl border px-4 py-3 shadow-lg ${closing ? 'racedeck-toast-closing' : ''} ${style.className}`}>
      <Icon size={19} className="mt-0.5 shrink-0" aria-hidden="true" />
      <div className="racedeck-toast-content min-w-0 flex-1 break-words text-sm leading-5">{children ?? message}</div>
      <button type="button" onClick={() => setClosing(true)} className="-mr-1 -mt-1 rounded-md p-1 opacity-60 hover:opacity-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2" aria-label="Dismiss notification"><X size={16} /></button>
    </div>,
    root,
  );
}
