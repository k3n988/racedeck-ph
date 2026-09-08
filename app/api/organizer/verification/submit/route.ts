import { NextResponse } from 'next/server';
import { requireOrganizationContext } from '@/lib/auth/rbac';
import { createAdminClient } from '@/lib/supabase/admin';

export async function POST() {
  const { context, membership } = await requireOrganizationContext();
  if (membership.role !== 'owner') return NextResponse.json({ error: 'Owner permission required' }, { status: 403 });
  const admin = createAdminClient();
  const { data: verification } = await admin.from('organizer_verifications').select('id,legal_name,business_name,registration_number,document_storage_references,status').eq('organization_id', membership.organization_id).maybeSingle();
  if (!verification) return NextResponse.json({ error: 'Save verification details before submitting' }, { status: 400 });
  const docs = Array.isArray(verification.document_storage_references) ? verification.document_storage_references : [];
  if (!verification.legal_name || !verification.business_name || !verification.registration_number || docs.length === 0) return NextResponse.json({ error: 'Complete business details and upload at least one document' }, { status: 400 });
  if (verification.status === 'pending_review' || verification.status === 'approved') return NextResponse.json({ error: 'Verification is already submitted' }, { status: 409 });
  const now = new Date().toISOString();
  const { error } = await admin.from('organizer_verifications').update({ status: 'pending_review', submitted_at: now, submitted_by: context.user.id, reviewer_notes: null }).eq('organization_id', membership.organization_id);
  if (error) return NextResponse.json({ error: 'Verification could not be submitted' }, { status: 500 });
  const { error: orgError } = await admin.from('organizations').update({ verification_status: 'pending_review' }).eq('id', membership.organization_id);
  if (orgError) return NextResponse.json({ error: 'Organization status could not be synchronized' }, { status: 500 });
  return NextResponse.json({ ok: true });
}
