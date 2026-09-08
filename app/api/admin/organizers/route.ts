import { NextResponse } from 'next/server';
import { requireInternalRole } from '@/lib/auth/rbac';
import { createAdminClient } from '@/lib/supabase/admin';

export async function GET(request: Request) {
  await requireInternalRole('admin');
  const status = new URL(request.url).searchParams.get('status');
  const admin = createAdminClient();
  let query = admin.from('organizer_verifications').select('id,organization_id,status,business_name,legal_name,submitted_at,reviewed_at,reviewer_notes,organizations!inner(id,name,slug,account_status,verification_status,contact_email)').order('updated_at', { ascending: false });
  if (status && ['draft', 'pending_review', 'needs_changes', 'approved', 'rejected'].includes(status)) query = query.eq('status', status as 'draft');
  const { data, error } = await query;
  if (error) return NextResponse.json({ error: 'Applications could not be loaded' }, { status: 500 });
  return NextResponse.json(data ?? []);
}
