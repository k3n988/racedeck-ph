import OrganizationDataPage from '@/components/organizer/organization-data-page';
export default function PayoutsPage() { return <OrganizationDataPage title="Payouts" endpoint="/api/organizer/payouts" columns={['payout_reference', 'status', 'gross_registration_sales', 'net_payout_amount', 'paid_at']} />; }
