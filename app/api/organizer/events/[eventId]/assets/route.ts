import { NextResponse } from 'next/server';
import { requireOrganizerPermission, errorResponse } from '@/lib/auth/organizer-access';
import type { Database } from '@/types/database.types';
import type { SupabaseClient } from '@supabase/supabase-js';

const types = new Set(['image/jpeg', 'image/png', 'image/webp']);
export async function POST(request: Request, { params }: { params: { eventId: string } }) {
  const auth = await requireOrganizerPermission('edit_events', params.eventId);
  if ('response' in auth) return auth.response;
  try {
    const form = await request.formData();
    const kind = form.get('kind');
    const file = form.get('file');
    if ((kind !== 'logo' && kind !== 'banner' && kind !== 'poster' && kind !== 'route_map' && kind !== 'sponsor_logo') || !(file instanceof File) || !file.size || file.size > 10 * 1024 * 1024 || !types.has(file.type)) return NextResponse.json({ error: 'Upload a JPG, PNG, or WEBP image up to 10 MB.' }, { status: 400 });
    // The migration creates this bucket in a fresh project. Creating it here as
    // an idempotent fallback also makes an already-running project recover when
    // the storage migration was not yet applied.
    const bucket = await auth.admin.storage.createBucket('event-assets', { public: true, fileSizeLimit: 10 * 1024 * 1024, allowedMimeTypes: Array.from(types) });
    if (bucket.error && !/already exists|duplicate/i.test(bucket.error.message)) return NextResponse.json({ error: process.env.NODE_ENV === 'development' ? `Event image upload failed: ${bucket.error.message}` : 'Event image storage is not configured.' }, { status: 502 });
    const extension = file.type === 'image/jpeg' ? 'jpg' : file.type.split('/')[1];
    const path = `${auth.membership.organization_id}/${params.eventId}/${kind}-${crypto.randomUUID()}.${extension}`;
    const upload = await auth.admin.storage.from('event-assets').upload(path, await file.arrayBuffer(), { contentType: file.type, upsert: false });
    if (upload.error) return NextResponse.json({ error: process.env.NODE_ENV === 'development' ? `Event image upload failed: ${upload.error.message}` : 'Event image upload failed.' }, { status: 502 });
    const { data: publicUrl } = auth.admin.storage.from('event-assets').getPublicUrl(path);
    if (kind === 'poster') {
      const db = auth.admin as unknown as SupabaseClient;
      const { error } = await db.from('event_content_images').insert({ event_id: params.eventId, organization_id: auth.membership.organization_id, image_url: publicUrl.publicUrl, storage_path: path });
      if (error) return errorResponse(error, 'Saving event poster');
      return NextResponse.json({ url: publicUrl.publicUrl, kind });
    }
    if (kind === 'sponsor_logo') return NextResponse.json({ url: publicUrl.publicUrl, kind });
    if (kind === 'route_map') {
      const db = auth.admin as unknown as SupabaseClient;
      const { error } = await db.from('event_routes').insert({ event_id: params.eventId, route_map_url: publicUrl.publicUrl });
      if (error) return errorResponse(error, 'Saving route map');
      return NextResponse.json({ url: publicUrl.publicUrl, kind });
    }
    const column: 'logo_url' | 'banner_url' = kind === 'logo' ? 'logo_url' : 'banner_url';
    const update = { [column]: publicUrl.publicUrl } as Database['public']['Tables']['events']['Update'];
    const { error } = await auth.admin.from('events').update(update).eq('id', params.eventId).eq('organization_id', auth.membership.organization_id);
    if (error) return errorResponse(error, 'Saving event image');
    return NextResponse.json({ url: publicUrl.publicUrl, kind });
  } catch (error) { return errorResponse(error, 'Uploading event image'); }
}
