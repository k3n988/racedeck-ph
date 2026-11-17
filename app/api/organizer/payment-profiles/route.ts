import { NextResponse } from 'next/server';
import { z } from 'zod';
import type { SupabaseClient } from '@supabase/supabase-js';
import { requireOrganizationContext } from '@/lib/auth/rbac';
import { createAdminClient } from '@/lib/supabase/admin';
import { encryptBankAccountNumber } from '@/lib/payments/profile-encryption';
import { ORGANIZATION_COUNTRY_CODES } from '@/lib/organization/countries';

const currencyCodes = new Set(['PHP', 'USD', 'CAD', 'AUD', 'NZD', 'JPY', 'SGD', 'HKD', 'EUR', 'GBP', 'IDR', 'THB', 'MYR', 'VND']);
const countryCodes = new Set(ORGANIZATION_COUNTRY_CODES);

const profileSchema = z.object({
  profile_name: z.string().trim().min(2).max(100),
  currency: z.string().trim().length(3).toUpperCase().refine((value) => currencyCodes.has(value), 'Choose a supported currency'),
  account_holder_name: z.string().trim().min(2).max(200),
  notification_email: z.string().trim().email().max(320),
  contact_phone: z.string().trim().min(5).max(50).regex(/^[+\d().\s-]+$/, 'Enter a valid telephone number'),
  address_line1: z.string().trim().min(2).max(240),
  address_line2: z.string().trim().max(240).nullable().optional(),
  postal_code: z.string().trim().min(1).max(32),
  country_code: z.string().trim().length(2).toUpperCase().refine((value) => countryCodes.has(value), 'Choose a supported country'),
  city: z.string().trim().min(1).max(120),
  state_province: z.string().trim().min(1).max(120),
  swift_bic: z.string().trim().toUpperCase().regex(/^[A-Z0-9]{8}([A-Z0-9]{3})?$/, 'Enter a valid 8 or 11 character SWIFT/BIC'),
  bank_account_number: z.string().trim().regex(/^[A-Za-z0-9 -]{4,34}$/, 'Enter a valid bank account number').optional().or(z.literal('')),
  bank_name: z.string().trim().min(2).max(160),
  bank_address: z.string().trim().min(2).max(500),
});

function ownerRequired(role: string) {
  return role === 'owner';
}

export async function GET() {
  const { membership } = await requireOrganizationContext();
  if (!ownerRequired(membership.role)) return NextResponse.json({ error: 'Only the organization owner can view payment profiles' }, { status: 403 });
  const admin = createAdminClient() as unknown as SupabaseClient;
  const { data, error } = await admin.from('organization_payment_profiles')
    .select('id,profile_name,currency,account_holder_name,notification_email,contact_phone,address_line1,address_line2,postal_code,country_code,city,state_province,payment_method,payout_frequency,swift_bic,bank_account_number_last4,bank_name,bank_address,created_at,updated_at')
    .eq('organization_id', membership.organization_id).order('created_at', { ascending: false });
  if (error) {
    console.error('Organizer payment profiles could not be loaded', error);
    return NextResponse.json({ error: 'Payment profiles could not be loaded' }, { status: 500 });
  }
  return NextResponse.json({ profiles: data ?? [] });
}

export async function POST(request: Request) {
  const { context, membership } = await requireOrganizationContext();
  if (!ownerRequired(membership.role)) return NextResponse.json({ error: 'Only the organization owner can manage payment profiles' }, { status: 403 });
  const parsed = profileSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Check the payment profile details' }, { status: 400 });
  const accountNumber = parsed.data.bank_account_number?.replace(/[ -]/g, '').toUpperCase();
  if (!accountNumber) return NextResponse.json({ error: 'Bank account number is required' }, { status: 400 });

  let encrypted: string;
  try { encrypted = encryptBankAccountNumber(accountNumber); }
  catch (error) {
    console.error('Payment profile encryption is not configured', error);
    return NextResponse.json({ error: 'Payment profile saving is not configured. Contact RaceDeck support.' }, { status: 503 });
  }

  const admin = createAdminClient() as unknown as SupabaseClient;
  const { bank_account_number: _accountNumber, ...fields } = parsed.data;
  const { data, error } = await admin.from('organization_payment_profiles').insert({
    organization_id: membership.organization_id,
    created_by: context.user.id,
    ...fields,
    address_line2: fields.address_line2 || null,
    payment_method: 'direct_deposit',
    payout_frequency: 'weekly',
    bank_account_number_encrypted: encrypted,
    bank_account_number_last4: accountNumber.slice(-4),
  }).select('id').single();
  if (error) {
    console.error('Organizer payment profile could not be saved', error);
    const message = error.code === '23505' ? 'A profile with this name already exists. Choose a different name.' : 'Payment profile could not be saved';
    return NextResponse.json({ error: message }, { status: error.code === '23505' ? 409 : 500 });
  }
  return NextResponse.json({ ok: true, id: data.id }, { status: 201 });
}
