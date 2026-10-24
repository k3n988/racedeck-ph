import { NextResponse } from 'next/server';
import { z } from 'zod';
import { loadAuthContext } from '@/lib/auth/permissions';
import { createAdminClient } from '@/lib/supabase/admin';

async function getAccess() {
  const context = await loadAuthContext();
  if (!context) return { response: NextResponse.json({ error: 'Authentication required' }, { status: 401 }) } as const;
  const membership = context.memberships.find((item) => item.role === 'owner' || item.permissions.includes('manage_payout_accounts'));
  if (!membership) return { response: NextResponse.json({ error: 'Payout account management permission required' }, { status: 403 }) } as const;
  return { context, membership, admin: createAdminClient() } as const;
}

const createSchema = z.object({
  provider: z.string().trim().min(2).max(60),
  account_reference: z.string().trim().min(4).max(120),
  account_label: z.string().trim().max(120).nullable().optional(),
  currency: z.literal('PHP').default('PHP'),
  is_default: z.boolean().default(false),
});

export async function GET() {
  const access = await getAccess();
  if ('response' in access) return access.response;
  const { data, error } = await access.admin
    .from('organization_payout_accounts')
    .select('id,provider,account_reference,account_label,currency,is_default,is_active,verified_at,created_at')
    .eq('organization_id', access.membership.organization_id)
    .order('created_at', { ascending: false });
  if (error) {
    console.error('[Payment profiles]', error);
    return NextResponse.json({ error: 'Payment profiles could not be loaded.' }, { status: 500 });
  }
  const profiles = (data ?? []).map((profile) => ({
    ...profile,
    account_reference: `•••• ${profile.account_reference.slice(-4)}`,
  }));
  return NextResponse.json({ profiles });
}

export async function POST(request: Request) {
  const access = await getAccess();
  if ('response' in access) return access.response;
  const parsed = createSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Enter a valid payment profile.' }, { status: 400 });

  const { data: profile, error } = await access.admin
    .from('organization_payout_accounts')
    .insert({
      organization_id: access.membership.organization_id,
      provider: parsed.data.provider,
      account_reference: parsed.data.account_reference,
      account_label: parsed.data.account_label || null,
      currency: parsed.data.currency,
      is_default: false,
      created_by: access.context.user.id,
    })
    .select('id')
    .single();
  if (error || !profile) {
    console.error('[Creating payment profile]', error);
    return NextResponse.json({ error: error?.code === '23505' ? 'This payment profile already exists.' : 'Payment profile could not be saved.' }, { status: error?.code === '23505' ? 409 : 500 });
  }

  if (parsed.data.is_default) {
    const clear = await access.admin.from('organization_payout_accounts')
      .update({ is_default: false })
      .eq('organization_id', access.membership.organization_id)
      .eq('is_active', true);
    if (clear.error) return NextResponse.json({ error: 'Profile saved, but the default profile could not be changed.' }, { status: 500 });
    const setDefault = await access.admin.from('organization_payout_accounts')
      .update({ is_default: true })
      .eq('id', profile.id)
      .eq('organization_id', access.membership.organization_id);
    if (setDefault.error) return NextResponse.json({ error: 'Profile saved, but the default profile could not be changed.' }, { status: 500 });
  }
  return NextResponse.json({ saved: true }, { status: 201 });
}

const updateSchema = z.object({ id: z.string().uuid(), action: z.enum(['make_default', 'deactivate']) });

export async function PATCH(request: Request) {
  const access = await getAccess();
  if ('response' in access) return access.response;
  const parsed = updateSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Invalid payment profile action.' }, { status: 400 });
  const { id, action } = parsed.data;
  const { data: profile } = await access.admin
    .from('organization_payout_accounts')
    .select('id,is_active')
    .eq('id', id)
    .eq('organization_id', access.membership.organization_id)
    .maybeSingle();
  if (!profile) return NextResponse.json({ error: 'Payment profile not found.' }, { status: 404 });
  if (action === 'make_default') {
    if (!profile.is_active) return NextResponse.json({ error: 'Activate this profile before setting it as default.' }, { status: 409 });
    const clear = await access.admin.from('organization_payout_accounts')
      .update({ is_default: false })
      .eq('organization_id', access.membership.organization_id)
      .eq('is_active', true);
    if (clear.error) return NextResponse.json({ error: 'The default profile could not be changed.' }, { status: 500 });
    const setDefault = await access.admin.from('organization_payout_accounts')
      .update({ is_default: true })
      .eq('id', id)
      .eq('organization_id', access.membership.organization_id);
    if (setDefault.error) return NextResponse.json({ error: 'The default profile could not be changed.' }, { status: 500 });
  } else {
    const { error } = await access.admin.from('organization_payout_accounts')
      .update({ is_active: false, is_default: false })
      .eq('id', id)
      .eq('organization_id', access.membership.organization_id);
    if (error) return NextResponse.json({ error: 'Payment profile could not be deactivated.' }, { status: 500 });
  }
  return NextResponse.json({ saved: true });
}
