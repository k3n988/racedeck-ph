import { notFound, redirect } from 'next/navigation';
import { getPublicEventDetails } from '@/lib/public/events';

/**
 * Organization-first registration URL. Resolve the public event and verify
 * the organization segment so a copied or mistyped URL cannot point to a
 * different organizer's event.
 */
export default async function RegisterByOrganizationAndEventPage({
  params,
}: {
  params: { organizationSlug: string; eventSlug: string };
}) {
  const event = await getPublicEventDetails(params.eventSlug);
  if (!event || event.organizer_details?.slug !== params.organizationSlug) notFound();

  redirect(`/events/${encodeURIComponent(event.slug)}/register`);
}
