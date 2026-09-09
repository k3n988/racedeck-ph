'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

type Race = { id: string; events: { name: string; event_date: string; venue: string | null } | null; race_categories: { name: string } | null; registration_number: string; status: string };
type Data = { next_race: Race | null; upcoming_races: Race[]; reminders: string[]; recent_result: { result_status: string; overall_rank: number | null } | null };

function daysAway(date: string) { return Math.max(0, Math.ceil((new Date(date).getTime() - Date.now()) / 86400000)); }

export default function DashboardPage() {
  const [data, setData] = useState<Data | null>(null);
  const [message, setMessage] = useState('Loading dashboard...');
  useEffect(() => { void fetch('/api/participant/dashboard').then(async (response) => { const body = await response.json(); if (!response.ok) throw new Error(body.error); setData(body); setMessage(''); }).catch((error) => setMessage(error.message)); }, []);
  if (!data) return <main className="p-6"><p role="status">{message}</p></main>;
  const raceCard = (race: Race) => <Link key={race.id} href={`/my-races/${race.id}`} className="block rounded border p-4">{race.events?.name} · {race.events?.event_date} · {race.race_categories?.name} · {daysAway(race.events!.event_date)} days away</Link>;
  return <main className="mx-auto max-w-5xl space-y-6 p-6"><h1 className="text-3xl font-semibold">Participant Dashboard</h1>{data.next_race && <section className="rounded border p-5"><h2 className="text-xl font-semibold">Next Race</h2><p className="mt-2">{data.next_race.events?.name} · {data.next_race.events?.event_date} · {data.next_race.race_categories?.name}</p><p className="text-sm text-gray-600">{daysAway(data.next_race.events!.event_date)} days away · {data.next_race.events?.venue ?? 'Venue to be announced'}</p><Link href={`/my-races/${data.next_race.id}`} className="mt-3 inline-block underline">View Race</Link></section>}<section><h2 className="text-xl font-semibold">Upcoming Races</h2>{data.upcoming_races.length ? <div className="mt-3 space-y-2">{data.upcoming_races.map(raceCard)}</div> : <p className="mt-3 text-sm text-gray-600">No other upcoming races.</p>}</section><section className="rounded border p-5"><h2 className="font-semibold">Important Reminders</h2>{data.reminders.length ? <ul className="mt-2 list-disc pl-5 text-sm">{data.reminders.map((reminder, index) => <li key={`${reminder}-${index}`}>{reminder}</li>)}</ul> : <p className="mt-2 text-sm text-gray-600">No important reminders.</p>}</section>{data.recent_result && <section className="rounded border p-5"><h2 className="font-semibold">Recent Result</h2><p className="mt-2">{data.recent_result.result_status.toUpperCase()} · Overall rank: {data.recent_result.overall_rank ?? '-'}</p><Link href="/my-results" className="mt-2 inline-block underline">View My Results</Link></section>}</main>;
}
