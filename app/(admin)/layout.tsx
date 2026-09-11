import { requireInternalAccess } from '@/lib/auth/rbac';
import AdminShell from '@/components/admin/admin-shell';

export default async function AdminRouteGroupLayout({ children }: { children: React.ReactNode }) {
  const context = await requireInternalAccess();
  return <AdminShell email={context.user.email}>{children}</AdminShell>;
}
