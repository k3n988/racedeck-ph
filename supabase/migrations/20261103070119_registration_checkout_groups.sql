-- Group multiple participant registrations under one event checkout.
alter table public.registrations
  add column checkout_group_id uuid;

create index registrations_checkout_group_event_idx
  on public.registrations (checkout_group_id, event_id)
  where checkout_group_id is not null;

comment on column public.registrations.checkout_group_id is
  'Groups registrations created together in one participant checkout. Payment details are stored on the payment anchor registration.';
