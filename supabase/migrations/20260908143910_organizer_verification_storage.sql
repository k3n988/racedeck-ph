
-- Private organizer verification document bucket. All application access is
-- mediated by server routes using the service-role client after authorization.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'organizer-verification',
  'organizer-verification',
  false,
  10485760,
  array['application/pdf', 'image/jpeg', 'image/png']::text[]
)
on conflict (id) do update
set name = excluded.name,
    public = false,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;
