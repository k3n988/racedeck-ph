insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('event-assets', 'event-assets', true, 10485760, array['image/jpeg','image/png','image/webp']::text[])
on conflict (id) do nothing;
