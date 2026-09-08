import { NextResponse } from 'next/server';
import { requireOrganizationContext } from '@/lib/auth/rbac';
import { createAdminClient } from '@/lib/supabase/admin';

const MAX_BYTES = 10 * 1024 * 1024;
const TYPES = new Set(['application/pdf', 'image/jpeg', 'image/png']);

export async function POST(request: Request) {
  const { context, membership } = await requireOrganizationContext();
  if (membership.role !== 'owner') return NextResponse.json({ error: 'Owner permission required' }, { status: 403 });
  const form = await request.formData();
  const file = form.get('file');
  if (!(file instanceof File) || file.size === 0 || file.size > MAX_BYTES || !TYPES.has(file.type)) return NextResponse.json({ error: 'Upload a PDF, JPG, or PNG file up to 10 MB' }, { status: 400 });
  const admin = createAdminClient();
  const existing = await admin.from('organizer_verifications').select('status,document_storage_references').eq('organization_id', membership.organization_id).maybeSingle();
  if (existing.data?.status === 'pending_review' || existing.data?.status === 'approved') return NextResponse.json({ error: 'Documents cannot be changed in this state' }, { status: 409 });
  const extension = file.name.toLowerCase().split('.').pop() || 'bin';
  const path = `${membership.organization_id}/${crypto.randomUUID()}.${extension}`;
  const upload = await admin.storage.from('organizer-verification').upload(path, await file.arrayBuffer(), { contentType: file.type, upsert: false });
  if (upload.error) return NextResponse.json({ error: 'Document upload failed' }, { status: 502 });
  const refs = Array.isArray(existing.data?.document_storage_references) ? existing.data.document_storage_references : [];
  const reference = { path, name: file.name.slice(0, 200), content_type: file.type, size: file.size, uploaded_at: new Date().toISOString() };
  const { error } = await admin.from('organizer_verifications').upsert({ organization_id: membership.organization_id, status: existing.data?.status ?? 'draft', document_storage_references: [...refs, reference] }, { onConflict: 'organization_id' });
  if (error) { await admin.storage.from('organizer-verification').remove([path]); return NextResponse.json({ error: 'Document reference could not be saved' }, { status: 500 }); }
  void context;
  return NextResponse.json({ ok: true, document: reference });
}
