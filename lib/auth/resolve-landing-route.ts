import 'server-only';

import { loadAuthContext } from './permissions';

/** Resolve the default portal after authentication. Internal staff always wins. */
export async function resolveLandingRoute() {
  const context = await loadAuthContext();
  if (!context) return '/login';
  if (context.internalRoles.includes('super_admin') || context.internalRoles.includes('admin')) return '/admin/dashboard';
  if (context.internalRoles.includes('finance')) return '/admin/finance/transactions';
  if (context.internalRoles.includes('support')) return '/admin/support';
  const organizer = context.memberships.find((membership) => membership.is_active);
  if (organizer) return organizer.organization?.verification_status === 'approved' ? '/organizer/dashboard' : '/organizer/verification';
  return null;
}
