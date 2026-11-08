import { createAdminClient } from '@/lib/supabase/admin';
import { registrationQrDataUrl } from '@/lib/qr/qr.service';
import { calculatePaymentTotal } from '@/lib/payments/pricing.service';

export async function createPostPaymentArtifacts(paymentId: string) {
  const admin = createAdminClient();
  const { data: payment } = await admin.from('payments').select('*').eq('id', paymentId).maybeSingle();
  if (!payment || payment.status !== 'succeeded') return;

  const { data: primary } = await admin.from('registrations').select('id,registration_number,event_id,category_id,user_id,first_name,last_name,email,checkout_group_id').eq('id', payment.registration_id).maybeSingle();
  const { data: event } = await admin.from('events').select('id,organization_id,name,event_date,venue').eq('id', payment.event_id).maybeSingle();
  const { data: organization } = await admin.from('organizations').select('name,address,invoice_mode').eq('id', payment.organization_id).maybeSingle();
  if (!primary || !event || !organization) return;

  const metadata = payment.metadata && typeof payment.metadata === 'object' && !Array.isArray(payment.metadata) ? payment.metadata as Record<string, unknown> : {};
  const registrationIds = Array.isArray(metadata.registration_ids) ? metadata.registration_ids.filter((id): id is string => typeof id === 'string') : [primary.id];
  const { data: groupedRows } = primary.checkout_group_id
    ? await admin.from('registrations').select('id,registration_number,event_id,category_id,user_id,first_name,last_name,email,checkout_group_id').eq('checkout_group_id', primary.checkout_group_id).eq('event_id', event.id)
    : { data: [primary] };
  const participants = (groupedRows ?? []).filter((row) => registrationIds.includes(row.id));
  if (!participants.length || !participants.some((row) => row.id === primary.id)) return;
  const categoryIds = Array.from(new Set(participants.map((row) => row.category_id)));
  const { data: categoryRows } = await admin.from('race_categories').select('id,name,registration_fee').in('id', categoryIds);
  const categories = new Map((categoryRows ?? []).map((row) => [row.id, row]));
  const primaryCategory = categories.get(primary.category_id);
  if (!primaryCategory) return;

  // Documents use payment-time snapshots rather than today's category prices.
  const registrationAmount = Number(metadata.registration_amount ?? payment.amount_due);
  const pricing = calculatePaymentTotal({ registrationAmount, processingFee: Number(metadata.processing_fee ?? 0), platformFee: Number(metadata.platform_fee ?? 0), discountAmount: Number(metadata.discount_amount ?? 0) });
  const processingFee = pricing.processingFee ?? 0;
  const platformFee = pricing.platformFee ?? 0;
  const discount = pricing.discountAmount ?? 0;
  const participantName = participants.map((row) => `${row.first_name} ${row.last_name}`).join(', ');
  const categoryNames = Array.from(new Set(participants.map((row) => categories.get(row.category_id)?.name).filter((name): name is string => Boolean(name)))).join(', ');
  const { data: receipt } = await admin.from('payment_receipts').upsert({
    payment_id: payment.id, registration_id: primary.id, event_id: event.id, organization_id: payment.organization_id,
    receipt_reference: `RCT-${primary.registration_number}`, organization_name: organization.name,
    participant_name: participantName, participant_email: primary.email, event_name: event.name,
    race_category_name: categoryNames || primaryCategory.name, registration_number: primary.registration_number,
    registration_amount: registrationAmount, processing_fee: processingFee, platform_fee: platformFee,
    discount_amount: discount, total_paid: pricing.totalAmount, currency: payment.currency,
    payment_method: String(metadata.payment_method ?? payment.gateway),
    gateway_transaction_reference: String(metadata.gateway_transaction_reference ?? payment.gateway_payment_id ?? ''),
    payment_date: payment.paid_at ?? new Date().toISOString(), payment_status: payment.status,
  }, { onConflict: 'payment_id' }).select('id,receipt_reference').single();

  const merchandiseItems = Array.isArray(metadata.merchandise_items) ? metadata.merchandise_items.filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === 'object') : [];
  const groupLines = participants.map((participant) => {
    const snapshot = Array.isArray(metadata.participants) ? metadata.participants.find((item) => Boolean(item) && typeof item === 'object' && (item as Record<string, unknown>).registration_id === participant.id) as Record<string, unknown> | undefined : undefined;
    return { description: `${categories.get(participant.category_id)?.name ?? 'Race category'} — ${participant.first_name} ${participant.last_name}`, amount: Number(snapshot?.category_amount ?? categories.get(participant.category_id)?.registration_fee ?? 0) };
  });
  const merchLines = merchandiseItems.map((item) => ({ description: `${String(item.item_name ?? 'Additional merchandise')}${item.variant ? ` (${String(item.variant)})` : ''} × ${Number(item.quantity ?? 1)}`, amount: Number(item.line_total ?? 0) }));
  const invoiceItems = participants.length > 1 ? [...groupLines, ...merchLines] : [{ description: primaryCategory.name, amount: Number(metadata.category_amount ?? registrationAmount) }, ...merchLines];
  if (receipt && organization.invoice_mode === 'receipt_and_sales_invoice') {
    await admin.from('invoices').upsert({
      invoice_reference: `INV-${primary.registration_number}`, payment_id: payment.id, registration_id: primary.id,
      event_id: event.id, organization_id: payment.organization_id, issuance_mode: 'receipt_and_sales_invoice',
      issuer_organization_name: organization.name, issuer_address: organization.address ?? 'Not configured',
      participant_name: participantName, participant_email: primary.email, event_name: event.name,
      registration_number: primary.registration_number, line_items: invoiceItems, registration_amount: registrationAmount,
      processing_fee: processingFee, platform_fee: platformFee, discount_amount: discount,
      subtotal_amount: pricing.subtotalAmount, tax_amount: 0, total_amount: pricing.totalAmount,
      currency: payment.currency, status: 'issued', issued_at: new Date().toISOString(),
    }, { onConflict: 'payment_id' });
  }

  await Promise.all(participants.map(async (participant) => {
    if (!participant.email) return;
    const qr = await registrationQrDataUrl(participant.id);
    await admin.from('email_messages').upsert({
      recipient_email: participant.email, recipient_user_id: participant.user_id,
      organization_id: payment.organization_id, event_id: event.id, registration_id: participant.id,
      payment_id: payment.id, receipt_id: receipt?.id ?? null, email_type: 'registration_confirmed',
      template_version: 1, template_snapshot: { type: 'registration_confirmed', body: `Your registration for ${event.name} is confirmed.` },
      subject: `Registration Confirmed — ${event.name}`, rendered_body_reference: qr.dataUrl,
      status: 'queued', idempotency_key: `registration-confirmed:${participant.id}`,
    }, { onConflict: 'idempotency_key' });
  }));
}
