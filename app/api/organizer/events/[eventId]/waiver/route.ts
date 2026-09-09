import { NextResponse } from 'next/server';
import { z } from 'zod';
import { hasPermission, loadAuthContext } from '@/lib/auth/permissions';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';

const waiverSchema = z.object({
  title: z.string().trim().min(1).max(240),
  content: z.string().trim().min(1),
});
const publishSchema = z.object({ action: z.literal('publish') });

async function authorize(eventId: string) {
  const context = await loadAuthContext();
  if (!context) return { response: NextResponse.json({ error: 'Authentication required' }, { status: 401 }) } as const;
  const membership = context.memberships[0];
  if (!membership || !(await hasPermission(membership.organization_id, 'edit_events', eventId))) {
    return { response: NextResponse.json({ error: 'Event waiver permission required' }, { status: 403 }) } as const;
  }
  const supabase = await createClient();
  const { data: event } = await supabase.from('events').select('id,organization_id').eq('id', eventId).eq('organization_id', membership.organization_id).maybeSingle();
  if (!event) return { response: NextResponse.json({ error: 'Event not found' }, { status: 404 }) } as const;
  return { context, membership, event } as const;
}

export async function GET(_request: Request, { params }: { params: { eventId: string } }) {
  const result = await authorize(params.eventId);
  if ('response' in result) return result.response;
  const admin = createAdminClient();
  const { data, error } = await admin.from('event_waivers').select('id,event_id,title,version,content,content_storage_reference,effective_at,status,published_at,published_by,created_by,created_at,updated_at').eq('event_id', params.eventId).eq('organization_id', result.event.organization_id).order('version', { ascending: false });
  if (error) { console.error('Unable to load event waiver', error); return NextResponse.json({ error: 'Event waiver could not be loaded' }, { status: 500 }); }
  const waivers = await Promise.all((data ?? []).map(async waiver => {
    const { count } = await admin.from('event_waiver_acceptances').select('id', { count: 'exact', head: true }).eq('event_waiver_id', waiver.id);
    return { ...waiver, acceptance_count: count ?? 0 };
  }));
  return NextResponse.json({ waivers });
}

export async function POST(request: Request, { params }: { params: { eventId: string } }) {
  const result = await authorize(params.eventId);
  if ('response' in result) return result.response;
  const parsed = waiverSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Waiver title and content are required' }, { status: 400 });
  const admin = createAdminClient();
  const { data: latest } = await admin.from('event_waivers').select('version').eq('event_id', params.eventId).eq('organization_id', result.event.organization_id).order('version', { ascending: false }).limit(1).maybeSingle();
  const { data, error } = await admin.from('event_waivers').insert({ ...parsed.data, organization_id: result.event.organization_id, event_id: params.eventId, version: (latest?.version ?? 0) + 1, status: 'draft', effective_at: new Date().toISOString(), created_by: result.context.user.id }).select('*').single();
  if (error) { console.error('Unable to create event waiver', error); return NextResponse.json({ error: 'Event waiver could not be created' }, { status: 500 }); }
  return NextResponse.json(data, { status: 201 });
}

export async function PATCH(request: Request, { params }: { params: { eventId: string } }) {
  const result = await authorize(params.eventId);
  if ('response' in result) return result.response;
  const body = await request.json().catch(() => null) as unknown;
  const admin = createAdminClient();
  const waiverId = typeof body === 'object' && body !== null && 'id' in body && typeof body.id === 'string' ? body.id : null;
  if (!waiverId) return NextResponse.json({ error: 'Waiver id is required' }, { status: 400 });
  const { data: waiver } = await admin.from('event_waivers').select('*').eq('id', waiverId).eq('event_id', params.eventId).eq('organization_id', result.event.organization_id).maybeSingle();
  if (!waiver) return NextResponse.json({ error: 'Waiver not found for this event' }, { status: 404 });
  if (typeof body === 'object' && body !== null && 'action' in body && body.action === 'publish') {
    const parsed = publishSchema.safeParse(body);
    if (!parsed.success || waiver.status !== 'draft') return NextResponse.json({ error: 'Only a draft waiver can be activated' }, { status: 409 });
    const { data: current } = await admin.from('event_waivers').select('id').eq('event_id', params.eventId).eq('organization_id', result.event.organization_id).eq('status', 'published').maybeSingle();
    if (current && current.id !== waiver.id) {
      const { error: retireError } = await admin.from('event_waivers').update({ status: 'retired' }).eq('id', current.id).eq('status', 'published');
      if (retireError) { console.error('Unable to retire previous event waiver', retireError); return NextResponse.json({ error: 'The current waiver could not be replaced' }, { status: 409 }); }
    }
    const { data, error } = await admin.from('event_waivers').update({ status: 'published', published_at: new Date().toISOString(), published_by: result.context.user.id }).eq('id', waiver.id).select('*').single();
    if (error) {
      if (current && current.id !== waiver.id) await admin.from('event_waivers').update({ status: 'published' }).eq('id', current.id).eq('status', 'retired');
      console.error('Unable to publish event waiver', error); return NextResponse.json({ error: 'Event waiver could not be activated' }, { status: 500 });
    }
    return NextResponse.json(data);
  }
  const parsed = waiverSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'Waiver title and content are required' }, { status: 400 });
  if (waiver.status !== 'draft') return NextResponse.json({ error: 'This waiver version has been accepted or published and is immutable. Create a new version.' }, { status: 409 });
  const { data, error } = await admin.from('event_waivers').update(parsed.data).eq('id', waiver.id).eq('event_id', params.eventId).eq('organization_id', result.event.organization_id).select('*').single();
  if (error) { console.error('Unable to update event waiver', error); return NextResponse.json({ error: 'Event waiver could not be updated' }, { status: 500 }); }
  return NextResponse.json(data);
}
