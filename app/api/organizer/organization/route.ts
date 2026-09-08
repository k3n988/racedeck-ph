import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireOrganizationContext } from '@/lib/auth/rbac';
import { createClient } from '@/lib/supabase/server';

const profileSchema = z.object({
  name: z.string().trim().min(2).max(160), logo_url: z.string().trim().url().max(1000).nullable().optional(),
  description: z.string().trim().max(5000).nullable().optional(), contact_person: z.string().trim().max(160).nullable().optional(),
  contact_email: z.string().trim().email().max(320).nullable().optional(), contact_phone: z.string().trim().max(50).nullable().optional(),
  address: z.string().trim().max(1000).nullable().optional(), website: z.string().trim().url().max(1000).nullable().optional(),
  social_links: z.record(z.string(), z.string().trim().max(1000)).nullable().optional(),
});

export async function GET() {
  const { membership } = await requireOrganizationContext();
  const supabase = await createClient();
  const { data, error } = await supabase.from('organizations').select('id,name,logo_url,description,contact_person,contact_email,contact_phone,address,website,social_links,account_status,verification_status').eq('id', membership.organization_id).single();
  if (error) return NextResponse.json({ error: 'Organization could not be loaded' }, { status: 500 });
  return NextResponse.json(data);
}

export async function PUT(request: Request) {
  const { context, membership } = await requireOrganizationContext();
  if (membership.role !== 'owner') return NextResponse.json({ error: 'Owner permission required' }, { status: 403 });
  const parsed = profileSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Invalid organization details' }, { status: 400 });
  const supabase = await createClient();
  const { data, error } = await supabase.from('organizations').update(parsed.data).eq('id', membership.organization_id).select('id,name,logo_url,description,contact_person,contact_email,contact_phone,address,website,social_links,account_status,verification_status').single();
  if (error) return NextResponse.json({ error: 'Organization could not be saved' }, { status: 500 });
  void context;
  return NextResponse.json(data);
}
