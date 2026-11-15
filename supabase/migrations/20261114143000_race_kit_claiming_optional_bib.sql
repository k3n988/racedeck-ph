-- Race-kit collection does not depend on a bib assignment. Keep the
-- registration/payment/configuration checks authoritative in the trigger.
alter table public.race_kit_claims
  alter column bib_id drop not null;

create or replace function public.validate_race_kit_claim()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if not exists (
    select 1 from public.registrations r
    where r.id = new.registration_id
      and r.event_id = new.event_id
      and r.category_id = new.category_id
      and r.status = 'confirmed'
  ) then
    raise exception 'race kit claims require a confirmed matching registration';
  end if;

  if not exists (
    select 1 from public.payments p
    where p.registration_id = new.registration_id
      and p.event_id = new.event_id
      and p.status = 'succeeded'
  ) then
    raise exception 'race kit claims require a succeeded payment';
  end if;

  if new.bib_id is not null and not exists (
    select 1 from public.bibs b
    where b.id = new.bib_id
      and b.event_id = new.event_id
      and b.category_id = new.category_id
      and b.registration_id = new.registration_id
      and b.status = 'active'
  ) then
    raise exception 'race kit claim bib must be the active bib for the registration';
  end if;

  if not exists (
    select 1 from public.race_kit_configs c
    where c.id = new.config_id
      and c.event_id = new.event_id
      and c.status = 'active'
      and (c.category_id is null or c.category_id = new.category_id)
  ) then
    raise exception 'race kit claim configuration does not match the event/category';
  end if;
  return new;
end;
$$;
