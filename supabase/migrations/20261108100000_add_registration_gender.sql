-- Gender is optional participant information captured during registration.
alter table public.registrations
  add column if not exists gender text
  check (gender is null or gender in ('male', 'female', 'prefer_not_to_say'));

comment on column public.registrations.gender is
  'Optional participant gender selection from the registration form.';
