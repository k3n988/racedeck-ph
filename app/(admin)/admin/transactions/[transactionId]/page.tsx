import { redirect } from 'next/navigation';

export default function LegacyTransactionDetails({ params }: { params: { transactionId: string } }) {
  redirect(`/admin/finance/transactions/${encodeURIComponent(params.transactionId)}`);
}
