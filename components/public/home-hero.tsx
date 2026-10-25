'use client';

import { useEffect, useState, type FocusEvent, type KeyboardEvent } from 'react';
import Link from 'next/link';
import { CalendarDays, ChevronLeft, ChevronRight, MapPin } from 'lucide-react';
import type { FeaturedPublicEvent } from '@/lib/public/events';

function formatEventDate(value: string) {
  const date = new Date(`${value.slice(0, 10)}T00:00:00+08:00`);
  if (Number.isNaN(date.getTime())) return 'Date to be announced';
  return new Intl.DateTimeFormat('en-PH', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'Asia/Manila' }).format(date);
}

function statusLabel(status: string) {
  if (status === 'open') return 'Open for Registration';
  if (status === 'not_yet_open') return 'Not Yet Open';
  if (status === 'sold_out') return 'Sold Out';
  if (status === 'closing_soon') return 'Closing Soon';
  if (status === 'closed') return 'Registration Closed';
  return status.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function statusStyle(status: string) {
  if (status === 'open') return 'bg-emerald-50 text-emerald-800';
  if (status === 'closing_soon') return 'bg-orange-100 text-orange-900';
  return 'bg-white/90 text-slate-800';
}

function formatEventLocation(venue: string | null, address: string | null) {
  const venueLabel = venue?.trim();
  const parts = (address ?? '').split(',').map((part) => part.trim()).filter(Boolean);
  const uniqueParts = parts.filter((part, index) => parts.findIndex((item) => item.toLocaleLowerCase() === part.toLocaleLowerCase()) === index);
  const addressParts = uniqueParts.filter((part) => part.toLocaleLowerCase() !== venueLabel?.toLocaleLowerCase());
  if (addressParts.length >= 2) return addressParts.slice(-2).join(', ');
  if (addressParts.length === 1) return addressParts[0];
  return venueLabel ?? address?.trim() ?? 'Location to be announced';
}

export function HomeHero({ events, browseHref = '#home-events' }: { events: FeaturedPublicEvent[]; browseHref?: string }) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const safeIndex = events.length ? activeIndex % events.length : 0;
  const event = events[safeIndex];
  const multipleEvents = events.length > 1;
  const eventIds = events.map((item) => item.id).join('|');

  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const updatePreference = () => setReducedMotion(media.matches);
    updatePreference();
    media.addEventListener('change', updatePreference);
    return () => media.removeEventListener('change', updatePreference);
  }, []);

  useEffect(() => setActiveIndex(0), [eventIds]);

  useEffect(() => {
    if (!multipleEvents || hovered || focused || reducedMotion) return;
    const timer = window.setInterval(() => setActiveIndex((current) => (current + 1) % events.length), 3000);
    return () => window.clearInterval(timer);
  }, [events.length, focused, hovered, multipleEvents, reducedMotion]);

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
      <section aria-labelledby="home-hero-title" className="home-hero relative h-[330px] overflow-hidden rounded-2xl bg-[#071b41] shadow-sm sm:h-[290px]">
        <div aria-hidden="true" className="absolute inset-0 bg-[radial-gradient(circle_at_84%_14%,rgba(247,165,97,.38),transparent_23%),linear-gradient(110deg,#061633,#0a2859_60%,#8c3e24)]" />
        <div className="relative flex h-full max-w-3xl flex-col justify-center px-6 py-5 text-white sm:px-9">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-orange-200">RaceDeck PH</p>
          <h1 id="home-hero-title" className="mt-3 text-3xl font-extrabold leading-tight sm:text-4xl">Find your next race.</h1>
          <p className="mt-3 max-w-xl text-sm leading-6 text-slate-100 sm:text-base">Discover upcoming runs, explore exciting events, and register for your next challenge.</p>
          <a href={browseHref} className="mt-6 inline-flex min-h-11 w-fit items-center rounded-lg bg-orange-600 px-5 py-2.5 text-sm font-bold text-white transition hover:bg-orange-700 focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-orange-600">Browse Events <span aria-hidden="true" className="ml-2">→</span></a>
        </div>
      </section>
    );
  }

  const statusClass = statusStyle(event.registration_availability);

  return (
    <section
      aria-label="Running events"
      aria-roledescription={multipleEvents ? 'carousel' : undefined}
      tabIndex={multipleEvents ? 0 : undefined}
      onKeyDown={handleKeyDown}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocusCapture={() => setFocused(true)}
      onBlurCapture={(focusEvent: FocusEvent<HTMLElement>) => {
        if (!focusEvent.currentTarget.contains(focusEvent.relatedTarget as Node | null)) setFocused(false);
      }}
      className="home-hero group relative min-h-[430px] overflow-hidden rounded-2xl bg-[#071b41] shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:ring-offset-2 sm:h-[290px] sm:min-h-0"
    >
      {event.banner_url && <div key={event.id} className="motion-safe:animate-[heroFade_220ms_ease-out] absolute inset-0 bg-[#061735]">
        <img src={event.banner_url} alt={`${event.name} event poster`} className={`h-full w-full ${event.poster_fallback ? 'object-contain p-2' : 'object-cover object-center sm:object-[center_42%]'}`} />
      </div>}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 sm:hidden" style={{ backgroundImage: 'linear-gradient(0deg, rgba(6,23,53,.98) 0%, rgba(6,23,53,.90) 48%, rgba(6,23,53,.35) 77%, rgba(6,23,53,0) 100%)' }} />
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 hidden sm:block" style={{ backgroundImage: 'linear-gradient(90deg, rgba(6,23,53,.98) 0%, rgba(6,23,53,.94) 30%, rgba(6,23,53,.78) 43%, rgba(6,23,53,.38) 58%, rgba(6,23,53,.08) 75%, rgba(6,23,53,0) 100%)' }} />
      <div key={`${event.id}-content`} className="motion-safe:animate-[heroFade_220ms_ease-out] relative z-[1] flex min-h-[430px] w-full flex-col justify-end px-6 pb-24 pt-8 text-white sm:h-full sm:min-h-0 sm:w-[45%] sm:justify-center sm:px-10 sm:py-6 sm:pb-6">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-orange-200 [text-shadow:0_2px_5px_rgba(0,0,0,0.95)]">Featured Event</p>
        <h1 className="mt-2 line-clamp-3 break-words text-2xl font-extrabold leading-tight [text-shadow:0_2px_7px_rgba(0,0,0,0.95)] sm:line-clamp-2 sm:text-[2rem]">{event.name}</h1>
        <div className="mt-3 grid gap-2 text-sm text-slate-100">
          <div className="flex min-w-0 items-start gap-2.5">
            <CalendarDays aria-hidden="true" className="mt-0.5 h-4 w-4 flex-none text-orange-200" />
            <span className="[text-shadow:0_2px_5px_rgba(0,0,0,0.95)]">{formatEventDate(event.event_date)}</span>
          </div>
          <div className="flex min-w-0 items-start gap-2.5">
            <MapPin aria-hidden="true" className="mt-0.5 h-4 w-4 flex-none text-orange-200" />
            <span className="line-clamp-2 min-w-0 break-words [text-shadow:0_2px_5px_rgba(0,0,0,0.95)]">{formatEventLocation(event.venue, event.address)}</span>
          </div>
        </div>
        <div className="mt-2">
          <span className={`inline-flex rounded-full px-3 py-1 text-xs font-bold ${statusClass}`}>{event.event_period === 'past' ? 'Completed' : statusLabel(event.registration_availability)}</span>
        </div>
        <div className="mt-3 flex flex-wrap gap-3">
          {event.event_period === 'past' && event.results_available
            ? <Link href={`/results?event=${encodeURIComponent(event.id)}`} className="inline-flex min-h-11 items-center rounded-lg bg-orange-600 px-5 py-2.5 text-sm font-bold text-white transition hover:bg-orange-700 focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-orange-600">View Results</Link>
            : <>
              {event.registration_enabled && event.event_period !== 'past' && <Link href={`/events/${event.id}/register`} className="inline-flex min-h-11 items-center rounded-lg bg-orange-600 px-5 py-2.5 text-sm font-bold text-white transition hover:bg-orange-700 focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-orange-600">Register Now <span aria-hidden="true" className="ml-2">→</span></Link>}
              <Link href={`/events/${event.slug}`} className="inline-flex min-h-11 items-center rounded-lg border border-white/75 px-5 py-2.5 text-sm font-bold text-white transition hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-[#0a2859]">View Details</Link>
            </>}
        </div>
      </div>
      {multipleEvents && <>
        <div className="absolute bottom-3 right-3 z-10 flex max-w-[calc(100%-1.5rem)] items-center gap-2 rounded-full bg-[#061633]/70 px-2 py-1.5 backdrop-blur-sm sm:bottom-5 sm:right-6">
          <button type="button" onClick={() => move(-1)} aria-label="Previous featured event" className="grid h-9 w-9 place-items-center rounded-full border border-white/50 bg-[#071b41]/75 text-white transition hover:bg-[#071b41] focus:outline-none focus:ring-2 focus:ring-white"><ChevronLeft aria-hidden="true" className="h-5 w-5" /></button>
          <div className="flex items-center gap-1.5" role="group" aria-label={`Event ${safeIndex + 1} of ${events.length}`}>
            {events.slice(Math.max(0, Math.min(safeIndex - 2, events.length - 5)), Math.max(0, Math.min(safeIndex - 2, events.length - 5)) + Math.min(5, events.length)).map((item, offset) => {
              const index = Math.max(0, Math.min(safeIndex - 2, events.length - 5)) + offset;
              return <button key={item.id} type="button" onClick={() => setActiveIndex(index)} aria-label={`Show event ${index + 1}: ${item.name}`} aria-current={index === safeIndex ? 'true' : undefined} className={`h-2.5 rounded-full transition-[width,background-color] focus:outline-none focus:ring-2 focus:ring-white motion-reduce:transition-none ${index === safeIndex ? 'w-6 bg-white' : 'w-2.5 bg-white/60 hover:bg-white'}`} />;
            })}
          </div>
          <button type="button" onClick={() => move(1)} aria-label="Next featured event" className="grid h-9 w-9 place-items-center rounded-full border border-white/50 bg-[#071b41]/75 text-white transition hover:bg-[#071b41] focus:outline-none focus:ring-2 focus:ring-white"><ChevronRight aria-hidden="true" className="h-5 w-5" /></button>
        </div>
        <span className="sr-only" aria-live={hovered || focused || reducedMotion ? 'polite' : 'off'} aria-atomic="true">Event {safeIndex + 1} of {events.length}: {event.name}</span>
      </>}
    </section>
  );
}
