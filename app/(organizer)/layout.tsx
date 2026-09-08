import { requireOrganizationContext } from '@/lib/auth/rbac';

export default async function OrganizerLayout({ children }: { children: React.ReactNode }) {
  await requireOrganizationContext();
  return <>{children}</>;
}
