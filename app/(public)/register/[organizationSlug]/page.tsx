import { redirect } from 'next/navigation';

/**
 * Short, shareable participant registration URL. Keep the event slug in the
 * address bar while the existing event registration screen handles the flow.
 */
export default function RegisterByEventSlugPage({ params }: { params: { organizationSlug: string } }) {
  // One segment is the legacy event-only URL. The two-segment route treats it as an organization slug.
  redirect(`/events/${encodeURIComponent(params.organizationSlug)}/register`);
}
