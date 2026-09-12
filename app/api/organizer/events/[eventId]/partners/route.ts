import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireOrganizerPermission } from '@/lib/auth/organizer-access';

const partnerSchema = z.object({ name: z.string().trim().min(1).max(160), partner_type: z.enum(['Presented By', 'Official Partners', 'Supported By']), logo_url: z.string().url().nullable() });

export async function POST(request: Request, { params }: { params: { eventId: string } }) {
  const auth = await requireOrganizerPermission('edit_events', params.eventId);
  if ('response' in auth) return auth.response;
  const parsed = partnerSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Invalid sponsor details' }, { status: 400 });
  const { data, error } = await auth.admin.from('event_partners').insert({ ...parsed.data, event_id: params.eventId }).select('id,name,logo_url,partner_type').single();
  if (error) return NextResponse.json({ error: 'Sponsor could not be saved' }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
