import { notFound } from 'next/navigation';
import { getPublicEventDetails } from '@/lib/public/events';
import { EventDetailsClient } from './event-details-client';

export default async function EventDetailsPage({ params }: { params: { eventId: string } }) {
  const event = await getPublicEventDetails(params.eventId);
  if (!event) notFound();
  return <EventDetailsClient event={event} />;
}
