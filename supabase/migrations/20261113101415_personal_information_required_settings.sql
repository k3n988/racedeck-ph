alter table public.events
  add column if not exists registration_personal_fields text[] not null default array[
    'first_name',
    'middle_name',
    'last_name',
    'birthdate',
    'gender',
    'email',
    'contact_number',
    'address',
    'emergency_contact',
    'emergency_contact_phone',
    'emergency_contact_relationship'
  ]::text[];

alter table public.events
  add constraint events_registration_personal_fields_valid
  check (registration_personal_fields <@ array[
    'first_name',
    'middle_name',
    'last_name',
    'birthdate',
    'gender',
    'email',
    'contact_number',
    'address',
    'emergency_contact',
    'emergency_contact_phone',
    'emergency_contact_relationship'
  ]::text[]);
