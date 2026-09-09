import { createAdminClient } from '@/lib/supabase/admin';
import { registrationQrDataUrl } from '@/lib/qr/qr.service';
import { calculatePaymentTotal } from '@/lib/payments/pricing.service';

export async function createPostPaymentArtifacts(paymentId: string) {
  const admin = createAdminClient();
  const { data: payment } = await admin.from('payments').select('*').eq('id', paymentId).maybeSingle();
  if (!payment || payment.status !== 'succeeded') return;
  const { data: registration } = await admin.from('registrations').select('id,registration_number,event_id,category_id,user_id,first_name,last_name,email').eq('id', payment.registration_id).maybeSingle();
  const { data: event } = await admin.from('events').select('id,organization_id,name,event_date,venue').eq('id', payment.event_id).maybeSingle();
  const { data: category } = await admin.from('race_categories').select('name,registration_fee').eq('id', registration?.category_id ?? '').maybeSingle();
  const { data: organization } = await admin.from('organizations').select('name,address,invoice_mode').eq('id', payment.organization_id).maybeSingle();
  if (!registration || !event || !category || !organization) return;
  const metadata = (payment.metadata ?? {}) as Record<string, unknown>;
  // Documents must use the payment-time snapshot, never the current category
  // price or current fee configuration. The fallback keeps historical rows
  // created before snapshot metadata existed readable.
  const registrationAmount = Number(metadata.registration_amount ?? payment.amount_due);
  const pricing = calculatePaymentTotal({ registrationAmount, processingFee: Number(metadata.processing_fee ?? 0), platformFee: Number(metadata.platform_fee ?? 0), discountAmount: Number(metadata.discount_amount ?? 0) }); const processingFee = pricing.processingFee ?? 0; const platformFee = pricing.platformFee ?? 0; const discount = pricing.discountAmount ?? 0;
  const { data: receipt } = await admin.from('payment_receipts').upsert({ payment_id: payment.id, registration_id: registration.id, event_id: event.id, organization_id: payment.organization_id, receipt_reference: `RCT-${registration.registration_number}`, organization_name: organization.name, participant_name: `${registration.first_name} ${registration.last_name}`, participant_email: registration.email, event_name: event.name, race_category_name: category.name, registration_number: registration.registration_number, registration_amount: registrationAmount, processing_fee: processingFee, platform_fee: platformFee, discount_amount: discount, total_paid: pricing.totalAmount, currency: payment.currency, payment_method: String(metadata.payment_method ?? payment.gateway), gateway_transaction_reference: String(metadata.gateway_transaction_reference ?? payment.gateway_payment_id ?? ''), payment_date: payment.paid_at ?? new Date().toISOString(), payment_status: payment.status }, { onConflict: 'payment_id' }).select('id,receipt_reference').single();
  if (receipt && organization.invoice_mode === 'receipt_and_sales_invoice') await admin.from('invoices').upsert({ invoice_reference: `INV-${registration.registration_number}`, payment_id: payment.id, registration_id: registration.id, event_id: event.id, organization_id: payment.organization_id, issuance_mode: 'receipt_and_sales_invoice', issuer_organization_name: organization.name, issuer_address: organization.address ?? 'Not configured', participant_name: `${registration.first_name} ${registration.last_name}`, participant_email: registration.email, event_name: event.name, registration_number: registration.registration_number, line_items: [{ description: category.name, amount: registrationAmount }], registration_amount: registrationAmount, processing_fee: processingFee, platform_fee: platformFee, discount_amount: discount, subtotal_amount: pricing.subtotalAmount, tax_amount: 0, total_amount: pricing.totalAmount, currency: payment.currency, status: 'issued', issued_at: new Date().toISOString() }, { onConflict: 'payment_id' });
  const qr = await registrationQrDataUrl(registration.id);
  if (registration.email) await admin.from('email_messages').upsert({ recipient_email: registration.email, recipient_user_id: registration.user_id, organization_id: payment.organization_id, event_id: event.id, registration_id: registration.id, payment_id: payment.id, receipt_id: receipt?.id ?? null, email_type: 'registration_confirmed', template_version: 1, template_snapshot: { type: 'registration_confirmed', body: `Your registration for ${event.name} is confirmed.` }, subject: `Registration Confirmed — ${event.name}`, rendered_body_reference: qr.dataUrl, status: 'queued', idempotency_key: `registration-confirmed:${registration.id}` }, { onConflict: 'idempotency_key' });
}
