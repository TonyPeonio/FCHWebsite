-- Project statuses the owner can add (e.g. "Estimate pending"). Each one belongs to one of the
-- built-in stages, which still decide behavior: "complete" puts a project on the website, and the
-- overview counts projects by stage. A project with no custom status shows its stage's name.
create table public.project_statuses (
  id          bigint generated always as identity primary key, -- also the display order
  name        text not null check (length(trim(name)) between 1 and 40),
  stage       public.project_status not null,
  created_at  timestamptz not null default now()
);
create unique index project_statuses_name_key on public.project_statuses (lower(trim(name)));

alter table public.project_statuses enable row level security;
create policy "project statuses: read" on public.project_statuses
  for select to authenticated using (true);
create policy "project statuses: owner add" on public.project_statuses
  for insert to authenticated with check (public.is_owner());
create policy "project statuses: owner remove" on public.project_statuses
  for delete to authenticated using (public.is_owner());

-- Removing a custom status puts its projects back on their stage's built-in name.
alter table public.projects
  add column custom_status_id bigint references public.project_statuses on delete set null;

-- Keep a project's stage in step with its custom status, whatever the client sends. Changing just
-- the stage (e.g. "Mark completed") drops the custom status.
create function public.sync_project_stage() returns trigger
language plpgsql set search_path = '' as $$
begin
  if tg_op = 'UPDATE' and new.custom_status_id is not distinct from old.custom_status_id
     and new.status is distinct from old.status then
    new.custom_status_id := null;
  elsif new.custom_status_id is not null then
    select s.stage into new.status from public.project_statuses s where s.id = new.custom_status_id;
  end if;
  return new;
end;
$$;
create trigger projects_sync_stage before insert or update of custom_status_id, status on public.projects
  for each row execute function public.sync_project_stage();

-------------------------------------------------------------------------------
-- Space used
-------------------------------------------------------------------------------
-- The plan's limits, which the owner sets to match their Supabase plan (defaults: Free plan).
create table public.usage_limits (
  id                  boolean primary key default true check (id), -- a single row
  database_limit_mb   integer not null default 500 check (database_limit_mb > 0),
  storage_limit_mb    integer not null default 1024 check (storage_limit_mb > 0)
);
insert into public.usage_limits default values;

alter table public.usage_limits enable row level security;
create policy "usage limits: owner read" on public.usage_limits
  for select to authenticated using (public.is_owner());
create policy "usage limits: owner change" on public.usage_limits
  for update to authenticated using (public.is_owner()) with check (public.is_owner());

-- Owner-only: how much database and file storage is in use, by bucket.
create function public.space_used()
returns json
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.is_owner() then
    raise exception 'Only the owner can see space used' using errcode = '42501';
  end if;
  return json_build_object(
    'database_bytes', pg_database_size(current_database()),
    'buckets', coalesce((
      select json_agg(b order by b.bucket_id) from (
        select o.bucket_id, count(*) as files, coalesce(sum((o.metadata->>'size')::bigint), 0) as bytes
        from storage.objects o group by o.bucket_id
      ) b
    ), '[]'::json)
  );
end;
$$;
revoke execute on function public.space_used() from public, anon;
grant execute on function public.space_used() to authenticated;
