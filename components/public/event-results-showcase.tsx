'use client';

import { ArrowDown, Award, CalendarDays, ChevronDown, ChevronUp } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import type { PublicWinnerGroup } from '@/lib/public/events';

type Props = {
  eventName: string;
  eventDate: string;
  bannerUrl: string | null;
  groups: PublicWinnerGroup[];
  children?: ReactNode;
  showFullResults?: boolean;
};

const fallbackAccent = '#0b2b5b';

function sampleBannerColor(url: string, onColor: (color: string) => void) {
  const image = new Image();
  image.crossOrigin = 'anonymous';
  image.onload = () => {
    try {
      const canvas = document.createElement('canvas');
      canvas.width = 32;
      canvas.height = 18;
      const context = canvas.getContext('2d', { willReadFrequently: true });
      if (!context) return;
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
      const colors = new Map<string, number>();
      for (let index = 0; index < pixels.length; index += 4) {
        const red = pixels[index];
        const green = pixels[index + 1];
        const blue = pixels[index + 2];
        const alpha = pixels[index + 3];
        if (alpha < 180) continue;
        const maximum = Math.max(red, green, blue);
        const minimum = Math.min(red, green, blue);
        const brightness = (red + green + blue) / 3;
        if (maximum - minimum < 34 || brightness < 38 || brightness > 238) continue;
        const key = [red, green, blue].map((channel) => Math.round(channel / 24) * 24).map((channel) => Math.min(255, channel).toString(16).padStart(2, '0')).join('');
        colors.set(key, (colors.get(key) ?? 0) + 1);
      }
      const dominant = Array.from(colors.entries()).sort((left, right) => right[1] - left[1])[0]?.[0];
      if (dominant) onColor(`#${dominant}`);
    } catch {
      // Cross-origin banners may block canvas sampling; keep the accessible fallback palette.
    }
  };
  image.src = url;
}

function formatDate(value: string) {
  const date = new Date(`${value.slice(0, 10)}T00:00:00+08:00`);
  return Number.isNaN(date.getTime()) ? '' : new Intl.DateTimeFormat('en-PH', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'Asia/Manila' }).format(date);
}

function darken(hex: string, factor = 0.5) {
  const rgb = hex.replace('#', '').match(/.{2}/g)?.map((part) => Math.round(parseInt(part, 16) * factor)) ?? [11, 43, 91];
  return `#${rgb.map((channel) => channel.toString(16).padStart(2, '0')).join('')}`;
}

const medalStyles = [
  'border-amber-400 bg-gradient-to-br from-yellow-200 to-amber-500 text-amber-950',
  'border-slate-300 bg-gradient-to-br from-slate-100 to-slate-400 text-slate-900',
  'border-orange-400 bg-gradient-to-br from-orange-200 to-amber-700 text-orange-950',
];

export function EventResultsShowcase({ eventName, eventDate, bannerUrl, groups, children, showFullResults = Boolean(children) }: Props) {
  const [accent, setAccent] = useState(fallbackAccent);
  const [expandedGroups, setExpandedGroups] = useState<string[]>([]);
  useEffect(() => {
    if (bannerUrl) sampleBannerColor(bannerUrl, setAccent);
  }, [bannerUrl]);

  const accentDark = darken(accent);
  const date = formatDate(eventDate);

  return <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm" aria-labelledby="event-results-title">
    <header className="relative isolate flex min-h-44 items-end overflow-hidden bg-[#0b2b5b] p-5 sm:min-h-56 sm:p-8" style={{ backgroundColor: accent }}>
      {bannerUrl && <img src={bannerUrl} alt="" aria-hidden="true" className="absolute inset-0 -z-20 h-full w-full object-cover" />}
      <div className="absolute inset-0 -z-10" style={{ background: `linear-gradient(90deg, ${accentDark}f5 0%, ${accentDark}b8 48%, ${accentDark}35 100%)` }} />
      <div className="flex w-full flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0 text-white">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-white/80">Official race results</p>
          <h1 id="event-results-title" className="mt-2 max-w-3xl break-words text-2xl font-extrabold leading-tight sm:text-4xl">{eventName}</h1>
          {date && <p className="mt-3 inline-flex items-center gap-2 text-sm text-white/90"><CalendarDays aria-hidden="true" className="h-4 w-4" />{date}</p>}
        </div>
        {showFullResults && <a href="#full-results" className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-full px-5 py-2.5 text-sm font-bold shadow-sm transition hover:brightness-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2" style={{ backgroundColor: '#ffffff', color: accentDark }}>
          Full results <ArrowDown aria-hidden="true" className="h-4 w-4" />
        </a>}
      </div>
    </header>

    <div className="p-4 sm:p-7">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div><p className="text-xs font-bold uppercase tracking-[0.16em]" style={{ color: accentDark }}>Race podium</p><h2 className="mt-1 text-xl font-extrabold text-[#10213d] sm:text-2xl">Top finishers</h2></div>
        <span className="rounded-full px-3 py-1 text-xs font-bold" style={{ backgroundColor: `${accent}14`, color: accentDark }}>{groups.length} {groups.length === 1 ? 'category' : 'categories'}</span>
      </div>

      {groups.length ? <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        {groups.map((group) => <article key={group.id} className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <header className="flex min-h-[76px] items-center justify-between gap-3 px-4 py-3 text-white" style={{ backgroundColor: accentDark }}>
            <div className="flex min-w-0 items-center gap-3"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-white/15"><Award aria-hidden="true" className="h-5 w-5" /></span><div className="min-w-0"><h3 className="break-words text-base font-bold leading-tight">{group.title}</h3>{group.distance && <span className="mt-1 inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-bold" style={{ backgroundColor: '#ffffff', color: accentDark }}>{group.distance}</span>}</div></div>
            <span className="shrink-0 text-xs font-semibold text-white/80">{group.total} finishers</span>
          </header>
          {group.winners.slice(0, expandedGroups.includes(group.id) ? undefined : 3).map((winner, index) => <div key={`${group.id}-${winner.bib ?? winner.name}-${index}`} className="flex min-h-[65px] items-center gap-3 border-b border-slate-200 px-4 py-3">
            <span aria-label={`Place ${winner.rank}`} className={`grid h-10 w-10 shrink-0 place-items-center rounded-full border-2 text-sm font-extrabold shadow-inner ${medalStyles[index] ?? medalStyles[2]}`}>{winner.rank}</span>
            <span className="w-14 shrink-0 font-mono text-sm text-slate-600">{winner.bib ?? '—'}</span>
            <span className="min-w-0 flex-1 truncate text-sm font-bold text-slate-800">{winner.name}</span>
            <span className="shrink-0 text-xs font-semibold tabular-nums text-slate-500">{winner.finish_time || '—'}</span>
          </div>)}
          {group.winners.length > 3 && <button type="button" aria-expanded={expandedGroups.includes(group.id)} onClick={() => setExpandedGroups((current) => current.includes(group.id) ? current.filter((id) => id !== group.id) : [...current, group.id])} className="m-3 flex min-h-11 w-[calc(100%-1.5rem)] items-center justify-center rounded-lg border px-3 text-sm font-bold transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2" style={{ borderColor: accentDark, color: accentDark }}>
            <Award aria-hidden="true" className="mr-2 h-4 w-4" />{expandedGroups.includes(group.id) ? <>Show fewer winners <ChevronUp className="ml-1 h-4 w-4" /></> : <>View {group.winners.length - 3} more {group.winners.length - 3 === 1 ? 'winner' : 'winners'} <ChevronDown className="ml-1 h-4 w-4" /></>}
          </button>}
        </article>)}
      </div> : <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-5 py-10 text-center"><p className="font-semibold text-slate-800">No finishers to display yet</p><p className="mt-1 text-sm text-slate-500">Published finishing times will appear here.</p></div>}
    </div>

    {showFullResults && <div id="full-results" className="scroll-mt-6 border-t border-slate-200 bg-slate-50/60 p-4 sm:p-7">
      <div className="mb-4"><h2 className="text-xl font-extrabold text-[#10213d]">Full results</h2><p className="mt-1 text-sm text-slate-600">Search all published finishers by participant, bib, or category.</p></div>
      <div className="[&_button]:transition-colors [&_button]:focus-visible:outline-none [&_button]:focus-visible:ring-2 [&_button]:focus-visible:ring-offset-2 [&_button]:disabled:opacity-50 [&_input]:min-h-10 [&_input]:rounded-lg [&_input]:border [&_input]:border-slate-300 [&_input]:bg-white [&_input]:px-3 [&_input]:text-sm [&_input]:text-slate-800 [&_input]:outline-none [&_input]:focus:border-slate-500 [&_input]:focus:ring-2 [&_input]:focus:ring-slate-200">{children}</div>
    </div>}
  </section>;
}
