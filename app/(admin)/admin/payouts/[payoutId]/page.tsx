import { redirect } from 'next/navigation';

export default function LegacyPayoutDetails({ params }: { params: { payoutId: string } }) {
  redirect(`/admin/finance/payouts/${encodeURIComponent(params.payoutId)}`);
}
