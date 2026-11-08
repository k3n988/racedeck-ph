'use client';

export function RetryButton() {
  return <button type="button" onClick={() => window.location.reload()} className="mt-4 inline-flex min-h-10 items-center rounded-lg bg-[#0a2957] px-4 py-2 text-sm font-bold text-white transition hover:bg-[#12396f] focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2">Retry</button>;
}
