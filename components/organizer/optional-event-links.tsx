'use client';

import { useState } from 'react';
import { optionalEventLinkPlatforms, type OptionalEventLinkPlatform } from '@/lib/events/event-social-links';

type Links = Partial<Record<OptionalEventLinkPlatform, string>>;

export function OptionalEventLinks({ links, onChange, disabled = false }: { links: Links; onChange: (links: Links) => void; disabled?: boolean }) {
  const [platformToAdd, setPlatformToAdd] = useState<OptionalEventLinkPlatform | ''>('');
  const selected = optionalEventLinkPlatforms.filter(({ key }) => key in links);
  const available = optionalEventLinkPlatforms.filter(({ key }) => !(key in links));

  return <div className="space-y-3">
    <div><p className="text-sm font-semibold text-slate-700">More links <span className="font-normal text-slate-500">(optional)</span></p><p className="mt-1 text-xs text-slate-500">Choose a platform to add its link. Only saved links appear on the public event page.</p></div>
    {selected.map(({ key, label }) => <div key={key} className="grid gap-2 sm:grid-cols-[9rem_minmax(0,1fr)_auto] sm:items-end">
      <div className="flex items-center text-sm font-semibold text-slate-700">{label}</div>
      <label className="text-sm font-semibold text-slate-700">{label} URL<input type="url" required value={links[key] ?? ''} onChange={(event) => onChange({ ...links, [key]: event.target.value })} disabled={disabled} maxLength={2048} placeholder={key === 'website' ? 'https://example.com' : `https://${key === 'x' ? 'x' : key}.com`} className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-normal outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-100 disabled:bg-slate-100" /></label>
      <button type="button" disabled={disabled} onClick={() => { const next = { ...links }; delete next[key]; onChange(next); }} className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50">Remove</button>
    </div>)}
    {available.length > 0 && !disabled && <div className="flex flex-wrap items-end gap-2">
      <label className="text-sm font-semibold text-slate-700">Link type<select value={platformToAdd} onChange={(event) => setPlatformToAdd(event.target.value as OptionalEventLinkPlatform | '')} className="mt-1 block min-w-44 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-normal"><option value="">Choose platform</option>{available.map(({ key, label }) => <option key={key} value={key}>{label}</option>)}</select></label>
      <button type="button" disabled={!platformToAdd} onClick={() => { if (!platformToAdd) return; onChange({ ...links, [platformToAdd]: '' }); setPlatformToAdd(''); }} className="rounded-lg border border-orange-300 px-4 py-2 text-sm font-semibold text-orange-700 hover:bg-orange-50 disabled:cursor-not-allowed disabled:opacity-50">+ Add link</button>
    </div>}
  </div>;
}
