'use client';

import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';

type TrackingIds = { google_analytics_id: string; meta_pixel_id: string };
type Consent = 'unknown' | 'accepted' | 'rejected';
type MetaPixel = ((...args: unknown[]) => void) & {
  callMethod?: (...args: unknown[]) => void;
  queue?: unknown[];
  loaded?: boolean;
  version?: string;
};
type TrackingWindow = Window & {
  dataLayer?: unknown[];
  gtag?: (...args: unknown[]) => void;
  fbq?: MetaPixel;
  _fbq?: MetaPixel;
  __racedeckGoogleId?: string;
  __racedeckMetaId?: string;
};

export function PublicEventTracking() {
  const pathname = usePathname();
  const eventId = pathname.match(/^\/events\/([^/]+)/)?.[1];
  const [consent, setConsent] = useState<Consent>('unknown');

  useEffect(() => {
    const stored = window.localStorage.getItem('racedeck-analytics-consent');
    if (stored === 'accepted' || stored === 'rejected') setConsent(stored);
  }, []);

  useEffect(() => {
    if (!eventId || consent !== 'accepted') return;
    let active = true;
    fetch(`/api/public/events/${encodeURIComponent(eventId)}/tracking`, { cache: 'no-store' }).then(async response => {
      if (!response.ok) return null;
      return response.json() as Promise<TrackingIds>;
    }).then(ids => {
      if (!ids || !active) return;
      const trackingWindow = window as TrackingWindow;
      if (ids.google_analytics_id && (!trackingWindow.__racedeckGoogleId || trackingWindow.__racedeckGoogleId === ids.google_analytics_id) && !document.getElementById(`ga-${ids.google_analytics_id}`)) {
        trackingWindow.__racedeckGoogleId = ids.google_analytics_id;
        trackingWindow.dataLayer = trackingWindow.dataLayer ?? [];
        trackingWindow.gtag = trackingWindow.gtag ?? function gtag(...args: unknown[]) { trackingWindow.dataLayer?.push(args); };
        trackingWindow.gtag('js', new Date());
        trackingWindow.gtag('config', ids.google_analytics_id, { page_path: pathname });
        const script = document.createElement('script');
        script.id = `ga-${ids.google_analytics_id}`;
        script.async = true;
        script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(ids.google_analytics_id)}`;
        document.head.appendChild(script);
      } else if (ids.google_analytics_id && trackingWindow.__racedeckGoogleId === ids.google_analytics_id) {
        trackingWindow.gtag?.('config', ids.google_analytics_id, { page_path: pathname });
      }
      if (ids.meta_pixel_id && (!trackingWindow.__racedeckMetaId || trackingWindow.__racedeckMetaId === ids.meta_pixel_id)) {
        trackingWindow.__racedeckMetaId = ids.meta_pixel_id;
        if (!trackingWindow.fbq) {
          const fbq: MetaPixel = (...args: unknown[]) => {
            if (fbq.callMethod) fbq.callMethod(...args); else (fbq.queue ??= []).push(args);
          };
          trackingWindow.fbq = fbq;
          trackingWindow._fbq = fbq;
          fbq.queue = [];
          fbq.loaded = true;
          fbq.version = '2.0';
          const script = document.createElement('script');
          script.async = true;
          script.src = 'https://connect.facebook.net/en_US/fbevents.js';
          document.head.appendChild(script);
        }
        trackingWindow.fbq?.('init', ids.meta_pixel_id);
        trackingWindow.fbq?.('track', 'PageView');
      }
    }).catch(() => undefined);
    return () => { active = false; };
  }, [consent, eventId, pathname]);

  if (!eventId || consent !== 'unknown') return null;
  function choose(value: Exclude<Consent, 'unknown'>) {
    window.localStorage.setItem('racedeck-analytics-consent', value);
    setConsent(value);
  }

  return <section role="dialog" aria-label="Analytics cookie preferences" className="fixed inset-x-3 bottom-3 z-50 mx-auto max-w-3xl rounded-xl border border-slate-200 bg-white p-4 shadow-2xl sm:inset-x-6 sm:flex sm:items-center sm:gap-5 sm:p-5">
    <div className="min-w-0 flex-1"><h2 className="text-sm font-bold text-slate-900">Optional tracking</h2><p className="mt-1 text-xs leading-5 text-slate-600">This event organizer uses Google Analytics or Meta Pixel to understand event page visits and measure advertising. Allow these optional tools to load? You can continue without them.</p></div>
    <div className="mt-3 flex shrink-0 gap-2 sm:mt-0"><button type="button" onClick={() => choose('rejected')} className="min-h-10 rounded-lg border border-slate-300 px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50">Decline</button><button type="button" onClick={() => choose('accepted')} className="min-h-10 rounded-lg bg-[#0b2b5b] px-3 py-2 text-xs font-bold text-white hover:bg-[#123b78]">Allow analytics</button></div>
  </section>;
}
