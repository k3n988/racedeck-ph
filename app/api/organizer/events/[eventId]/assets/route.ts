import { NextResponse } from 'next/server';
import { requireOrganizerPermission, errorResponse } from '@/lib/auth/organizer-access';
import type { Database } from '@/types/database.types';
import type { SupabaseClient } from '@supabase/supabase-js';

const types = new Set(['image/jpeg', 'image/png', 'image/webp']);
export async function POST(request: Request, { params }: { params: { eventId: string } }) {
  const requestedKind = new URL(request.url).searchParams.get('kind');
  const auth = await requireOrganizerPermission(requestedKind === 'certificate_asset' ? 'manage_certificates' : 'edit_events', params.eventId);
  if ('response' in auth) return auth.response;
  try {
    const { data: event, error: eventError } = await auth.admin.from('events')
      .select('lifecycle_status,review_status')
      .eq('id', params.eventId)
      .eq('organization_id', auth.membership.organization_id)
      .maybeSingle();
    if (eventError) return errorResponse(eventError, 'Checking event asset access');
    if (!event) return NextResponse.json({ error: 'Event not found' }, { status: 404 });
    const form = await request.formData();
    const kind = form.get('kind');
    const file = form.get('file');
    if (requestedKind && requestedKind !== kind) return NextResponse.json({ error: 'Upload type does not match the requested asset type.' }, { status: 400 });
    if ((kind !== 'logo' && kind !== 'banner' && kind !== 'poster' && kind !== 'route_map' && kind !== 'content_image' && kind !== 'sponsor_logo' && kind !== 'size_chart' && kind !== 'race_kit_image' && kind !== 'merchandise' && kind !== 'certificate_asset') || !(file instanceof File) || !file.size || file.size > 10 * 1024 * 1024 || !types.has(file.type)) return NextResponse.json({ error: 'Upload a JPG, PNG, or WEBP image up to 10 MB.' }, { status: 400 });
    const isSponsorLogo = kind === 'sponsor_logo';
    const isCertificateAsset = kind === 'certificate_asset';
    const isRaceKitAsset = kind === 'race_kit_image' || kind === 'size_chart';
    const eventImagesLocked = event.lifecycle_status !== 'draft' || event.review_status === 'pending_review' || event.review_status === 'approved';
    const isEditableContentImage = kind === 'content_image' && event.review_status !== 'pending_review';
    const isEditableBanner = kind === 'banner' && event.review_status !== 'pending_review';
    const isEditableEventLogo = kind === 'logo' && event.review_status !== 'pending_review';
    const isEditablePoster = kind === 'poster' && event.review_status !== 'pending_review' && !(event.lifecycle_status === 'draft' && event.review_status === 'approved');
    if ((isSponsorLogo && event.review_status === 'pending_review') || (!isSponsorLogo && !isCertificateAsset && !isRaceKitAsset && !isEditableContentImage && !isEditableBanner && !isEditableEventLogo && !isEditablePoster && eventImagesLocked)) {
      return NextResponse.json({ error: isSponsorLogo ? 'Sponsor logos cannot be changed while this event is under review.' : 'Event images are locked during review and after approval.' }, { status: 409 });
    }
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
    if (kind === 'content_image' || kind === 'sponsor_logo' || kind === 'size_chart' || kind === 'race_kit_image' || kind === 'merchandise' || kind === 'certificate_asset') return NextResponse.json({ url: publicUrl.publicUrl, kind });
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
