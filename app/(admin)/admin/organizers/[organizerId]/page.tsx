import { requireInternalAccess } from '@/lib/auth/rbac';
import OrganizerReviewClient from './organizer-review-client';

export default async function OrganizerApplicationPage({ params }: { params: { organizerId: string } }) {
  await requireInternalAccess();
  return <OrganizerReviewClient organizerId={params.organizerId}/>;
}
