import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireInternalRoleManagement } from '@/lib/auth/rbac';
import { createAdminClient } from '@/lib/supabase/admin';

const roles = ['super_admin', 'admin', 'finance', 'support'] as const;
const assignSchema = z.object({
  email: z.string().trim().email().max(320),
  roles: z.array(z.enum(roles)).min(1).max(roles.length).refine((values) => new Set(values).size === values.length),
});
const revokeSchema = z.object({
  user_id: z.string().uuid(),
  role: z.enum(roles),
});

async function findUserByEmail(admin: ReturnType<typeof createAdminClient>, email: string) {
  const perPage = 1000;
  const maxPages = 50;
  for (let page = 1; page <= maxPages; page += 1) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage });
    if (error) return { user: null, error };
    const user = data.users.find((candidate) => candidate.email?.trim().toLowerCase() === email);
    if (user) return { user, error: null };
    if (data.users.length < perPage) return { user: null, error: null };
  }
  return { user: null, error: new Error('Account search reached its safe page limit') };
}

export async function POST(request: Request) {
  const context = await requireInternalRoleManagement();
  const parsed = assignSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Enter a valid email and choose at least one role.' }, { status: 400 });
  if (parsed.data.roles.includes('super_admin') && !context.internalRoles.includes('super_admin')) {
    return NextResponse.json({ error: 'Only a super administrator can grant the super administrator role.' }, { status: 403 });
  }

  const email = parsed.data.email.toLowerCase();
  const admin = createAdminClient();
  const lookup = await findUserByEmail(admin, email);
  if (lookup.error) {
    console.error('Internal staff lookup failed', lookup.error);
    return NextResponse.json({ error: 'Account lookup could not be completed. Try again shortly.' }, { status: 503 });
  }

  let user = lookup.user;
  let invited = false;
  if (!user) {
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? new URL(request.url).origin;
    const destination = parsed.data.roles.includes('admin') || parsed.data.roles.includes('super_admin')
      ? '/admin/dashboard'
      : parsed.data.roles.includes('finance')
        ? '/admin/finance/transactions'
        : '/admin/support';
    const { data, error } = await admin.auth.admin.inviteUserByEmail(email, {
      redirectTo: `${siteUrl.replace(/\/$/, '')}/auth/callback?next=${encodeURIComponent(destination)}`,
    });
    if (error || !data.user) {
      console.error('Internal staff invitation failed', error);
      return NextResponse.json({ error: 'The account could not be found or invited. Check the email and auth email settings.' }, { status: 400 });
    }
    user = data.user;
    invited = true;
  }

  const { error } = await admin.rpc('grant_internal_user_roles', {
    p_user_id: user.id,
    p_roles: parsed.data.roles,
    p_actor_user_id: context.user.id,
  });
  if (error) {
    console.error('Internal role assignment failed', error);
    return NextResponse.json({
      error: invited
        ? 'The invite was sent, but role assignment failed. Reassign the same email after checking the database migration.'
        : error.message.includes('super administrator')
          ? error.message
          : 'The role assignment could not be saved. Check the role management migration and try again.',
    }, { status: error.message.includes('super administrator') ? 403 : 500 });
  }

  return NextResponse.json({ user_id: user.id, email, roles: parsed.data.roles, invited }, { status: invited ? 201 : 200 });
}

export async function DELETE(request: Request) {
  const context = await requireInternalRoleManagement();
  const parsed = revokeSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Choose a valid staff role assignment.' }, { status: 400 });
  if (parsed.data.role === 'super_admin' && !context.internalRoles.includes('super_admin')) {
    return NextResponse.json({ error: 'Only a super administrator can revoke the super administrator role.' }, { status: 403 });
  }

  const admin = createAdminClient();
  const { error } = await admin.rpc('revoke_internal_user_role', {
    p_user_id: parsed.data.user_id,
    p_role: parsed.data.role,
    p_actor_user_id: context.user.id,
  });
  if (error) {
    console.error('Internal role revocation failed', error);
    const protectedMessage = /last active super administrator|cannot remove their own administrator role|only a super administrator/i.test(error.message);
    return NextResponse.json({
      error: protectedMessage ? error.message : 'The role could not be removed. Refresh the staff list and try again.',
    }, { status: protectedMessage ? 409 : 500 });
  }
  return NextResponse.json({ revoked: true });
}
