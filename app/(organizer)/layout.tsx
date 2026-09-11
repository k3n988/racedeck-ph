import { requireOrganizationContext } from '@/lib/auth/rbac';
import OrganizerShell from '@/components/organizer/organizer-shell';

export default async function OrganizerLayout({ children }: { children: React.ReactNode }) {
  const { context } = await requireOrganizationContext();
  return <OrganizerShell email={context.user.email}>{children}</OrganizerShell>;
}
