import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { loadAuthContext } from '@/lib/auth/permissions';
import { createClient } from '@/lib/supabase/server';

const schema = z.object({
  decision: z.enum(['approved', 'needs_changes', 'rejected']),
  feedback: z.string().trim().max(5000).nullable().optional(),
}).refine((value) => value.decision === 'approved' || Boolean(value.feedback), {
  message: 'Feedback is required when requesting changes or rejecting an event',
});

export async function POST(request: Request, { params }: { params: { eventId: string } }) {
  const context = await loadAuthContext();
  if (!context) return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  if (!context.internalRoles.some((role) => role === 'admin' || role === 'super_admin')) {
    return NextResponse.json({ error: 'RaceDeck admin permission required' }, { status: 403 });
  }
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid review' }, { status: 400 });

  const supabase = await createClient();
  const { data, error } = await supabase.rpc('review_event', {
    p_event_id: params.eventId,
    p_decision: parsed.data.decision,
    p_feedback: parsed.data.feedback ?? null,
  });
  if (error) {
    console.error('[Admin event review]', error);
    return NextResponse.json({ error: error.code === 'P0001' ? error.message : 'Event review could not be saved' }, { status: error.code === 'P0001' ? 409 : 500 });
  }
  revalidatePath('/admin/dashboard');
  revalidatePath('/admin/events');
  revalidatePath(`/admin/events/${params.eventId}`);
  revalidatePath(`/organizer/events/${params.eventId}`);
  return NextResponse.json({ status: data }, { headers: { 'Cache-Control': 'no-store' } });
}
