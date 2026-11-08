import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database.types';
import { renderToBuffer } from '@react-pdf/renderer';
import { ReceiptTemplate } from '@/lib/invoices/receipt-template';
import { InvoiceTemplate } from '@/lib/invoices/invoice-template';
import React from 'react';

type Client = SupabaseClient<Database>;
type Kind = 'receipt' | 'invoice';

function escapePdf(value: string) { return value.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)').replace(/[\r\n]+/g, ' '); }

function pdf(lines: string[]) {
  const content = ['BT', '/F1 10 Tf', '50 760 Td', ...lines.flatMap((line, index) => [index ? '0 -16 Td' : '', `(${escapePdf(line)}) Tj`]), 'ET'].filter(Boolean).join('\n');
  const objects = [`<< /Type /Catalog /Pages 2 0 R >>`, `<< /Type /Pages /Kids [3 0 R] /Count 1 >>`, `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>`, `<< /Length ${content.length} >>\nstream\n${content}\nendstream`, `<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>`];
  let output = '%PDF-1.4\n'; const offsets = [0]; for (let i = 0; i < objects.length; i++) { offsets.push(output.length); output += `${i + 1} 0 obj\n${objects[i]}\nendobj\n`; } const xref = output.length; output += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`; for (let i = 1; i < offsets.length; i++) output += `${String(offsets[i]).padStart(10, '0')} 00000 n \n`; output += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return new TextEncoder().encode(output);
}
void pdf;

export async function getPaymentDocument(supabase: Client, paymentId: string, userId: string, kind: Kind) {
  const { data: payment } = await supabase.from('payments').select('id,registration_id,status,amount_paid,amount_refunded,currency,gateway,gateway_payment_id,paid_at,metadata').eq('id', paymentId).maybeSingle();
  if (!payment) return null;
  const { data: registration } = await supabase.from('registrations').select('id,registration_number,user_id,first_name,last_name,email,event_id,category_id').eq('id', payment.registration_id).eq('user_id', userId).maybeSingle();
  if (!registration) return null;
  const { data: event } = await supabase.from('events').select('name,organization_id').eq('id', registration.event_id).maybeSingle();
  if (!event) return null;
  const { data: category } = await supabase.from('race_categories').select('name').eq('id', registration.category_id).maybeSingle();
  if (kind === 'receipt') { const { data: receipt } = await supabase.from('payment_receipts').select('*').eq('payment_id', paymentId).maybeSingle(); return receipt ? { kind, payment, registration, event, category, document: receipt } : null; }
  const { data: organization } = await supabase.from('organizations').select('invoice_mode').eq('id', event.organization_id).maybeSingle();
  if (organization?.invoice_mode !== 'receipt_and_sales_invoice') return null;
  const { data: invoice } = await supabase.from('invoices').select('*').eq('payment_id', paymentId).eq('status', 'issued').maybeSingle();
  return invoice ? { kind, payment, registration, event, category, document: invoice } : null;
}

export async function paymentDocumentPdf(value: NonNullable<Awaited<ReturnType<typeof getPaymentDocument>>>) {
  const d = value.document as Record<string, unknown>; const payment = value.payment; const registration = value.registration;
  const total = Number(d.total_paid ?? d.total_amount ?? payment.amount_paid).toFixed(2);
  const data = { reference: String(d.receipt_reference ?? d.invoice_reference ?? ''), registration: registration.registration_number, participant: `${registration.first_name} ${registration.last_name}`, organizer: value.event.organization_id, event: value.event.name, category: value.category?.name ?? 'Not specified', registration_amount: String(d.registration_amount ?? 0), processing_fee: String(d.processing_fee ?? 0), platform_fee: String(d.platform_fee ?? 0), discount: String(d.discount_amount ?? 0), total: `${payment.currency} ${total}`, method: String(d.payment_method ?? payment.gateway), transaction: String(d.gateway_transaction_reference ?? payment.gateway_payment_id ?? ''), date: String(d.payment_date ?? payment.paid_at ?? ''), status: String(d.payment_status ?? payment.status), subtotal: String(d.subtotal_amount ?? 0), tax: String(d.tax_amount ?? 0) };
  return new Uint8Array(await renderToBuffer((value.kind === 'receipt' ? React.createElement(ReceiptTemplate, { data }) : React.createElement(InvoiceTemplate, { data })) as unknown as React.ReactElement));
}
