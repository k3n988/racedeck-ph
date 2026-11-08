'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requireInternalAccess } from '@/lib/auth/rbac';
import { createAdminClient } from '@/lib/supabase/admin';

const contentTypes = ['featured_race', 'homepage_banner', 'homepage_section', 'platform_announcement'] as const;
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function saveContentBlock(formData: FormData) {
  const context = await requireInternalAccess();
  const db = createAdminClient();
  const id = String(formData.get('id') ?? '').trim();
  const contentKey = String(formData.get('content_key') ?? '').trim().toLowerCase();
  const title = String(formData.get('title') ?? '').trim();
  const body = String(formData.get('body') ?? '').trim();
  const media = String(formData.get('media_reference') ?? '').trim();
  const requestedType = String(formData.get('content_type') ?? 'homepage_section');
  const eventValue = String(formData.get('event_id') ?? '').trim();
  const order = Number(formData.get('display_order') ?? 0);
  const active = formData.get('is_active') === 'on';
  const publish = formData.get('is_published') === 'on';

  if (!contentKey || !/^[a-z0-9][a-z0-9_-]{1,79}$/.test(contentKey)) throw new Error('Use a unique content key with lowercase letters, numbers, hyphens, or underscores.');
  if (!title || title.length > 180 || (!body && !media)) throw new Error('Add a title and either content text or an image URL.');
  const typeValue = contentTypes.find((value) => value === requestedType);
  if (!typeValue) throw new Error('Choose a valid content type.');
  if (!Number.isInteger(order) || order < 0 || order > 10000) throw new Error('Display order must be a whole number from 0 to 10,000.');
  if (media && (!/^https:\/\//i.test(media) || media.length > 2048)) throw new Error('Media URL must be a valid HTTPS URL.');
  if (typeValue === 'featured_race' ? !uuid.test(eventValue) : Boolean(eventValue)) throw new Error('Featured race content needs one event. Other content types cannot be linked to an event.');
  if (typeValue === 'featured_race') {
    const { data: event, error } = await db.from('events').select('id').eq('id', eventValue).eq('review_status', 'approved').eq('lifecycle_status', 'published').maybeSingle();
    if (error || !event) throw new Error('Featured content must point to a published, approved event.');
  }
  if (publish && !active) throw new Error('Published content must also be active.');
  if (id && !uuid.test(id)) throw new Error('Invalid content record.');

  const { data: previous, error: previousError } = id
    ? await db.from('content_blocks').select('content_key,content_type,title,is_active,is_published,published_at,published_by').eq('id', id).maybeSingle()
    : { data: null, error: null };
  if (previousError || (id && !previous)) throw new Error('Content block could not be found.');

  const now = new Date().toISOString();
  const values = {
    content_key: contentKey,
    content_type: typeValue,
    title,
    body: body || null,
    media_reference: media || null,
    event_id: typeValue === 'featured_race' ? eventValue : null,
    display_order: order,
    is_active: active || publish,
    is_published: publish,
    published_at: publish ? (previous?.published_at ?? now) : null,
    published_by: publish ? (previous?.published_by ?? context.user.id) : null,
    updated_by: context.user.id,
  };

  if (id) {
    const { error } = await db.from('content_blocks').update(values).eq('id', id);
    if (error) throw new Error(error.code === '23505' ? 'That content key is already in use.' : 'Content block could not be saved.');
    const { error: auditError } = await db.from('audit_logs').insert({ actor_user_id: context.user.id, actor_role_context: context.internalRoles[0] ?? 'admin', action: publish ? 'content_block_updated_and_published' : 'content_block_updated', resource_type: 'content_block', resource_id: id, previous_values: previous, new_values: { content_key: contentKey, content_type: typeValue, title, is_active: active || publish, is_published: publish } });
    if (auditError) console.error('Content update audit record failed', auditError);
  } else {
    const { data, error } = await db.from('content_blocks').insert({ ...values, created_by: context.user.id }).select('id').single();
    if (error || !data) throw new Error(error?.code === '23505' ? 'That content key is already in use.' : 'Content block could not be created.');
    const { error: auditError } = await db.from('audit_logs').insert({ actor_user_id: context.user.id, actor_role_context: context.internalRoles[0] ?? 'admin', action: publish ? 'content_block_created_and_published' : 'content_block_created', resource_type: 'content_block', resource_id: data.id, new_values: { content_key: contentKey, content_type: typeValue, title, is_active: active || publish, is_published: publish } });
    if (auditError) console.error('Content creation audit record failed', auditError);
  }

  revalidatePath('/admin/content-management');
  redirect('/admin/content-management?notice=saved');
}
