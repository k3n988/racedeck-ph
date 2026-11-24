import { NextResponse } from 'next/server';
import { z } from 'zod';
import { hasPermission, loadAuthContext } from '@/lib/auth/permissions';
import { createAdminClient } from '@/lib/supabase/admin';

const optionSchema = z.object({ label: z.string().trim().min(1).max(120), value: z.string().trim().min(1).max(120) });
const listSchema = z.object({ name: z.string().trim().min(1).max(120), options: z.array(optionSchema).min(1).max(100) }).refine(({ options }) => new Set(options.map(o => o.value)).size === options.length, 'Option values must be unique.');

async function organizationAccess() {
  const context = await loadAuthContext();
  if (!context) return { response: NextResponse.json({ error: 'Authentication required' }, { status: 401 }) } as const;
  const membership = context.memberships[0];
  if (!membership || !(await hasPermission(membership.organization_id, 'edit_events'))) return { response: NextResponse.json({ error: 'Event editing permission required' }, { status: 403 }) } as const;
  return { organizationId: membership.organization_id } as const;
}

export async function GET() {
  const access = await organizationAccess();
  if ('response' in access) return access.response;
  const admin = createAdminClient();
  const { data, error } = await admin.from('organization_validation_lists').select('id,name,options,created_at,updated_at').eq('organization_id', access.organizationId).order('name');
  if (error) return NextResponse.json({ error: 'Validation lists could not be loaded' }, { status: 500 });
  return NextResponse.json({ lists: data ?? [] });
}

export async function POST(request: Request) {
  const access = await organizationAccess();
  if ('response' in access) return access.response;
  const parsed = listSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Check the list name and options.' }, { status: 400 });
  const admin = createAdminClient();
  const { data, error } = await admin.from('organization_validation_lists').insert({ ...parsed.data, organization_id: access.organizationId }).select('id,name,options,created_at,updated_at').single();
  if (error) return NextResponse.json({ error: error.code === '23505' ? 'A list with that name already exists.' : 'Validation list could not be created.' }, { status: error.code === '23505' ? 409 : 500 });
  return NextResponse.json({ list: data }, { status: 201 });
}

export async function PUT(request: Request) {
  const access = await organizationAccess();
  if ('response' in access) return access.response;
  const payload = await request.json().catch(() => null);
  const parsed = z.object({ id: z.string().uuid(), name: z.string().trim().min(1).max(120), options: z.array(optionSchema).min(1).max(100) }).safeParse(payload);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Check the list name and options.' }, { status: 400 });
  const { id, ...values } = parsed.data;
  if (new Set(values.options.map(o => o.value)).size !== values.options.length) return NextResponse.json({ error: 'Option values must be unique.' }, { status: 400 });
  const admin = createAdminClient();
  const { data, error } = await admin.from('organization_validation_lists').update({ ...values, updated_at: new Date().toISOString() }).eq('id', id).eq('organization_id', access.organizationId).select('id,name,options,created_at,updated_at').maybeSingle();
  if (error) return NextResponse.json({ error: error.code === '23505' ? 'A list with that name already exists.' : 'Validation list could not be updated.' }, { status: error.code === '23505' ? 409 : 500 });
  if (!data) return NextResponse.json({ error: 'Validation list not found.' }, { status: 404 });
  return NextResponse.json({ list: data });
}

export async function DELETE(request: Request) {
  const access = await organizationAccess();
  if ('response' in access) return access.response;
  const parsed = z.object({ id: z.string().uuid() }).safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Choose a valid validation list.' }, { status: 400 });
  const admin = createAdminClient();
  const { error } = await admin.from('organization_validation_lists').delete().eq('id', parsed.data.id).eq('organization_id', access.organizationId);
  if (error) return NextResponse.json({ error: 'Validation list could not be deleted.' }, { status: 500 });
  return NextResponse.json({ ok: true });
}
