import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireOrganizationContext } from '@/lib/auth/rbac';
import { createAdminClient } from '@/lib/supabase/admin';

const verificationSchema = z.object({ legal_name: z.string().trim().max(200).nullable().optional(), business_name: z.string().trim().max(200).nullable().optional(), registration_number: z.string().trim().max(120).nullable().optional() });

async function owner() {
  const result = await requireOrganizationContext();
  if (result.membership.role !== 'owner') throw new Response(JSON.stringify({ error: 'Owner permission required' }), { status: 403 });
  return result;
}

export async function GET() {
  const { membership } = await requireOrganizationContext();
  const admin = createAdminClient();
  const { data, error } = await admin.from('organizer_verifications').select('id,organization_id,legal_name,business_name,registration_number,document_storage_references,status,reviewer_notes,submitted_at,reviewed_at,created_at,updated_at').eq('organization_id', membership.organization_id).maybeSingle();
  if (error) return NextResponse.json({ error: 'Verification could not be loaded' }, { status: 500 });
  return NextResponse.json(data);
}

export async function PUT(request: Request) {
  const { context, membership } = await owner();
  const parsed = verificationSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Invalid verification details' }, { status: 400 });
  const admin = createAdminClient();
  const existing = await admin.from('organizer_verifications').select('status').eq('organization_id', membership.organization_id).maybeSingle();
  if (existing.error) return NextResponse.json({ error: 'Verification lookup failed' }, { status: 500 });
  if (existing.data?.status === 'pending_review' || existing.data?.status === 'approved') return NextResponse.json({ error: 'This verification cannot be edited in its current state' }, { status: 409 });
  const { data, error } = await admin.from('organizer_verifications').upsert({ ...parsed.data, organization_id: membership.organization_id, status: existing.data?.status ?? 'draft' }, { onConflict: 'organization_id' }).select('id,organization_id,legal_name,business_name,registration_number,document_storage_references,status,reviewer_notes,submitted_at,reviewed_at,created_at,updated_at').single();
  if (error) return NextResponse.json({ error: 'Verification could not be saved' }, { status: 500 });
  void context;
  return NextResponse.json(data);
}
