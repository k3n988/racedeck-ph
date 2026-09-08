import { requireAuth } from '@/lib/auth/rbac';

export default async function ParticipantLayout({ children }: { children: React.ReactNode }) {
  await requireAuth();
  return <>{children}</>;
}
