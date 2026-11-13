'use client';

import { useState } from 'react';
import { optionalEventLinkPlatforms, type OptionalEventLinkPlatform } from '@/lib/events/event-social-links';

type Links = Partial<Record<OptionalEventLinkPlatform, string>>;

export function OptionalEventLinks({ links, onChange, disabled = false }: { links: Links; onChange: (links: Links) => void; disabled?: boolean }) {
  const [platformToAdd, setPlatformToAdd] = useState<OptionalEventLinkPlatform | ''>('');
  const selected = optionalEventLinkPlatforms.filter(({ key }) => key in links);
  const available = optionalEventLinkPlatforms.filter(({ key }) => !(key in links));

  return <div className="space-y-4">
    {selected.length > 0 && <div className="space-y-3">
      {selected.map(({ key, label }) => <div key={key} className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
        <label className="min-w-0 text-sm font-semibold text-slate-700">{key === 'phone' ? label : `${label} URL`}<input type={key === 'phone' ? 'tel' : 'url'} inputMode={key === 'phone' ? 'tel' : 'url'} required value={links[key] ?? ''} onChange={(event) => onChange({ ...links, [key]: event.target.value })} disabled={disabled} maxLength={key === 'phone' ? 24 : 2048} placeholder={key === 'phone' ? '0917 123 4567' : key === 'website' ? 'https://example.com' : `https://${key === 'x' ? 'x' : key}.com`} className="mt-1.5 block min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-normal outline-none transition focus:border-orange-500 focus:ring-2 focus:ring-orange-100 disabled:bg-slate-100" /></label>
        <button type="button" disabled={disabled} onClick={() => { const next = { ...links }; delete next[key]; onChange(next); }} className="min-h-11 w-full rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50 sm:w-auto">Remove</button>
      </div>)}
    </div>}
    {available.length > 0 && !disabled && <div className="grid gap-2 pt-4 sm:grid-cols-[minmax(0,16rem)_auto] sm:items-end">
      <label className="text-sm font-semibold text-slate-700">Add another link<select value={platformToAdd} onChange={(event) => setPlatformToAdd(event.target.value as OptionalEventLinkPlatform | '')} className="mt-1.5 block min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-normal outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-100"><option value="">Choose platform</option>{available.map(({ key, label }) => <option key={key} value={key}>{label}</option>)}</select></label>
      <button type="button" disabled={!platformToAdd} onClick={() => { if (!platformToAdd) return; onChange({ ...links, [platformToAdd]: '' }); setPlatformToAdd(''); }} className="min-h-11 w-full rounded-lg border border-orange-300 bg-white px-4 py-2 text-sm font-semibold text-orange-700 transition hover:bg-orange-50 disabled:cursor-not-allowed disabled:border-slate-200 disabled:text-slate-400 sm:w-auto">+ Add link</button>
    </div>}
  </div>;
}
