import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import type { SupabaseClient } from '@supabase/supabase-js';
import { registrationQrDataUrl } from '@/lib/qr/qr.service';

export async function GET(_request: Request, { params }: { params: { registrationId: string } }) {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  const { data, error } = await supabase.from('registrations').select('id,registration_number,event_id,category_id,checkout_group_id,status,first_name,last_name,email,mobile,shirt_size,competition_classification,created_at,events(name,event_date,venue,address,assembly_time,gun_start_time),race_categories(name),payments(*),payment_receipts(*),invoices(*),bibs(*),race_kit_configs(*,race_kit_items(*)),race_kit_claims(*),results(*),certificates(id,certificate_reference,verification_token,verification_path,status,generated_at,document_storage_reference),event_waiver_acceptances(id,event_waiver_id,accepted_at)').eq('id', params.registrationId).eq('user_id', auth.user.id).maybeSingle();
  if (error) return NextResponse.json({ error: 'Race registration could not be loaded' }, { status: 500 });
  if (!data) return NextResponse.json({ error: 'Race registration not found' }, { status: 404 });

  const admin = createAdminClient() as unknown as SupabaseClient;
  const registration = data as unknown as typeof data & { checkout_group_id: string | null; payments: Array<{ id: string }> };
  let sharedPayments = (registration.payments ?? []) as unknown as Array<Record<string, unknown>>;
  let receipts = (data.payment_receipts ?? []) as unknown as Array<Record<string, unknown>>;
  let invoices = (data.invoices ?? []) as unknown as Array<Record<string, unknown>>;
  if (registration.checkout_group_id && !sharedPayments.length) {
    const { data: groupRows } = await admin.from('registrations').select('id').eq('user_id', auth.user.id).eq('checkout_group_id', registration.checkout_group_id);
    const groupRegistrationIds = (groupRows ?? []).map((row) => row.id);
    if (groupRegistrationIds.length) {
      const { data: payments } = await admin.from('payments').select('*').in('registration_id', groupRegistrationIds).order('created_at', { ascending: false });
      sharedPayments = payments ?? [];
      const paymentIds = sharedPayments.map((payment) => payment.id);
      if (paymentIds.length) {
        const [{ data: groupReceipts }, { data: groupInvoices }] = await Promise.all([
          admin.from('payment_receipts').select('*').in('payment_id', paymentIds),
          admin.from('invoices').select('*').in('payment_id', paymentIds),
        ]);
        receipts = groupReceipts ?? [];
        invoices = groupInvoices ?? [];
      }
    }
  }
  const { data: merchandise, error: merchandiseError } = await admin.from('registration_merchandise').select('id,item_name,variant,quantity,unit_price,line_total').eq('registration_id', data.id).eq('event_id', data.event_id).order('created_at');
  if (merchandiseError) return NextResponse.json({ error: 'Race registration could not be loaded' }, { status: 500 });
  let qr = null;
  if (data.status === 'confirmed') try { qr = await registrationQrDataUrl(data.id); } catch { qr = null; }
  return NextResponse.json({ registration: { ...data, payments: sharedPayments, payment_receipts: receipts, invoices }, merchandise: merchandise ?? [], qr });
}
