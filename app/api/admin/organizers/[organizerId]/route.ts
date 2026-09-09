import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireInternalAccess } from '@/lib/auth/rbac';
import { loadAuthContext } from '@/lib/auth/permissions';
import { createAdminClient } from '@/lib/supabase/admin';

const reviewSchema = z.object({
  status: z.enum(['approved', 'needs_changes', 'rejected']),
  reviewer_notes: z.string().trim().max(5000).nullable().optional(),
}).superRefine((value, context) => {
  if (value.status !== 'approved' && !value.reviewer_notes?.trim()) context.addIssue({ code: z.ZodIssueCode.custom, path: ['reviewer_notes'], message: 'Feedback is required for this decision' });
});

export async function GET(_request: Request, { params }: { params: { organizerId: string } }) {
  await requireInternalAccess();
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
  await requireInternalAccess();
  const context = await loadAuthContext();
  if (!context) return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  const parsed = reviewSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid review decision' }, { status: 400 });
  const admin = createAdminClient();
  const { data: existing } = await admin.from('organizer_verifications').select('id,organization_id,status,reviewer_notes,submitted_by,organizations!inner(name,contact_email,account_status,verification_status)').eq('organization_id', params.organizerId).maybeSingle();
  if (!existing) return NextResponse.json({ error: 'Application not found' }, { status: 404 });
  const now = new Date().toISOString();
  const { data: reviewed, error } = await admin.from('organizer_verifications').update({ status: parsed.data.status, reviewer_notes: parsed.data.reviewer_notes ?? null, reviewed_by: context.user.id, reviewed_at: now }).eq('id', existing.id).select('id,status,reviewer_notes,organization_id,submitted_by').single();
  if (error || !reviewed) return NextResponse.json({ error: 'Review could not be saved' }, { status: 500 });
  const organizationUpdate = parsed.data.status === 'approved' ? { verification_status: 'approved' as const, account_status: 'active' as const } : { verification_status: parsed.data.status };
  const { error: organizationError } = await admin.from('organizations').update(organizationUpdate).eq('id', existing.organization_id);
  if (organizationError) return NextResponse.json({ error: 'Organization status could not be synchronized' }, { status: 500 });
  const { error: auditError } = await admin.from('audit_logs').insert({ actor_user_id: context.user.id, organization_id: existing.organization_id, action: 'organizer_verification_reviewed', resource_type: 'organization', resource_id: existing.organization_id, previous_values: { verification_status: existing.status, reviewer_notes: existing.reviewer_notes, account_status: existing.organizations.account_status }, new_values: { verification_status: reviewed.status, reviewer_notes: reviewed.reviewer_notes, account_status: organizationUpdate.account_status ?? existing.organizations.account_status } });
  if (auditError) return NextResponse.json({ error: 'Review was saved but could not be audited' }, { status: 500 });
  if (reviewed.submitted_by) {
    const title = parsed.data.status === 'approved' ? 'Organizer verification approved' : parsed.data.status === 'needs_changes' ? 'Organizer verification needs changes' : 'Organizer verification rejected';
    const body = parsed.data.status === 'approved' ? 'Your organizer verification has been approved. Your organization is now active.' : reviewed.reviewer_notes ?? 'Please review your organizer verification.';
    const key = `organizer-verification:${reviewed.id}:${reviewed.status}`;
    const { data: notification, error: notificationError } = await admin.from('notifications').upsert({ recipient_user_id: reviewed.submitted_by, organization_id: reviewed.organization_id, notification_type: 'organizer_verification_result', title, body, metadata: { verification_id: reviewed.id, status: reviewed.status }, idempotency_key: key }, { onConflict: 'idempotency_key' }).select('id,recipient_user_id').single();
    if (notificationError) return NextResponse.json({ error: 'Review was saved but notification could not be queued' }, { status: 500 });
    const { error: deliveryError } = await admin.from('notification_deliveries').upsert({ notification_id: notification.id, recipient_user_id: notification.recipient_user_id, channel: 'in_app', status: 'queued', idempotency_key: `${key}:in_app` }, { onConflict: 'idempotency_key' });
    if (deliveryError) return NextResponse.json({ error: 'Review was saved but notification delivery could not be queued' }, { status: 500 });
    if (existing.organizations.contact_email) await admin.from('email_messages').upsert({ recipient_email: existing.organizations.contact_email, recipient_user_id: reviewed.submitted_by, organization_id: reviewed.organization_id, email_type: 'organizer_verification', template_version: 1, template_snapshot: { type: 'organizer_verification', verification_id: reviewed.id, status: reviewed.status }, subject: title, status: 'queued', idempotency_key: `${key}:email` }, { onConflict: 'idempotency_key' });
  }
  return NextResponse.json({ ok: true, status: reviewed.status });
}
