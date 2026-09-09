import Link from 'next/link';

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return <div className="min-h-screen"><header className="border-b"><nav className="mx-auto flex max-w-6xl items-center justify-between gap-4 p-4"><Link href="/" className="font-semibold">RaceDeck</Link><div className="flex flex-wrap gap-4 text-sm"><Link href="/events">Events</Link><Link href="/results">Results</Link><Link href="/services">Services</Link><Link href="/about">About</Link><Link href="/contact">Contact</Link></div></nav></header>{children}<footer className="mt-12 border-t"><div className="mx-auto max-w-6xl p-6 text-sm text-gray-600">RaceDeck PH · Race registration and event operations.</div></footer></div>;
}
