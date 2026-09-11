import { NextResponse } from 'next/server';
import { requireOrganizationContext } from '@/lib/auth/rbac';
import { createAdminClient } from '@/lib/supabase/admin';

const TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
export async function POST(request: Request) {
  const { membership } = await requireOrganizationContext();
  if (membership.role !== 'owner') return NextResponse.json({ error: 'Owner permission required' }, { status: 403 });
  const file = (await request.formData()).get('file');
  if (!(file instanceof File) || file.size === 0 || file.size > 5 * 1024 * 1024 || !TYPES.has(file.type)) return NextResponse.json({ error: 'Upload a JPG, PNG, or WEBP image up to 5 MB' }, { status: 400 });
  const admin = createAdminClient();
  const extension = file.type.split('/')[1] === 'jpeg' ? 'jpg' : file.type.split('/')[1];
  const path = `${membership.organization_id}/logo-${crypto.randomUUID()}.${extension}`;
  const upload = await admin.storage.from('organization-logos').upload(path, await file.arrayBuffer(), { contentType: file.type, upsert: false });
  if (upload.error) return NextResponse.json({ error: 'Logo upload failed' }, { status: 502 });
  const { data } = admin.storage.from('organization-logos').getPublicUrl(path);
  const { error } = await admin.from('organizations').update({ logo_url: data.publicUrl }).eq('id', membership.organization_id);
  if (error) { await admin.storage.from('organization-logos').remove([path]); return NextResponse.json({ error: 'Logo reference could not be saved' }, { status: 500 }); }
  return NextResponse.json({ logo_url: data.publicUrl });
}
