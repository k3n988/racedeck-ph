-- Additive replacement-batch tracking. Publication status remains draft/published
-- so existing validation and immutable-publication triggers remain compatible.
alter table public.result_batches
  add column if not exists is_superseded boolean not null default false,
  add column if not exists superseded_by_batch_id uuid references public.result_batches(id) on delete restrict;

alter table public.result_batches
  add constraint result_batches_supersede_only_draft check (
    not is_superseded and superseded_by_batch_id is null
    or is_superseded and publication_status = 'draft' and superseded_by_batch_id is not null
  );

create index if not exists result_batches_event_active_draft_idx
  on public.result_batches (event_id, created_at desc)
  where publication_status = 'draft' and is_superseded = false;

create or replace function private.supersede_previous_result_batch()
returns trigger
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
begin
  update public.result_batches
     set is_superseded = true,
         superseded_by_batch_id = new.id,
         updated_at = now()
   where organization_id = new.organization_id
     and event_id = new.event_id
     and publication_status = 'draft'
     and is_superseded = false;
  return new;
end;
$$;

drop trigger if exists result_batches_supersede_previous_trigger on public.result_batches;
create trigger result_batches_supersede_previous_trigger
  before insert on public.result_batches
  for each row execute function private.supersede_previous_result_batch();

revoke execute on function private.supersede_previous_result_batch() from public, anon, authenticated;
