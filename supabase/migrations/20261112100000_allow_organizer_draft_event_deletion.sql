-- Remove editable draft setup atomically. Financial, participant, and legal
-- acceptance records remain protected by both explicit checks and their FKs.
create or replace function private.allow_waiver_delete_with_draft_event()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if current_setting('racedeck.deleting_draft_event_id', true) is distinct from old.event_id::text
     or not exists (
       select 1 from public.events e
       where e.id = old.event_id and e.lifecycle_status = 'draft'
         and e.review_status in ('not_submitted', 'needs_changes', 'rejected')
     )
     or exists (select 1 from public.event_waiver_acceptances a where a.event_waiver_id = old.id) then
    raise exception 'Event waiver versions cannot be deleted';
  end if;
  return old;
end;
$$;

revoke all on function private.allow_waiver_delete_with_draft_event() from public, anon, authenticated;
drop trigger event_waivers_prevent_delete_trigger on public.event_waivers;
create trigger event_waivers_prevent_delete_trigger
  before delete on public.event_waivers
  for each row execute function private.allow_waiver_delete_with_draft_event();

create or replace function public.delete_organizer_draft_event(p_event_id uuid, p_organization_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_event public.events%rowtype;
begin
  select * into v_event from public.events
    where id = p_event_id and organization_id = p_organization_id for update;
  if not found then raise exception 'Event not found'; end if;
  if v_event.lifecycle_status <> 'draft'
     or v_event.review_status not in ('not_submitted', 'needs_changes', 'rejected') then
    raise exception 'Only an editable draft can be deleted';
  end if;
  if exists (select 1 from public.registrations where event_id = p_event_id)
     or exists (select 1 from public.payments where event_id = p_event_id)
     or exists (select 1 from public.event_waiver_acceptances where event_id = p_event_id) then
    raise exception 'An event with registrations, payments, or waiver acceptances cannot be deleted';
  end if;

  -- These setup tables use RESTRICT FKs. Delete children before their event and
  -- category parents. Any unexpected dependent record aborts the transaction.
  delete from public.bibs where event_id = p_event_id;
  delete from public.race_kit_configs where event_id = p_event_id;
  delete from public.promo_codes where event_id = p_event_id;
  delete from public.announcements where event_id = p_event_id;
  delete from public.event_reminder_settings where event_id = p_event_id;
  delete from public.event_certificate_settings where event_id = p_event_id;

  perform set_config('racedeck.deleting_draft_event_id', p_event_id::text, true);
  delete from public.event_waivers where event_id = p_event_id;
  perform set_config('racedeck.deleting_draft_event_id', '', true);

  delete from public.events where id = p_event_id and organization_id = p_organization_id;
  if not found then raise exception 'Event could not be deleted'; end if;
end;
$$;

revoke all on function public.delete_organizer_draft_event(uuid, uuid) from public, anon, authenticated;
grant execute on function public.delete_organizer_draft_event(uuid, uuid) to service_role;
notify pgrst, 'reload schema';
