import { NextResponse } from 'next/server';
import { getPublicResults } from '@/lib/public/events';
export async function GET(request: Request) { try { const p = new URL(request.url).searchParams; const page = Number(p.get('page') ?? '1'); return NextResponse.json(await getPublicResults({ event: p.get('event') ?? undefined, participant: p.get('participant') ?? undefined, bib: p.get('bib') ?? undefined, category: p.get('category') ?? undefined, page: Number.isFinite(page) ? page : 1 })); } catch { return NextResponse.json({ error: 'Results could not be loaded' }, { status: 500 }); } }
