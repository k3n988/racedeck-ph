'use client';

import { useEffect, useState, type FocusEvent, type KeyboardEvent } from 'react';
import Link from 'next/link';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { FeaturedPublicEvent } from '@/lib/public/events';

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
      className="home-hero group relative min-h-[260px] overflow-hidden rounded-2xl bg-white shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:ring-offset-2 sm:h-[290px] sm:min-h-0"
    >
      {event.banner_url && <div key={event.id} className="motion-safe:animate-[heroFade_220ms_ease-out] absolute inset-0 bg-white">
        <img src={event.banner_url} alt={`${event.name} event banner`} className={`h-full w-full ${event.poster_fallback ? 'object-contain p-2' : 'object-cover object-center sm:object-[center_42%]'}`} />
      </div>}
      <div key={`${event.id}-content`} className="motion-safe:animate-[heroFade_220ms_ease-out] absolute bottom-3 left-3 z-10 sm:bottom-5 sm:left-5">
        {event.registration_enabled ? (
          <Link href={`/events/${event.id}/register`} aria-label={`Register for ${event.name}`} className="inline-flex min-h-11 items-center rounded-lg bg-orange-600 px-5 py-2.5 text-sm font-bold text-white shadow-md transition hover:bg-orange-700 focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-orange-600">
            Register Now
          </Link>
        ) : (
          <Link href={`/events/${event.slug}`} aria-label={`View details for ${event.name}`} className="inline-flex min-h-11 items-center rounded-lg bg-orange-600 px-5 py-2.5 text-sm font-bold text-white shadow-md transition hover:bg-orange-700 focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-orange-600">
            View Details
          </Link>
        )}
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
