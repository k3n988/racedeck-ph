alter table public.events
  alter column registration_personal_fields
  set default array[
    'first_name',
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

-- Normalize events that still have the original all-fields default while
-- preserving any event with a customized selection.
update public.events
set registration_personal_fields = array_remove(registration_personal_fields, 'middle_name')
where cardinality(registration_personal_fields) = 11
  and registration_personal_fields @> array[
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
