alter table public.support_cases
  add column requester_email text;

update public.support_cases as cases
set requester_email = users.email
from auth.users as users
where users.id = cases.requester_user_id
  and cases.requester_email is null;

alter table public.support_cases
  alter column requester_user_id drop not null,
  add constraint support_cases_requester_contact check (
    requester_user_id is not null
    or (requester_email is not null and btrim(requester_email) <> '')
  );

comment on column public.support_cases.requester_email is
  'Contact email for the case; required for guest participant reports.';
