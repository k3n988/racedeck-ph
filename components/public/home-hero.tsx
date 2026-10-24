'use client';

import { useState, type KeyboardEvent } from 'react';
import Link from 'next/link';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { FeaturedPublicEvent } from '@/lib/public/events';

function formatEventDate(value: string) {
  const date = new Date(`${value.slice(0, 10)}T00:00:00+08:00`);
  if (Number.isNaN(date.getTime())) return 'Date to be announced';
  return new Intl.DateTimeFormat('en-PH', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'Asia/Manila' }).format(date);
}

function statusLabel(status: string) {
  if (status === 'closing_soon') return 'Closing Soon';
  return status.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function statusStyle(status: string) {
  if (status === 'open') return 'bg-emerald-50 text-emerald-800';
  if (status === 'closing_soon') return 'bg-orange-100 text-orange-900';
  return 'bg-white/90 text-slate-800';
}

export function HomeHero({ events }: { events: FeaturedPublicEvent[] }) {
  const [activeIndex, setActiveIndex] = useState(0);
  const event = events[activeIndex];
  const multipleEvents = events.length > 1;

  function move(direction: number) {
    setActiveIndex((current) => (current + direction + events.length) % events.length);
  }

  function handleKeyDown(keyEvent: KeyboardEvent<HTMLElement>) {
    if (!multipleEvents) return;
    if (keyEvent.key === 'ArrowLeft') {
      keyEvent.preventDefault();
      move(-1);
    }
    if (keyEvent.key === 'ArrowRight') {
      keyEvent.preventDefault();
      move(1);
    }
  }

  if (!event) {
    return (
      <section aria-labelledby="home-hero-title" className="home-hero relative min-h-[260px] overflow-hidden rounded-2xl bg-[#071b41] shadow-sm sm:min-h-[280px]">
        <div aria-hidden="true" className="absolute inset-0 bg-[radial-gradient(circle_at_84%_14%,rgba(247,165,97,.38),transparent_23%),linear-gradient(110deg,#061633,#0a2859_60%,#8c3e24)]" />
        <div className="relative flex min-h-[260px] max-w-3xl flex-col justify-center px-6 py-8 text-white sm:min-h-[280px] sm:px-9 sm:py-9">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-orange-200">RaceDeck PH</p>
          <h1 id="home-hero-title" className="mt-3 text-3xl font-extrabold leading-tight sm:text-4xl">Find your next race.</h1>
          <p className="mt-3 max-w-xl text-sm leading-6 text-slate-100 sm:text-base">Discover upcoming runs, explore exciting events, and register for your next challenge.</p>
          <a href="#home-events" className="mt-6 inline-flex min-h-11 w-fit items-center rounded-lg bg-orange-600 px-5 py-2.5 text-sm font-bold text-white transition hover:bg-orange-700 focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-orange-600">Browse Events <span aria-hidden="true" className="ml-2">→</span></a>
        </div>
      </section>
    );
  }

  const statusClass = statusStyle(event.registration_availability);

  return (
    <section
      aria-label="Featured running events"
      aria-roledescription={multipleEvents ? 'carousel' : undefined}
      tabIndex={multipleEvents ? 0 : undefined}
      onKeyDown={handleKeyDown}
      className="home-hero group relative min-h-[260px] overflow-hidden rounded-2xl bg-[#071b41] shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:ring-offset-2 sm:min-h-[280px]"
    >
      <div aria-hidden="true" className="absolute inset-0 bg-[radial-gradient(circle_at_84%_14%,rgba(247,165,97,.38),transparent_23%),linear-gradient(110deg,#061633,#0a2859_60%,#8c3e24)]" />
      {event.banner_url && <div key={event.id} className="motion-safe:animate-[heroFade_220ms_ease-out] absolute inset-y-0 right-0 w-full sm:w-[58%]">
        <img src={event.banner_url} alt="" className="h-full w-full object-cover object-center" />
        <div aria-hidden="true" className="absolute inset-0 bg-gradient-to-r from-[#061633] via-[#061633]/75 to-[#061633]/10 sm:via-[#061633]/55" />
      </div>}
      <div key={`${event.id}-content`} className="motion-safe:animate-[heroFade_220ms_ease-out] relative flex min-h-[260px] max-w-3xl flex-col justify-center px-6 py-8 text-white sm:min-h-[280px] sm:px-9 sm:py-9">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-orange-200">Featured Race</p>
        <h1 className="mt-3 line-clamp-2 text-3xl font-extrabold leading-tight sm:text-4xl">{event.name}</h1>
        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-slate-100">
          <span>{formatEventDate(event.event_date)}</span>
          <span className="hidden text-white/60 sm:inline" aria-hidden="true">·</span>
          <span className="max-w-xl truncate">{event.venue ?? event.address ?? 'Location to be announced'}</span>
        </div>
        <div className="mt-3">
          <span className={`inline-flex rounded-full px-3 py-1 text-xs font-bold ${statusClass}`}>{statusLabel(event.registration_availability)}</span>
        </div>
        <div className="mt-5 flex flex-wrap gap-3 pb-10 sm:pb-0">
          {event.registration_enabled && <Link href={`/events/${event.id}/register`} className="inline-flex min-h-11 items-center rounded-lg bg-orange-600 px-5 py-2.5 text-sm font-bold text-white transition hover:bg-orange-700 focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-orange-600">Register Now <span aria-hidden="true" className="ml-2">→</span></Link>}
          <Link href={`/events/${event.slug}`} className="inline-flex min-h-11 items-center rounded-lg border border-white/75 px-5 py-2.5 text-sm font-bold text-white transition hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-[#0a2859]">View Details</Link>
        </div>
      </div>
      {multipleEvents && <>
        <div className="absolute bottom-3 right-3 z-10 flex items-center gap-2 sm:bottom-5 sm:right-6">
          <button type="button" onClick={() => move(-1)} aria-label="Previous featured event" className="grid h-9 w-9 place-items-center rounded-full border border-white/50 bg-[#071b41]/75 text-white transition hover:bg-[#071b41] focus:outline-none focus:ring-2 focus:ring-white"><ChevronLeft aria-hidden="true" className="h-5 w-5" /></button>
          <div className="flex items-center gap-1.5" aria-label={`Slide ${activeIndex + 1} of ${events.length}`}>
            {events.map((item, index) => <button key={item.id} type="button" onClick={() => setActiveIndex(index)} aria-label={`Show featured event ${index + 1}: ${item.name}`} aria-current={index === activeIndex ? 'true' : undefined} className={`h-2.5 rounded-full transition-[width,background-color] focus:outline-none focus:ring-2 focus:ring-white motion-reduce:transition-none ${index === activeIndex ? 'w-6 bg-white' : 'w-2.5 bg-white/60 hover:bg-white'}`} />)}
          </div>
          <button type="button" onClick={() => move(1)} aria-label="Next featured event" className="grid h-9 w-9 place-items-center rounded-full border border-white/50 bg-[#071b41]/75 text-white transition hover:bg-[#071b41] focus:outline-none focus:ring-2 focus:ring-white"><ChevronRight aria-hidden="true" className="h-5 w-5" /></button>
        </div>
        <span className="sr-only" aria-live="polite" aria-atomic="true">Featured event {activeIndex + 1} of {events.length}: {event.name}</span>
      </>}
    </section>
  );
}
