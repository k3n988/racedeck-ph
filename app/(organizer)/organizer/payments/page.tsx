import OrganizationDataPage from '@/components/organizer/organization-data-page';
export default function PaymentsPage() { return <OrganizationDataPage title="Payments" endpoint="/api/organizer/payments" columns={['id', 'event_id', 'status', 'amount_paid', 'amount_refunded', 'paid_at']} />; }
