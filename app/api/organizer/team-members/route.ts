import { NextResponse } from 'next/server';
import { z } from 'zod';
import { loadAuthContext } from '@/lib/auth/permissions';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient as createAuthClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database.types';

const inviteSchema = z.object({ email: z.string().trim().email().max(320), role: z.string().trim().min(1), restricted_event_ids: z.array(z.string().uuid()).nullable() });

async function manager() {
  const context = await loadAuthContext();
  if (!context) return { response: NextResponse.json({ error: 'Authentication required' }, { status: 401 }) } as const;
  const membership = context.memberships[0];
  if (!membership) return { response: NextResponse.json({ error: 'Organization access required' }, { status: 403 }) } as const;
  if (membership.role !== 'owner' && !membership.permissions.includes('manage_team')) return { response: NextResponse.json({ error: 'Team management permission required' }, { status: 403 }) } as const;
  return { context, membership } as const;
}

async function validateScope(role: string, eventIds: string[] | null, organizationId: string) {
  const admin = createAdminClient();
  const { data: roleRow } = await admin.from('organization_roles').select('role').eq('role', role as never).maybeSingle();
  if (!roleRow) return 'Invalid organization role';
  if (eventIds?.length) {
    const { data: events, error } = await admin.from('events').select('id').eq('organization_id', organizationId).in('id', eventIds);
    if (error || (events?.length ?? 0) !== new Set(eventIds).size) return 'One or more selected events are not part of this organization';
  }
  return null;
}

export async function POST(request: Request) {
  const access = await manager(); if ('response' in access) return access.response;
  const parsed = inviteSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Enter a valid email, role, and event selection' }, { status: 400 });
  if (parsed.data.role === 'owner') return NextResponse.json({ error: 'Owner access cannot be assigned through staff invitations' }, { status: 400 });
  const { membership } = access; const scopeError = await validateScope(parsed.data.role, parsed.data.restricted_event_ids, membership.organization_id);
  if (scopeError) return NextResponse.json({ error: scopeError }, { status: 400 });
  const admin = createAdminClient();
  const email = parsed.data.email.toLowerCase();
  const users = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (users.error) return NextResponse.json({ error: 'The staff account could not be checked. Try again.' }, { status: 502 });
  let user = users.data.users.find((candidate) => candidate.email?.toLowerCase() === email);

  const { data: existing, error: memberLookupError } = user
    ? await admin.from('organization_members').select('id,is_active').eq('organization_id', membership.organization_id).eq('user_id', user.id).maybeSingle()
    : { data: null, error: null };
  if (memberLookupError) return NextResponse.json({ error: 'Existing staff access could not be checked' }, { status: 500 });
  if (existing?.is_active) return NextResponse.json({ error: 'This email already has active access to the organization' }, { status: 409 });

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? new URL(request.url).origin;
  const redirectTo = new URL('/auth/callback?next=%2Forganizer%2Fdashboard', siteUrl).toString();
  let invitationSent = false;

  if (!user) {
    const invited = await admin.auth.admin.inviteUserByEmail(email, { redirectTo });
    if (invited.error || !invited.data.user) {
      console.error('Staff invite email failed', invited.error);
      return NextResponse.json({ error: 'Invitation email could not be sent. Check the auth email configuration and try again.' }, { status: 502 });
    }
    user = invited.data.user;
    invitationSent = true;
  } else {
    const authUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!authUrl || !anonKey) return NextResponse.json({ error: 'Invitation email service is not configured' }, { status: 503 });
    const mailer = createAuthClient<Database>(authUrl, anonKey, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
    const mailResult = user.email_confirmed_at
      ? await mailer.auth.signInWithOtp({ email, options: { shouldCreateUser: false, emailRedirectTo: redirectTo } })
      : await mailer.auth.resend({ type: 'signup', email, options: { emailRedirectTo: redirectTo } });
    if (mailResult.error) {
      console.error('Existing staff invitation link failed', mailResult.error);
      return NextResponse.json({ error: 'Invitation link could not be emailed. Try again or ask the staff member to verify their email first.' }, { status: 502 });
    }
    invitationSent = true;
  }

  const { error } = await admin.from('organization_members').upsert({
    id: existing?.id,
    organization_id: membership.organization_id,
    user_id: user.id,
    role: parsed.data.role as never,
    restricted_event_ids: parsed.data.restricted_event_ids,
    is_active: true,
  }, { onConflict: 'organization_id,user_id' });
  if (error) {
    console.error('Staff membership could not be created after invite', error);
    return NextResponse.json({ error: 'The invitation was emailed, but staff access could not be saved. Try inviting them again.' }, { status: 500 });
  }
  return NextResponse.json({ ok: true, invitationSent, reactivated: Boolean(existing && !existing.is_active) }, { status: 201 });
}
