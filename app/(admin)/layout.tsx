import { requireInternalAccess } from '@/lib/auth/rbac';

export default async function AdminRouteGroupLayout({ children }: { children: React.ReactNode }) {
  await requireInternalAccess();
  return <>{children}</>;
}
