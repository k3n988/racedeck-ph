import EventWorkspaceLayout from '@/components/organizer/event-workspace-layout';

export default function OrganizerEventLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: { eventId: string };
}) {
  return <EventWorkspaceLayout eventId={params.eventId}>{children}</EventWorkspaceLayout>;
}
