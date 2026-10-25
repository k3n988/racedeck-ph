-- Allow event organizers to make direct event-detail updates after approval.
-- Keep the review snapshot immutable only while RaceDeck is actively reviewing it.
create or replace function public.guard_reviewed_event_details()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if old.review_status = 'pending_review'
     and row(
       new.name, new.slug, new.description, new.logo_url, new.banner_url,
       new.venue, new.address, new.latitude, new.longitude, new.event_date,
       new.start_time, new.assembly_time, new.gun_start_time, new.cutoff_time,
       new.social_links
     ) is distinct from row(
       old.name, old.slug, old.description, old.logo_url, old.banner_url,
       old.venue, old.address, old.latitude, old.longitude, old.event_date,
       old.start_time, old.assembly_time, old.gun_start_time, old.cutoff_time,
       old.social_links
     ) then
    raise exception 'Event details cannot be changed while RaceDeck is reviewing the event';
  end if;

  if old.review_status = 'pending_review'
     and row(new.registration_opens_at, new.registration_closes_at, new.overall_capacity)
       is distinct from row(old.registration_opens_at, old.registration_closes_at, old.overall_capacity) then
    raise exception 'Registration settings cannot be changed while RaceDeck is reviewing the event';
  end if;

  if old.lifecycle_status = 'draft' and new.lifecycle_status = 'published' and old.review_status <> 'approved' then
    raise exception 'Event must be approved before publication';
  end if;
  return new;
end;
$$;
