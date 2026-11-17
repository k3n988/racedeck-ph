import { NextResponse } from 'next/server';
import { z } from 'zod';
import { loadAuthContext } from '@/lib/auth/permissions';
import { createAdminClient } from '@/lib/supabase/admin';

const schema = z.object({
  google_analytics_id: z.union([z.string().trim().regex(/^G-[A-Z0-9]{5,20}$/), z.literal('')]),
  meta_pixel_id: z.union([z.string().trim().regex(/^[0-9]{5,20}$/), z.literal('')]),
});

async function ownerOrganization() {
  const context = await loadAuthContext();
  if (!context) return { response: NextResponse.json({ error: 'Authentication required' }, { status: 401 }) } as const;
  const membership = context.memberships[0];
  if (!membership || membership.role !== 'owner') return { response: NextResponse.json({ error: 'Organization owner permission required' }, { status: 403 }) } as const;
  return { organizationId: membership.organization_id } as const;
}

export async function GET() {
  const access = await ownerOrganization();
  if ('response' in access) return access.response;
  const admin = createAdminClient() as any;
  const { data, error } = await admin.from('organization_integrations').select('google_analytics_id,meta_pixel_id').eq('organization_id', access.organizationId).maybeSingle();
  if (error) return NextResponse.json({ error: 'Integration settings could not be loaded' }, { status: 500 });
  return NextResponse.json({ google_analytics_id: data?.google_analytics_id ?? '', meta_pixel_id: data?.meta_pixel_id ?? '' });
}

export async function PUT(request: Request) {
  const access = await ownerOrganization();
  if ('response' in access) return access.response;
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Enter a valid Google Analytics measurement ID (G-...) or Meta Pixel ID (numbers only).' }, { status: 400 });
  const admin = createAdminClient() as any;
  const values = { organization_id: access.organizationId, google_analytics_id: parsed.data.google_analytics_id || null, meta_pixel_id: parsed.data.meta_pixel_id || null, updated_at: new Date().toISOString() };
  if (!values.google_analytics_id && !values.meta_pixel_id) {
    const { error } = await admin.from('organization_integrations').delete().eq('organization_id', access.organizationId);
    if (error) return NextResponse.json({ error: 'Integration settings could not be saved' }, { status: 500 });
    return NextResponse.json({ google_analytics_id: '', meta_pixel_id: '' });
  }
  const { data, error } = await admin.from('organization_integrations').upsert(values, { onConflict: 'organization_id' }).select('google_analytics_id,meta_pixel_id').single();
  if (error) return NextResponse.json({ error: 'Integration settings could not be saved' }, { status: 500 });
  return NextResponse.json({ google_analytics_id: data.google_analytics_id ?? '', meta_pixel_id: data.meta_pixel_id ?? '' });
}
