-- RaceDeck capacity integrity: confirmed_count is maintained only by trusted
-- payment/registration services, never by an authenticated browser client.

revoke update on table public.race_categories from anon, authenticated;

grant update (
  name,
  distance_km,
  registration_fee,
  max_slots,
  bib_prefix,
  bib_range_start,
  bib_range_end,
  gun_start_time,
  cutoff_time,
  registration_availability
) on table public.race_categories to authenticated;
