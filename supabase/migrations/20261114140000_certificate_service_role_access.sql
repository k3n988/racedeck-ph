-- Server-side certificate APIs use the Supabase service-role client. Grant
-- explicit table privileges so projects with restricted default privileges
-- can read and write certificate settings and issuance records.
grant usage on schema public to service_role;

grant all privileges on table
  public.certificate_templates,
  public.event_certificate_settings,
  public.event_certificate_categories,
  public.certificates
to service_role;
