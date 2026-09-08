import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireInternalRole } from '@/lib/auth/rbac';
import { createAdminClient } from '@/lib/supabase/admin';

const reviewSchema = z.object({ status: z.enum(['approved', 'needs_changes', 'rejected']), reviewer_notes: z.string().trim().max(5000).nullable().optional() });

export async function GET(_request: Request, { params }: { params: { organizerId: string } }) {
  await requireInternalRole('admin');
  const admin = createAdminClient();
  const { data, error } = await admin.from('organizer_verifications').select('*,organizations!inner(*)').eq('organization_id', params.organizerId).single();
  if (error) return NextResponse.json({ error: 'Application not found' }, { status: 404 });
  const refs = Array.isArray(data.document_storage_references) ? data.document_storage_references : [];
  const documents = await Promise.all(refs.map(async (ref) => {
    if (!ref || typeof ref !== 'object' || !('path' in ref) || typeof ref.path !== 'string') return ref;
    const signed = await admin.storage.from('organizer-verification').createSignedUrl(ref.path, 300);
    return { ...ref, signed_url: signed.data?.signedUrl ?? null };
  }));
  return NextResponse.json({ ...data, document_storage_references: documents });
}

export async function PATCH(request: Request, { params }: { params: { organizerId: string } }) {
  const { context } = await (async () => { await requireInternalRole('admin'); return { context: await import('@/lib/auth/permissions').then((m) => m.loadAuthContext()) }; })();
  if (!context) return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  const parsed = reviewSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Invalid review decision' }, { status: 400 });
  const admin = createAdminClient();
  const now = new Date().toISOString();
  const { error } = await admin.from('organizer_verifications').update({ status: parsed.data.status, reviewer_notes: parsed.data.reviewer_notes ?? null, reviewed_by: context.user.id, reviewed_at: now }).eq('organization_id', params.organizerId);
  if (error) return NextResponse.json({ error: 'Review could not be saved' }, { status: 500 });
  const organizationUpdate = parsed.data.status === 'approved'
    ? { verification_status: parsed.data.status, account_status: 'active' as const }
    : { verification_status: parsed.data.status };
  const { error: orgError } = await admin.from('organizations').update(organizationUpdate).eq('id', params.organizerId);
  if (orgError) return NextResponse.json({ error: 'Organization status could not be synchronized' }, { status: 500 });
  return NextResponse.json({ ok: true });
}
