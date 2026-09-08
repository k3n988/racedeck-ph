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

  try { await provisionUser(user, parsed.data.organizationName); }
  catch { return NextResponse.json({ error: 'Account provisioning failed' }, { status: 500 }); }
  return NextResponse.json({ ok: true });
}
