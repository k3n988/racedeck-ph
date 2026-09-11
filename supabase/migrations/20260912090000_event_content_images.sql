create table if not exists public.event_content_images (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  image_url text not null,
  storage_path text not null,
  display_order integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists event_content_images_event_idx
  on public.event_content_images(event_id, display_order);

alter table public.event_content_images enable row level security;
grant select, insert, update, delete on public.event_content_images to service_role;
grant select on public.event_content_images to authenticated;

create policy event_content_images_org_read
  on public.event_content_images for select to authenticated
  using (public.is_org_member(organization_id));
