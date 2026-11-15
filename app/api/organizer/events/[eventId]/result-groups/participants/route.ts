import { NextResponse } from 'next/server';
import { hasPermission, loadAuthContext } from '@/lib/auth/permissions';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: Request, { params }: { params: { eventId: string } }) {
  const context = await loadAuthContext();
  if (!context) return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  const supabase = await createClient();
  const { data: event } = await supabase.from('events').select('id,organization_id').eq('id', params.eventId).maybeSingle();
  if (!event) return NextResponse.json({ error: 'Event not found' }, { status: 404 });
  const internal = context.internalRoles.includes('admin') || context.internalRoles.includes('super_admin');
  if (!internal && !(await hasPermission(event.organization_id, 'view_events', event.id))) return NextResponse.json({ error: 'Viewing participants requires view_events permission' }, { status: 403 });
  const query = new URL(request.url).searchParams;
  const categoryId = query.get('category');
  const division = query.get('division') ?? 'overall';
  const search = (query.get('q') ?? '').trim().replace(/[^a-zA-Z0-9@.\-# ]/g, ' ').replace(/\s+/g, ' ').slice(0, 80);
  if (!categoryId) return NextResponse.json({ participants: [] });
  const admin = createAdminClient();
  let bibRegistrationIds: string[] = [];
  if (search) {
    let bibQuery = admin.from('bibs').select('registration_id').eq('event_id', event.id).eq('status', 'active').ilike('bib_code', search);
    if (/^\d+$/.test(search)) bibQuery = admin.from('bibs').select('registration_id').eq('event_id', event.id).eq('status', 'active').or(`bib_code.ilike.%${search}%,bib_number.eq.${Number(search)}`);
    const { data: bibRows } = await bibQuery;
    bibRegistrationIds = (bibRows ?? []).map((row) => row.registration_id).filter((id): id is string => Boolean(id));
  }
  let requestQuery = admin.from('registrations').select('id,registration_number,first_name,middle_name,last_name,gender,category_id,bib_id,status').eq('event_id', event.id).eq('category_id', categoryId).neq('status', 'cancelled').order('registration_number').limit(30);
  if (search) {
    const nameSearch = `first_name.ilike.%${search}%,last_name.ilike.%${search}%,registration_number.ilike.%${search}%`;
    requestQuery = requestQuery.or(bibRegistrationIds.length ? `${nameSearch},id.in.(${bibRegistrationIds.join(',')})` : nameSearch);
  }
  if (division === 'male') requestQuery = requestQuery.in('gender', ['Male', 'male', 'M', 'm', 'Man', 'man']);
  if (division === 'female') requestQuery = requestQuery.in('gender', ['Female', 'female', 'F', 'f', 'Woman', 'woman']);
  const { data: registrations, error } = await requestQuery;
  if (error) return NextResponse.json({ error: 'Eligible participants could not be loaded' }, { status: 500 });
  const registrationIds = (registrations ?? []).map((row) => row.id);
  const { data: bibs } = registrationIds.length ? await admin.from('bibs').select('registration_id,bib_code,bib_number').eq('event_id', event.id).eq('status', 'active').in('registration_id', registrationIds) : { data: [] };
  const bibByRegistration = new Map((bibs ?? []).map((bib) => [bib.registration_id, bib]));
  return NextResponse.json({ participants: (registrations ?? []).map((registration) => ({
    id: registration.id,
    registration_number: registration.registration_number,
    name: [registration.first_name, registration.middle_name, registration.last_name].filter(Boolean).join(' '),
    gender: registration.gender,
    bib: bibByRegistration.get(registration.id)?.bib_code ?? bibByRegistration.get(registration.id)?.bib_number ?? null,
  })) });
}
