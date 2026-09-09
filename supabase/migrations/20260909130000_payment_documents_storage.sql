-- Private bucket for generated receipts, invoices, and certificates.
-- All application access is server-side and uses short-lived signed URLs.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('payment-documents', 'payment-documents', false, 10485760, array['application/pdf']::text[])
on conflict (id) do update set public = false, file_size_limit = 10485760, allowed_mime_types = array['application/pdf']::text[];
