import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: Request) {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  const url = new URL(request.url); const limit = Math.min(Math.max(Number(url.searchParams.get('limit') ?? 50), 1), 100);
  const { data, error } = await supabase.from('notifications').select('id,event_id,registration_id,notification_type,title,body,metadata,read_at,created_at').eq('recipient_user_id', auth.user.id).order('created_at', { ascending: false }).limit(limit);
  if (error) return NextResponse.json({ error: 'Notifications could not be loaded' }, { status: 500 });
  return NextResponse.json({ notifications: data ?? [] });
}

export async function PATCH(request: Request) {
  const supabase = await createClient(); const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  const body = await request.json().catch(() => null) as { notification_id?: unknown } | null;
  if (!body || typeof body.notification_id !== 'string') return NextResponse.json({ error: 'notification_id is required' }, { status: 400 });
  const { error } = await supabase.from('notifications').update({ read_at: new Date().toISOString() }).eq('id', body.notification_id).eq('recipient_user_id', auth.user.id);
  if (error) return NextResponse.json({ error: 'Notification could not be updated' }, { status: 500 });
  return NextResponse.json({ updated: true });
}
