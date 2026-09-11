import Link from 'next/link';

export function AdminPage({ eyebrow = 'RaceDeck platform', title, description, action, children }: { eyebrow?: string; title: string; description: string; action?: React.ReactNode; children: React.ReactNode }) {
  return <main className="min-h-screen bg-[#f4f6fa] px-4 py-6 text-slate-900 sm:px-6 lg:px-8"><div className="mx-auto max-w-[1500px] space-y-6"><div className="flex flex-wrap items-end justify-between gap-4"><div><p className="text-[11px] font-extrabold uppercase tracking-[0.2em] text-orange-600">{eyebrow}</p><h1 className="mt-1 text-2xl font-black tracking-tight text-[#071b41] sm:text-3xl">{title}</h1><p className="mt-1 max-w-2xl text-sm text-slate-500">{description}</p></div>{action}</div>{children}</div></main>;
}

export function StatCard({ label, value, detail, tone = 'plain' }: { label: string; value: React.ReactNode; detail?: string; tone?: 'plain' | 'orange' | 'green' | 'amber' }) {
  const colors = { plain: 'border-slate-200 bg-white', orange: 'border-orange-200 bg-orange-50', green: 'border-emerald-200 bg-emerald-50', amber: 'border-amber-200 bg-amber-50' };
  return <div className={`rounded-xl border p-4 shadow-sm ${colors[tone]}`}><p className="text-xs font-bold uppercase tracking-wide text-slate-500">{label}</p><p className="mt-2 text-2xl font-black text-[#071b41]">{value}</p>{detail && <p className="mt-1 text-xs text-slate-500">{detail}</p>}</div>;
}

export function StatusBadge({ value, tone }: { value: string; tone?: 'green' | 'amber' | 'red' | 'blue' | 'slate' }) {
  const inferred = value.includes('approved') || value.includes('active') || value.includes('published') || value.includes('confirmed') || value === 'paid' || value === 'delivered' || value === 'succeeded' || value === 'resolved' ? 'green' : value.includes('pending') || value.includes('draft') || value.includes('processing') || value.includes('open') || value.includes('queued') ? 'amber' : value.includes('failed') || value.includes('rejected') || value.includes('cancelled') || value.includes('suspended') || value.includes('bounced') ? 'red' : 'slate';
  const colors = { green: 'bg-emerald-100 text-emerald-800', amber: 'bg-amber-100 text-amber-800', red: 'bg-red-100 text-red-800', blue: 'bg-blue-100 text-blue-800', slate: 'bg-slate-100 text-slate-700' };
  return <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold capitalize ${colors[tone ?? inferred]}`}>{value.replaceAll('_', ' ')}</span>;
}

export function Toolbar({ placeholder = 'Search...', children }: { placeholder?: string; children?: React.ReactNode }) {
  return <div className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 bg-white p-3 shadow-sm"><input aria-label="Search" placeholder={placeholder} className="min-w-56 flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-100" />{children}<button className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-bold text-slate-700 hover:border-orange-400">Clear filters</button></div>;
}

export function DataTable({ headers, children }: { headers: string[]; children: React.ReactNode }) {
  return <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm"><table className="w-full min-w-[760px] text-left text-sm"><thead className="border-b border-slate-200 bg-slate-50"><tr>{headers.map((header) => <th key={header} className="px-4 py-3 text-xs font-bold uppercase tracking-wide text-slate-500">{header}</th>)}</tr></thead><tbody className="divide-y divide-slate-100">{children}</tbody></table></div>;
}

export function EmptyState({ message, href, label }: { message: string; href?: string; label?: string }) {
  return <div className="rounded-xl border border-dashed border-slate-300 bg-white p-12 text-center"><p className="font-bold text-slate-800">{message}</p>{href && label && <Link href={href} className="mt-4 inline-flex rounded-lg bg-orange-600 px-4 py-2 text-sm font-bold text-white">{label}</Link>}</div>;
}

export function ActionLink({ href, children = 'View' }: { href: string; children?: React.ReactNode }) {
  return <Link href={href} className="font-bold text-orange-600 hover:text-orange-700">{children} →</Link>;
}

export function Money({ value, currency = 'PHP' }: { value: number; currency?: string }) {
  return <span>{new Intl.NumberFormat('en-PH', { style: 'currency', currency, maximumFractionDigits: 2 }).format(Number(value) || 0)}</span>;
}
