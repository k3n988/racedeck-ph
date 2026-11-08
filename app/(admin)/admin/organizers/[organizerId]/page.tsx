import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Building2, ExternalLink, FileText } from 'lucide-react';
import { AdminPage, StatusBadge } from '@/components/admin/admin-ui';
import { createAdminClient } from '@/lib/supabase/admin';
import OrganizerReviewActions from './organizer-review-actions';

export const dynamic = 'force-dynamic';

function webUrl(value: string | null) {
  if (!value) return null;
  try {
    const url = new URL(value);
    return ['http:', 'https:'].includes(url.protocol) ? url.href : null;
  } catch { return null; }
}

export default async function AdminOrganizerDetails({ params }: { params: { organizerId: string } }) {
  const db = createAdminClient();
  const [organizationResult, verificationResult, eventsResult] = await Promise.all([
    db.from('organizations').select('id,name,slug,description,logo_url,account_status,verification_status,contact_person,contact_email,contact_phone,address,city,state_province,postal_code,country_code,website,created_at').eq('id', params.organizerId).maybeSingle(),
    db.from('organizer_verifications').select('id,status,legal_name,business_name,registration_number,document_storage_references,reviewer_notes,submitted_at,reviewed_at').eq('organization_id', params.organizerId).maybeSingle(),
    db.from('events').select('id,name,event_date,lifecycle_status,review_status').eq('organization_id', params.organizerId).order('event_date', { ascending: false }).limit(5),
  ]);
  if (organizationResult.error) return <AdminPage showHeading title="Organizer details" description="Review the organization profile and verification."><p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-5 text-sm text-red-800">Organization details could not be loaded. Refresh to try again.</p></AdminPage>;
  const organization = organizationResult.data;
  if (!organization) notFound();
  const verification = verificationResult.data;
  const refs = Array.isArray(verification?.document_storage_references) ? verification.document_storage_references : [];
  const documents = await Promise.all(refs.map(async (value) => {
    if (!value || typeof value !== 'object' || Array.isArray(value) || !('path' in value) || typeof value.path !== 'string') return null;
    const path = value.path;
    const name = 'name' in value && typeof value.name === 'string' ? value.name : path.split('/').at(-1) ?? 'Document';
    const signed = await db.storage.from('organizer-verification').createSignedUrl(path, 300);
    return { path, name, url: signed.data?.signedUrl ?? null };
  }));
  const website = webUrl(organization.website);
  const address = [organization.address, organization.city, organization.state_province, organization.postal_code, organization.country_code].filter(Boolean).join(', ');
  const formatDate = (value: string) => new Date(value).toLocaleString('en-PH', { timeZone: 'Asia/Manila', dateStyle: 'medium', timeStyle: 'short' });

  return <AdminPage showHeading eyebrow="Platform / Organizer review" title={organization.name} description="Review the organization, its documents, and its events before making a decision." action={<Link href="/admin/organizers?status=pending_review" className="rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-bold text-[#071b41]">← Review queue</Link>}>
    <div className="flex flex-wrap items-center gap-2"><StatusBadge value={verification?.status ?? organization.verification_status} /><StatusBadge value={organization.account_status} /><span className="text-xs text-slate-500">Organization ID: {organization.id}</span></div>
    {verificationResult.error && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">Verification details could not be loaded. Review actions are unavailable until this is resolved.</p>}
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1.5fr)_minmax(320px,1fr)]">
      <div className="min-w-0 space-y-5">
        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-4">{organization.logo_url ? <Image src={organization.logo_url} alt={`${organization.name} logo`} width={56} height={56} unoptimized className="h-14 w-14 rounded-xl border border-slate-100 object-cover" /> : <span className="grid h-14 w-14 place-items-center rounded-xl bg-slate-100 text-slate-500"><Building2 size={24} aria-hidden="true" /></span>}<div><h2 className="text-lg font-extrabold text-[#071b41]">Organization profile</h2><p className="text-sm text-slate-500">Created {formatDate(organization.created_at)}</p></div></div>
          <p className="mt-4 whitespace-pre-wrap text-sm leading-6 text-slate-700">{organization.description || 'No organization description provided.'}</p>
          <dl className="mt-4 grid gap-4 border-t border-slate-100 pt-4 text-sm sm:grid-cols-2">
            <div><dt className="font-bold text-[#071b41]">Primary contact</dt><dd className="mt-1 text-slate-700">{organization.contact_person || 'Not provided'}</dd></div>
            <div><dt className="font-bold text-[#071b41]">Email</dt><dd className="mt-1 break-all text-slate-700">{organization.contact_email || 'Not provided'}</dd></div>
            <div><dt className="font-bold text-[#071b41]">Phone</dt><dd className="mt-1 text-slate-700">{organization.contact_phone || 'Not provided'}</dd></div>
            <div><dt className="font-bold text-[#071b41]">Location</dt><dd className="mt-1 text-slate-700">{address || 'Not provided'}</dd></div>
          </dl>
          {website && <a href={website} target="_blank" rel="noopener noreferrer" className="mt-4 inline-flex items-center gap-1 text-sm font-bold text-orange-600">Visit website <ExternalLink size={15} aria-hidden="true" /></a>}
        </section>
        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"><h2 className="text-lg font-extrabold text-[#071b41]">Verification submission</h2>
          {verification ? <><dl className="mt-4 grid gap-4 text-sm sm:grid-cols-2"><div><dt className="font-bold text-[#071b41]">Legal name</dt><dd className="mt-1 text-slate-700">{verification.legal_name || 'Not provided'}</dd></div><div><dt className="font-bold text-[#071b41]">Business name</dt><dd className="mt-1 text-slate-700">{verification.business_name || 'Not provided'}</dd></div><div><dt className="font-bold text-[#071b41]">Registration number</dt><dd className="mt-1 text-slate-700">{verification.registration_number || 'Not provided'}</dd></div><div><dt className="font-bold text-[#071b41]">Submitted</dt><dd className="mt-1 text-slate-700">{verification.submitted_at ? formatDate(verification.submitted_at) : 'Not submitted'}</dd></div></dl>{verification.reviewed_at && <p className="mt-4 text-sm text-slate-500">Last reviewed {formatDate(verification.reviewed_at)}</p>}{verification.reviewer_notes && <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm"><p className="font-bold text-amber-950">Latest review feedback</p><p className="mt-1 whitespace-pre-wrap text-amber-900">{verification.reviewer_notes}</p></div>}</> : <p className="mt-3 text-sm text-slate-500">{verificationResult.error ? 'Verification submission details are temporarily unavailable. Refresh the page to try again.' : 'No verification application has been submitted for this organization.'}</p>}
        </section>
        {verification && <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"><h2 className="flex items-center gap-2 text-lg font-extrabold text-[#071b41]"><FileText size={19} aria-hidden="true" /> Verification documents</h2><p className="mt-1 text-xs text-slate-500">Document links expire after five minutes.</p>{documents.filter(Boolean).length ? <ul className="mt-4 space-y-2">{documents.filter((item): item is NonNullable<typeof item> => Boolean(item)).map((document) => <li key={document.path} className="rounded-lg border border-slate-200 p-3 text-sm">{document.url ? <a href={document.url} target="_blank" rel="noopener noreferrer" className="break-all font-semibold text-orange-600 hover:underline">{document.name} ↗</a> : <span className="text-red-700">{document.name} — unavailable; refresh to retry</span>}</li>)}</ul> : <p className="mt-3 text-sm text-slate-500">No documents attached.</p>}</section>}
      </div>
      <div className="min-w-0 space-y-5">
        {verification && !verificationResult.error && <OrganizerReviewActions organizationId={organization.id} reviewStatus={verification.status} />}
        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"><h2 className="font-extrabold text-[#071b41]">Organization activity</h2>{eventsResult.error ? <p className="mt-3 text-sm text-red-700">Events could not be loaded.</p> : eventsResult.data?.length ? <ul className="mt-3 divide-y divide-slate-100">{eventsResult.data.map((event) => <li key={event.id}><Link href={`/admin/events/${event.id}`} className="block py-3 hover:text-orange-600"><span className="block text-sm font-bold">{event.name}</span><span className="text-xs text-slate-500">{new Date(event.event_date).toLocaleDateString('en-PH', { timeZone: 'Asia/Manila' })} · {event.review_status.replaceAll('_', ' ')}</span></Link></li>)}</ul> : <p className="mt-3 text-sm text-slate-500">No events created yet.</p>}</section>
      </div>
    </div>
  </AdminPage>;
}
