import { requireInternalAccess } from '@/lib/auth/rbac';
import { createAdminClient } from '@/lib/supabase/admin';
import OrganizerListClient, { type OrganizerApplication } from './organizer-list-client';

export default async function OrganizerApplicationsPage() {
  await requireInternalAccess();
  const admin = createAdminClient();
  const { data } = await admin.from('organizer_verifications').select('organization_id,status,submitted_at,organizations!inner(name,account_status,verification_status)').order('submitted_at', { ascending: false });
  const applications = (data ?? []).map((item): OrganizerApplication => ({ organizationId: item.organization_id, status: item.status, submittedAt: item.submitted_at, organization: { name: item.organizations.name, accountStatus: item.organizations.account_status, verificationStatus: item.organizations.verification_status } }));
  return <OrganizerListClient initialApplications={applications}/>;
}
