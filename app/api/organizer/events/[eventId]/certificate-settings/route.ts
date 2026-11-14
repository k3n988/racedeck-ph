import { NextResponse } from 'next/server';
import { z } from 'zod';
import { hasPermission, loadAuthContext } from '@/lib/auth/permissions';
import { isSafeCertificateAssetUrl } from '@/lib/certificates/asset-url';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import type { Json } from '@/types/database.types';

const imageReferenceSchema = z.string().trim().max(1000).nullable().refine(
  isSafeCertificateAssetUrl,
  'Certificate images must use the configured RaceDeck/Supabase storage URL.',
);

const schema = z.object({
  enabled: z.boolean(),
  template_id: z.string().uuid().nullable(),
  certificate_title: z.string().trim().max(240).nullable(),
  event_logo_reference: imageReferenceSchema,
  organizer_logo_reference: imageReferenceSchema,
  sponsor_logo_config: z.array(z.unknown()).max(20),
  signature_image_reference: imageReferenceSchema,
  signatory_name: z.string().trim().max(200).nullable(),
  signatory_position: z.string().trim().max(200).nullable(),
  certificate_message: z.string().trim().max(4000).nullable(),
  eligibility_mode: z.enum(['finished_all', 'finished_selected_categories', 'organizer_defined']),
  category_ids: z.array(z.string().uuid()).max(100),
});

async function authorize(eventId: string) {
  const context = await loadAuthContext();
  if (!context) return { response: NextResponse.json({ error: 'Authentication required' }, { status: 401 }) } as const;
  const membership = context.memberships[0];
  if (!membership || !(await hasPermission(membership.organization_id, 'manage_certificates', eventId))) {
    return { response: NextResponse.json({ error: 'Certificate permission required' }, { status: 403 }) } as const;
  }
  const supabase = await createClient();
  const { data: event, error } = await supabase.from('events')
    .select('id,organization_id,name,event_date,logo_url')
    .eq('id', eventId)
    .eq('organization_id', membership.organization_id)
    .maybeSingle();
  if (error) return { response: NextResponse.json({ error: 'Event could not be checked' }, { status: 500 }) } as const;
  if (!event) return { response: NextResponse.json({ error: 'Event not found' }, { status: 404 }) } as const;
  return { context, event } as const;
}

export async function GET(_request: Request, { params }: { params: { eventId: string } }) {
  const result = await authorize(params.eventId);
  if ('response' in result) return result.response;
  const admin = createAdminClient();
  const [settingsResult, categoriesResult, templatesResult, organizationResult, issuedCountResult] = await Promise.all([
    admin.from('event_certificate_settings')
      .select('id,event_id,organization_id,enabled,template_id,certificate_title,event_logo_reference,organizer_logo_reference,sponsor_logo_config,signature_image_reference,signatory_name,signatory_position,certificate_message,eligibility_mode,created_at,updated_at,event_certificate_categories(race_category_id)')
      .eq('event_id', params.eventId).eq('organization_id', result.event.organization_id).maybeSingle(),
    admin.from('race_categories').select('id,name').eq('event_id', params.eventId).order('name'),
    admin.from('certificate_templates')
      .select('id,name,certificate_title,version,status,is_system_template,organization_id,background_asset_reference,layout_config')
      .eq('status', 'active').or(`is_system_template.eq.true,organization_id.eq.${result.event.organization_id}`).order('name'),
    admin.from('organizations').select('logo_url').eq('id', result.event.organization_id).maybeSingle(),
    admin.from('certificates').select('id', { count: 'exact', head: true }).eq('event_id', params.eventId).eq('status', 'issued'),
  ]);
  const failures = [
    ['certificate settings', settingsResult.error],
    ['event categories', categoriesResult.error],
    ['certificate templates', templatesResult.error],
    ['organizer details', organizationResult.error],
    ['issued certificates', issuedCountResult.error],
  ] as const;
  const failedQuery = failures.find(([, queryError]) => queryError);
  if (failedQuery) {
    const [section, queryError] = failedQuery;
    console.error(`Unable to load ${section} for certificate settings`, queryError);
    const code = queryError?.code;
    const migrationIssue = code === '42P01' || code === '42703' || code?.startsWith('PGRST');
    const message = migrationIssue
      ? `The ${section} schema is not available in Supabase. Apply the pending certificate module migrations and try again.`
      : `The ${section} could not be loaded${code ? ` (database error ${code})` : ''}. Try again.`;
    return NextResponse.json({ error: message }, { status: 500 });
  }
  const savedSettings = settingsResult.data;
  return NextResponse.json({
    event: { name: result.event.name, event_date: result.event.event_date, logo_url: result.event.logo_url, organizer_logo_url: organizationResult.data?.logo_url ?? null },
    settings: savedSettings ? { ...savedSettings, category_ids: savedSettings.event_certificate_categories.map((item) => item.race_category_id) } : null,
    categories: categoriesResult.data ?? [],
    templates: templatesResult.data ?? [],
    issued_count: issuedCountResult.count ?? 0,
  });
}

export async function POST(request: Request, { params }: { params: { eventId: string } }) {
  const result = await authorize(params.eventId);
  if ('response' in result) return result.response;
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid certificate settings' }, { status: 400 });

  const categoryIds = Array.from(new Set(parsed.data.category_ids));
  if (parsed.data.enabled && !parsed.data.template_id) {
    return NextResponse.json({ error: 'Choose a certificate template before enabling certificates' }, { status: 400 });
  }
  if (parsed.data.eligibility_mode === 'finished_selected_categories' && categoryIds.length === 0) {
    return NextResponse.json({ error: 'Select at least one eligible category' }, { status: 400 });
  }

  const admin = createAdminClient();
  if (categoryIds.length) {
    const { count, error } = await admin.from('race_categories').select('id', { count: 'exact', head: true })
      .eq('event_id', params.eventId).in('id', categoryIds);
    if (error) return NextResponse.json({ error: 'Certificate categories could not be checked' }, { status: 500 });
    if (count !== categoryIds.length) return NextResponse.json({ error: 'One or more categories do not belong to this event' }, { status: 400 });
  }

  if (parsed.data.template_id) {
    const { data: template, error } = await admin.from('certificate_templates').select('id')
      .eq('id', parsed.data.template_id).eq('status', 'active')
      .or(`is_system_template.eq.true,organization_id.eq.${result.event.organization_id}`).maybeSingle();
    if (error) return NextResponse.json({ error: 'Certificate template could not be checked' }, { status: 500 });
    if (!template) return NextResponse.json({ error: 'Template is not available for this organization' }, { status: 400 });
  }

  const { data: settingsId, error } = await admin.rpc('save_event_certificate_settings', {
    p_event_id: params.eventId,
    p_organization_id: result.event.organization_id,
    p_settings: parsed.data as unknown as Json,
    p_category_ids: categoryIds,
  });
  if (error || !settingsId) {
    console.error('Unable to save certificate settings', error);
    const message = error?.message.includes('eligible category') ? 'Select at least one eligible category' : 'Certificate settings could not be saved';
    return NextResponse.json({ error: message }, { status: 500 });
  }
  return NextResponse.json({ id: settingsId, ...parsed.data, category_ids: categoryIds });
}
