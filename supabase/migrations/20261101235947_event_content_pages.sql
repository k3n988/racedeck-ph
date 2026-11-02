create table public.event_content_pages (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  page_key text not null,
  title text not null,
  page_type text not null default 'system' check (page_type in ('system', 'custom')),
  content text not null default '',
  is_visible boolean not null default true,
  display_order integer not null default 0 check (display_order >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (event_id, page_key)
);

create index event_content_pages_event_order_idx
  on public.event_content_pages (event_id, display_order, created_at);

alter table public.event_content_pages enable row level security;
revoke all on public.event_content_pages from public, anon;
grant select on public.event_content_pages to authenticated;
grant select, insert, update, delete on public.event_content_pages to service_role;

create policy "Organizers can read their event content pages"
  on public.event_content_pages for select to authenticated
  using (public.is_org_member(organization_id));

create trigger guard_event_review_snapshot
  before insert or update or delete on public.event_content_pages
  for each row execute function public.guard_event_review_snapshot();

-- Keep the organizer checklist and the authoritative submission gate aligned.
create or replace function public.submit_event_for_review(p_event_id uuid)
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_event public.events%rowtype;
  v_organization public.organizations%rowtype;
  v_description text;
begin
  select * into v_event from public.events where id = p_event_id for update;
  if not found then raise exception 'Event not found'; end if;
  if not private.has_org_permission(v_event.organization_id, 'submit_events', p_event_id) then
    raise exception 'Submit events permission required';
  end if;
  select * into v_organization from public.organizations where id = v_event.organization_id;
  if v_organization.verification_status <> 'approved' or v_organization.account_status <> 'active' then
    raise exception 'Organization must be approved and active';
  end if;
  if v_event.lifecycle_status <> 'draft' or v_event.review_status not in ('not_submitted', 'needs_changes', 'rejected') then
    raise exception 'Event cannot be submitted in its current state';
  end if;

  v_description := regexp_replace(coalesce(v_event.description, ''), '<[^>]*>|&nbsp;|&#160;', '', 'gi');
  if nullif(btrim(v_event.name), '') is null
     or nullif(btrim(v_description), '') is null
     or nullif(btrim(coalesce(v_event.venue, '')), '') is null
     or nullif(btrim(coalesce(v_event.address, '')), '') is null then
    raise exception 'Event name, description, venue, and address are required';
  end if;
  if v_event.registration_opens_at is null or v_event.registration_closes_at is null
     or v_event.registration_opens_at >= v_event.registration_closes_at then
    raise exception 'Valid registration opening and closing dates are required';
  end if;
  if v_event.event_date < (now() at time zone 'Asia/Manila')::date
     or v_event.registration_closes_at > ((v_event.event_date + 1)::timestamp at time zone 'Asia/Manila') then
    raise exception 'Event date must be upcoming and registration must close by the end of event day';
  end if;
  if not exists (select 1 from public.race_categories where event_id = p_event_id) then
    raise exception 'Add at least one race category before submission';
  end if;

  update public.events
     set review_status = 'pending_review', review_feedback = null, updated_at = now()
   where id = p_event_id;
  insert into public.event_review_history (event_id, from_status, to_status, reviewed_by)
  values (p_event_id, v_event.review_status, 'pending_review', auth.uid());
  return 'pending_review';
end;
$$;

notify pgrst, 'reload schema';
