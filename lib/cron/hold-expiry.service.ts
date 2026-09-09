import 'server-only';

import { createAdminClient } from '@/lib/supabase/admin';

type ServerRpcClient = {
  rpc(name: string, args?: Record<string, unknown>): Promise<{ data: unknown; error: { message: string } | null }>;
};

export async function expireRegistrationHolds(): Promise<{ holds_expired: number; payments_expired: number }> {
  const admin = createAdminClient();
  const { data: holdsExpired, error: holdError } = await admin.rpc('expire_stale_holds');
  if (holdError) throw holdError;

  const { data: payments, error: paymentError } = await admin
    .from('payments')
    .update({ status: 'expired' })
    .in('status', ['pending', 'processing'])
    .lt('expires_at', new Date().toISOString())
    .select('id,registration_id');
  if (paymentError) throw paymentError;

  const rpc = admin as unknown as ServerRpcClient;
  await Promise.all((payments ?? []).map((payment) => rpc.rpc('reverse_promo_redemption', {
    p_payment_id: payment.id,
    p_registration_id: payment.registration_id,
  })));

  const registrationIds = (payments ?? []).map((payment) => payment.registration_id);
  if (registrationIds.length) {
    const { error: registrationError } = await admin
      .from('registrations')
      .update({ status: 'expired' })
      .in('id', registrationIds)
      .eq('status', 'pending_payment');
    if (registrationError) throw registrationError;
  }

  return { holds_expired: typeof holdsExpired === 'number' ? holdsExpired : 0, payments_expired: payments?.length ?? 0 };
}
