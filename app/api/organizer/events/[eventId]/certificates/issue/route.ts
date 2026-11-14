import { randomBytes } from 'node:crypto';
import { NextResponse } from 'next/server';
import { hasPermission, loadAuthContext } from '@/lib/auth/permissions';
import { isSafeCertificateAssetUrl } from '@/lib/certificates/asset-url';
import { readCertificateLayout } from '@/lib/certificates/layout';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';

const PAGE_SIZE = 300;

function certificateToken() { return randomBytes(32).toString('hex'); }
function certificateReference() { return `RD-CERT-${randomBytes(8).toString('hex').toUpperCase()}`; }

export async function POST(request: Request, { params }: { params: { eventId: string } }) {
  const context = await loadAuthContext();
  if (!context) return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  const membership = context.memberships[0];
  if (!membership || !(await hasPermission(membership.organization_id, 'manage_certificates', params.eventId))) {
    return NextResponse.json({ error: 'Certificate permission required' }, { status: 403 });
  }

  const supabase = await createClient();
  const { data: event, error: eventError } = await supabase.from('events')
    .select('id,organization_id,name,event_date,logo_url').eq('id', params.eventId)
    .eq('organization_id', membership.organization_id).maybeSingle();
  if (eventError || !event) return NextResponse.json({ error: 'Event could not be loaded' }, { status: eventError ? 500 : 404 });

  const admin = createAdminClient();
  const [{ data: settings, error: settingsError }, { data: organization, error: organizationError }] = await Promise.all([
    admin.from('event_certificate_settings')
      .select('id,enabled,template_id,certificate_title,event_logo_reference,organizer_logo_reference,signature_image_reference,signatory_name,signatory_position,certificate_message,eligibility_mode,sponsor_logo_config')
      .eq('event_id', params.eventId).eq('organization_id', event.organization_id).maybeSingle(),
    admin.from('organizations').select('name,logo_url').eq('id', event.organization_id).maybeSingle(),
  ]);
  if (settingsError || organizationError) {
    console.error('Certificate issuance settings lookup failed', settingsError ?? organizationError);
    return NextResponse.json({ error: 'Certificate settings could not be loaded. Apply the pending certificate module migrations.' }, { status: 500 });
  }
  if (!settings?.enabled || !settings.template_id) return NextResponse.json({ error: 'Enable certificates and save a template before issuing them.' }, { status: 409 });
  if (settings.eligibility_mode !== 'organizer_defined') {
    return NextResponse.json({ error: 'Choose “All confirmed participants” and save settings before issuing certificates to everyone.' }, { status: 409 });
  }

  const { data: template, error: templateError } = await admin.from('certificate_templates')
    .select('id,name,certificate_title,version,layout_config,background_asset_reference,event_logo_reference,organizer_logo_reference,signature_image_reference,signatory_name,signatory_position,certificate_message')
    .eq('id', settings.template_id).eq('status', 'active')
    .or(`is_system_template.eq.true,organization_id.eq.${event.organization_id}`).maybeSingle();
  if (templateError || !template) {
    console.error('Certificate template lookup failed', templateError);
    return NextResponse.json({ error: 'The selected certificate template is unavailable.' }, { status: 409 });
  }

  const layout = readCertificateLayout(settings.sponsor_logo_config);
  const backgroundReference = layout.background_reference ?? template.background_asset_reference;
  const eventLogoReference = settings.event_logo_reference ?? event.logo_url ?? template.event_logo_reference;
  const organizerLogoReference = settings.organizer_logo_reference ?? organization?.logo_url ?? template.organizer_logo_reference;
  const signatureImageReference = settings.signature_image_reference ?? template.signature_image_reference;
  if ([backgroundReference, eventLogoReference, organizerLogoReference, signatureImageReference].some((reference) => !isSafeCertificateAssetUrl(reference))) {
    return NextResponse.json({ error: 'Certificate image URLs must use the configured RaceDeck/Supabase storage URL.' }, { status: 409 });
  }
  const existingByRegistration = new Map<string, { id: string; verification_token: string; status: 'generated' | 'issued' }>();
  for (let offset = 0; ; offset += PAGE_SIZE) {
    const { data, error } = await admin.from('certificates').select('id,registration_id,verification_token,status')
      .eq('event_id', params.eventId).in('status', ['generated', 'issued']).order('id')
      .range(offset, offset + PAGE_SIZE - 1);
    if (error) {
      console.error('Existing event certificates could not be checked', error);
      return NextResponse.json({ error: 'Existing certificates could not be checked.' }, { status: 500 });
    }
    const generated = (data ?? []).filter((certificate) => certificate.status === 'generated');
    for (const certificate of generated) {
      const { error: issueError } = await admin.from('certificates').update({
        status: 'issued',
        verification_path: `/api/certificates/${certificate.verification_token}`,
      }).eq('id', certificate.id);
      if (issueError) {
        console.error('Generated certificates could not be issued', issueError);
        return NextResponse.json({ error: 'Previously generated certificates could not be issued.' }, { status: 500 });
      }
    }
    for (const certificate of data ?? []) existingByRegistration.set(certificate.registration_id, { ...certificate, status: 'issued' });
    if ((data?.length ?? 0) < PAGE_SIZE) break;
  }

  let participants = 0;
  let issued = 0;
  let queued = 0;
  for (let offset = 0; ; offset += PAGE_SIZE) {
    const { data, error } = await admin.from('registrations')
      .select('id,registration_number,user_id,email,first_name,middle_name,last_name,category_id,race_categories!inner(name)')
      .eq('event_id', params.eventId).eq('status', 'confirmed').order('id')
      .range(offset, offset + PAGE_SIZE - 1);
    if (error) {
      console.error('Confirmed participants could not be loaded for certificates', error);
      return NextResponse.json({ error: 'Confirmed participants could not be loaded.' }, { status: 500 });
    }
    const registrations = (data ?? []) as unknown as Array<{
      id: string; registration_number: string; user_id: string | null; email: string;
      first_name: string; middle_name: string | null; last_name: string; category_id: string; race_categories: { name: string };
    }>;
    if (!registrations.length) break;
    participants += registrations.length;

    const missing = registrations.filter((registration) => !existingByRegistration.has(registration.id));
    for (let index = 0; index < missing.length; index += 100) {
      const batch = missing.slice(index, index + 100);
      const rows = batch.map((registration) => {
        const token = certificateToken();
        const participant = [registration.first_name, registration.middle_name, registration.last_name].filter((part) => part?.trim()).join(' ');
        const snapshot = {
          participant,
          event: event.name,
          category: registration.race_categories.name,
          date: event.event_date,
          bib: '',
          finishTime: '',
          rank: '',
          reference: '',
          verification: token,
          organizer: organization?.name ?? '',
          signature: settings.signatory_name ?? template.signatory_name ?? '',
          signaturePosition: settings.signatory_position ?? template.signatory_position ?? '',
          title: settings.certificate_title || template.certificate_title,
          message: settings.certificate_message ?? template.certificate_message ?? '',
          templateName: template.name,
          templateVersion: template.version,
          backgroundReference,
          eventLogo: eventLogoReference,
          organizerLogo: organizerLogoReference,
          signatureImage: signatureImageReference,
          participantNamePosition: layout.participant_name_position,
        };
        return {
          certificate_reference: certificateReference(),
          verification_token: token,
          verification_path: `/api/certificates/${token}`,
          organization_id: event.organization_id,
          event_id: params.eventId,
          registration_id: registration.id,
          participant_id: registration.user_id,
          race_category_id: registration.category_id,
          result_id: null,
          bib_id: null,
          participant_name_snapshot: participant,
          event_name_snapshot: event.name,
          category_name_snapshot: registration.race_categories.name,
          event_date_snapshot: event.event_date,
          finish_time_snapshot: null,
          rank_snapshot: null,
          bib_code_snapshot: null,
          template_id: template.id,
          template_version: template.version,
          template_snapshot: snapshot,
          document_storage_reference: null,
          generated_by: context.user.id,
          generation_metadata: { certificate_type: 'participation', template_name: template.name },
          status: 'issued' as const,
        };
      });
      const { data: created, error: createError } = await admin.from('certificates').insert(rows)
        .select('id,registration_id,verification_token,status');
      if (createError) {
        // A second organizer request can win the active-registration unique
        // index between our initial read and this insert. Treat that race as
        // success when every registration now has its certificate.
        const { data: raced, error: raceReadError } = await admin.from('certificates')
          .select('id,registration_id,verification_token,status')
          .eq('event_id', params.eventId).in('registration_id', batch.map((registration) => registration.id))
          .in('status', ['generated', 'issued']);
        if (raceReadError || (raced?.length ?? 0) !== batch.length) {
          console.error('Participation certificates could not be created', createError, raceReadError);
          return NextResponse.json({ error: 'Certificates could not be generated. Check the certificate migrations and template settings.' }, { status: 500 });
        }
        for (const certificate of raced ?? []) {
          if (certificate.status === 'generated') {
            const { error: issueError } = await admin.from('certificates').update({
              status: 'issued',
              verification_path: `/api/certificates/${certificate.verification_token}`,
            }).eq('id', certificate.id);
            if (issueError) return NextResponse.json({ error: 'A previously generated certificate could not be issued.' }, { status: 500 });
          }
          existingByRegistration.set(certificate.registration_id, {
            id: certificate.id,
            verification_token: certificate.verification_token,
            status: 'issued',
          });
        }
        issued += raced?.filter((certificate) => certificate.status === 'generated').length ?? 0;
      } else {
        for (const certificate of created ?? []) existingByRegistration.set(certificate.registration_id, {
          id: certificate.id,
          verification_token: certificate.verification_token,
          status: 'issued',
        });
        issued += created?.length ?? 0;
      }
    }

    const emailRows = registrations.flatMap((registration) => {
      const certificate = existingByRegistration.get(registration.id);
      if (!certificate) return [];
      const downloadUrl = new URL(`/api/certificates/${certificate.verification_token}`, request.url).toString();
      return [{
        recipient_email: registration.email,
        recipient_user_id: registration.user_id,
        organization_id: event.organization_id,
        event_id: params.eventId,
        registration_id: registration.id,
        email_type: 'e_certificate_available' as const,
        template_version: 1,
        template_snapshot: { type: 'certificate_ready', event_name: event.name, download_url: downloadUrl },
        subject: `Your certificate - ${event.name}`,
        status: 'queued' as const,
        idempotency_key: `certificate:${certificate.id}:email`,
      }];
    });
    if (emailRows.length) {
      const { data: queuedEmails, error: emailQueueError } = await admin.from('email_messages')
        .upsert(emailRows, { onConflict: 'idempotency_key', ignoreDuplicates: true }).select('id');
      if (emailQueueError) {
        console.error('Certificate emails could not be queued', emailQueueError);
        return NextResponse.json({ error: 'Certificates were created, but participant emails could not be queued.' }, { status: 500 });
      }
      queued += queuedEmails?.length ?? 0;
    }
    if (registrations.length < PAGE_SIZE) break;
  }

  return NextResponse.json({ participants, certificates_issued: issued, emails_queued: queued, already_issued: Math.max(participants - issued, 0) }, { status: 200 });
}
