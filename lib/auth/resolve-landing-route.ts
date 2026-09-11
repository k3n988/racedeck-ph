import 'server-only';

import { loadAuthContext } from './permissions';

/** Resolve the default portal after authentication. Internal staff always wins. */
export async function resolveLandingRoute() {
  const context = await loadAuthContext();
  if (!context) return '/login';
  if (context.internalRoles.includes('admin') || context.internalRoles.includes('super_admin')) return '/admin/dashboard';
  const organizer = context.memberships.find((membership) => membership.is_active);
  if (organizer) return organizer.organization?.verification_status === 'approved' ? '/organizer/dashboard' : '/organizer/verification';
  return '/dashboard';
}
