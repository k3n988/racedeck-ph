import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { provisionUser } from '@/lib/auth/provisioning';

const schema = z.object({ organizationName: z.string().trim().min(2).max(120).optional() });

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Authentication required' }, { status: 401 });

  const parsed = schema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: 'Invalid account details' }, { status: 400 });

  const metadata = user.user_metadata ?? {};
  const organizationName = parsed.data.organizationName ?? (metadata.account_type === 'organizer' && typeof metadata.organization_name === 'string' ? metadata.organization_name : undefined);
  try { await provisionUser(user, organizationName); }
  catch (error) {
    console.error('Auth provisioning request failed', error);
    const detail = process.env.NODE_ENV === 'development' && error instanceof Error ? error.message : 'Account provisioning failed';
    return NextResponse.json({ error: detail }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
