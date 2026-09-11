import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireOrganizationContext } from '@/lib/auth/rbac';
import { createAdminClient } from '@/lib/supabase/admin';

const schema = z.object({
  organization: z.object({
    name: z.string().trim().min(2).max(160),
    logo_url: z.string().trim().url().max(1000),
    description: z.string().trim().min(1).max(5000),
    contact_person: z.string().trim().min(1).max(160),
    contact_email: z.string().trim().email().max(320),
    contact_phone: z.string().trim().min(1).max(50),
    address: z.string().trim().nullable().optional(),
    website: z.string().trim().url().nullable().optional(),
    social_links: z.record(z.string(), z.string().trim().max(1000)).nullable().optional(),
  }),
  verification: z.object({
    legal_name: z.string().trim().min(1).max(200),
    business_name: z.string().trim().max(200).nullable().optional(),
    registration_number: z.string().trim().max(120).nullable().optional(),
  }),
});

export async function POST(request: Request) {
  const { context, membership } = await requireOrganizationContext();
  if (membership.role !== 'owner') return NextResponse.json({ error: 'Owner permission required' }, { status: 403 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Complete all required organization and verification details' }, { status: 400 });

  const admin = createAdminClient();
  const organizationId = membership.organization_id;
  const [{ data: previousOrganization, error: organizationLookupError }, { data: previousVerification, error: verificationLookupError }] = await Promise.all([
    admin.from('organizations').select('name,logo_url,description,contact_person,contact_email,contact_phone,address,website,social_links').eq('id', organizationId).single(),
    admin.from('organizer_verifications').select('id,status,legal_name,business_name,registration_number,document_storage_references,submitted_at,submitted_by,reviewer_notes').eq('organization_id', organizationId).maybeSingle(),
  ]);
  if (organizationLookupError || verificationLookupError || !previousOrganization) return NextResponse.json({ error: 'Onboarding data could not be loaded' }, { status: 500 });
  if (previousVerification?.status === 'pending_review' || previousVerification?.status === 'approved') return NextResponse.json({ error: 'This onboarding form is locked in its current state' }, { status: 409 });
  const docs = Array.isArray(previousVerification?.document_storage_references) ? previousVerification.document_storage_references as Array<{ document_type?: string }> : [];
  if (!docs.some((document) => document.document_type === 'government_id')) return NextResponse.json({ error: 'Upload a valid government ID before submitting' }, { status: 400 });

  const organizationUpdate = { ...parsed.data.organization, address: parsed.data.organization.address || null, website: parsed.data.organization.website || null };
  const { error: organizationError } = await admin.from('organizations').update(organizationUpdate).eq('id', organizationId);
  if (organizationError) return NextResponse.json({ error: 'Organization profile could not be saved' }, { status: 500 });

  const now = new Date().toISOString();
  const { error: verificationError } = await admin.from('organizer_verifications').upsert({
    organization_id: organizationId,
    legal_name: parsed.data.verification.legal_name,
    business_name: parsed.data.verification.business_name || null,
    registration_number: parsed.data.verification.registration_number || null,
    status: 'pending_review',
    submitted_at: now,
    submitted_by: context.user.id,
    reviewer_notes: null,
  }, { onConflict: 'organization_id' });
  if (verificationError) {
    await admin.from('organizations').update(previousOrganization).eq('id', organizationId);
    return NextResponse.json({ error: 'Verification could not be submitted; organization changes were rolled back' }, { status: 500 });
  }
  const { error: statusError } = await admin.from('organizations').update({ verification_status: 'pending_review' }).eq('id', organizationId);
  if (statusError) {
    await admin.from('organizations').update(previousOrganization).eq('id', organizationId);
    if (previousVerification) await admin.from('organizer_verifications').update(previousVerification).eq('id', previousVerification.id);
    else await admin.from('organizer_verifications').delete().eq('organization_id', organizationId);
    return NextResponse.json({ error: 'Onboarding submission failed; changes were rolled back' }, { status: 500 });
  }
  return NextResponse.json({ ok: true, status: 'pending_review' });
}
