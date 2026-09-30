-- First Choice Homes client portal schema.
-- Every table has Row Level Security. Staff (owner/staff roles) see everything;
-- clients see only projects they are members of.

-------------------------------------------------------------------------------
-- Types
-------------------------------------------------------------------------------
create type public.user_role as enum ('owner', 'staff', 'client');
create type public.project_status as enum ('planning', 'active', 'on_hold', 'complete');
create type public.selection_status as enum ('requested', 'submitted', 'approved', 'revision_requested');
create type public.document_kind as enum ('plan', 'permit', 'contract', 'photo', 'selection', 'other');
create type public.quote_status as enum ('draft', 'new', 'contacted', 'converted', 'declined');

-------------------------------------------------------------------------------
-- Tables
-------------------------------------------------------------------------------
create table public.profiles (
  id          uuid primary key references auth.users on delete cascade,
  email       text not null default '',
  full_name   text not null default '',
  phone       text,
  role        public.user_role not null default 'client',
  feed_token  uuid not null default gen_random_uuid() unique,
  created_at  timestamptz not null default now()
);

create table public.projects (
  id                 uuid primary key default gen_random_uuid(),
  name               text not null,
  address            text,
  status             public.project_status not null default 'planning',
  color              text not null default '#778899',
  start_date         date,
  target_completion  date,
  created_at         timestamptz not null default now()
);

create table public.project_members (
  project_id  uuid not null references public.projects on delete cascade,
  user_id     uuid not null references public.profiles on delete cascade,
  primary key (project_id, user_id)
);
create index on public.project_members (user_id);

-- The master calendar. An event is tagged to zero or more projects via event_projects.
create table public.events (
  id              uuid primary key default gen_random_uuid(),
  title           text not null,
  notes           text,
  starts_at       timestamptz not null,
  ends_at         timestamptz,
  all_day         boolean not null default false,
  category        text,
  client_visible  boolean not null default true,
  created_by      uuid references public.profiles on delete set null default auth.uid(),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  check (ends_at is null or ends_at >= starts_at)
);
create index on public.events (starts_at);

create table public.event_projects (
  event_id    uuid not null references public.events on delete cascade,
  project_id  uuid not null references public.projects on delete cascade,
  primary key (event_id, project_id)
);
create index on public.event_projects (project_id);

create table public.selections (
  id                uuid primary key default gen_random_uuid(),
  project_id        uuid not null references public.projects on delete cascade,
  title             text not null,
  instructions      text,
  due_date          date,
  status            public.selection_status not null default 'requested',
  client_note       text,
  staff_note        text,
  chosen_option_id  uuid,
  submitted_at      timestamptz,
  decided_at        timestamptz,
  created_by        uuid references public.profiles on delete set null default auth.uid(),
  created_at        timestamptz not null default now()
);
create index on public.selections (project_id);

create table public.selection_options (
  id            uuid primary key default gen_random_uuid(),
  selection_id  uuid not null references public.selections on delete cascade,
  label         text not null,
  description   text,
  image_path    text,
  sort_order    int not null default 0
);
create index on public.selection_options (selection_id);

alter table public.selections
  add constraint selections_chosen_option_fk
  foreign key (chosen_option_id) references public.selection_options on delete set null;

create table public.documents (
  id              uuid primary key default gen_random_uuid(),
  project_id      uuid not null references public.projects on delete cascade,
  selection_id    uuid references public.selections on delete cascade,
  uploaded_by     uuid references public.profiles on delete set null default auth.uid(),
  storage_path    text not null unique,
  file_name       text not null,
  mime_type       text,
  size_bytes      bigint,
  kind            public.document_kind not null default 'other',
  caption         text,
  client_visible  boolean not null default true,
  created_at      timestamptz not null default now(),
  check (split_part(storage_path, '/', 1) = project_id::text)
);
create index on public.documents (project_id);
create index on public.documents (selection_id);

create table public.quote_requests (
  id            uuid primary key default gen_random_uuid(),
  name          text,
  email         text not null,
  phone         text,
  address       text,
  message       text,
  file_paths    text[] not null default '{}',
  status        public.quote_status not null default 'draft',
  staff_notes   text,
  project_id    uuid references public.projects on delete set null,
  created_at    timestamptz not null default now(),
  submitted_at  timestamptz
);
create index on public.quote_requests (status, created_at desc);

-------------------------------------------------------------------------------
-- Helper functions (security definer so policies can call them without recursion)
-------------------------------------------------------------------------------
-- Staff powers require a session verified with 2FA (aal2). A staff member who has only
-- clicked a magic link (aal1) is treated like a regular signed-in user until they enter
-- their authenticator code.
create function public.has_mfa() returns boolean
language sql stable set search_path = '' as $$
  select coalesce(auth.jwt() ->> 'aal', '') = 'aal2';
$$;

create function public.is_staff() returns boolean
language sql stable security definer set search_path = '' as $$
  select public.has_mfa() and exists (
    select 1 from public.profiles
    where id = auth.uid() and role in ('owner', 'staff')
  );
$$;

create function public.is_owner() returns boolean
language sql stable security definer set search_path = '' as $$
  select public.has_mfa() and exists (
    select 1 from public.profiles where id = auth.uid() and role = 'owner'
  );
$$;

create function public.is_project_member(pid uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.project_members
    where project_id = pid and user_id = auth.uid()
  );
$$;

create function public.can_view_project(pid uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select public.is_staff() or public.is_project_member(pid);
$$;

-- First folder of a storage path is the project id: "{project_id}/uploads/file.pdf"
create function public.path_project_id(path text) returns uuid
language plpgsql immutable set search_path = '' as $$
begin
  return split_part(path, '/', 1)::uuid;
exception when others then
  return null;
end;
$$;

-------------------------------------------------------------------------------
-- Profile creation on signup/invite
-------------------------------------------------------------------------------
create function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, coalesce(new.email, ''), coalesce(new.raw_user_meta_data ->> 'full_name', ''));
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create function public.touch_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger events_touch before update on public.events
  for each row execute function public.touch_updated_at();

-------------------------------------------------------------------------------
-- Row Level Security
-------------------------------------------------------------------------------
alter table public.profiles          enable row level security;
alter table public.projects          enable row level security;
alter table public.project_members   enable row level security;
alter table public.events            enable row level security;
alter table public.event_projects    enable row level security;
alter table public.selections        enable row level security;
alter table public.selection_options enable row level security;
alter table public.documents         enable row level security;
alter table public.quote_requests    enable row level security;

-- profiles: see yourself (staff see everyone); edit only your name/phone.
create policy "profiles: read self or staff" on public.profiles
  for select to authenticated using (id = (select auth.uid()) or public.is_staff());
create policy "profiles: update self" on public.profiles
  for update to authenticated using (id = (select auth.uid())) with check (id = (select auth.uid()));
create policy "profiles: staff update" on public.profiles
  for update to authenticated using (public.is_staff()) with check (public.is_staff());
revoke update on public.profiles from authenticated, anon;
grant update (full_name, phone) on public.profiles to authenticated;

-- projects
create policy "projects: members read" on public.projects
  for select to authenticated using (public.can_view_project(id));
create policy "projects: staff write" on public.projects
  for all to authenticated using (public.is_staff()) with check (public.is_staff());

-- project_members: clients see their own memberships
create policy "members: read own or staff" on public.project_members
  for select to authenticated using (user_id = (select auth.uid()) or public.is_staff());
create policy "members: staff write" on public.project_members
  for all to authenticated using (public.is_staff()) with check (public.is_staff());

-- events: clients see client-visible events tagged to one of their projects
create policy "events: read" on public.events
  for select to authenticated using (
    public.is_staff() or (
      client_visible and exists (
        select 1
        from public.event_projects ep
        join public.project_members pm on pm.project_id = ep.project_id
        where ep.event_id = events.id and pm.user_id = (select auth.uid())
      )
    )
  );
create policy "events: staff write" on public.events
  for all to authenticated using (public.is_staff()) with check (public.is_staff());

-- event_projects: clients only see tags for their own projects (never other clients' projects)
create policy "event tags: read" on public.event_projects
  for select to authenticated using (public.is_staff() or public.is_project_member(project_id));
create policy "event tags: staff write" on public.event_projects
  for all to authenticated using (public.is_staff()) with check (public.is_staff());

-- selections: clients read; they respond only through submit_selection()
create policy "selections: read" on public.selections
  for select to authenticated using (public.can_view_project(project_id));
create policy "selections: staff write" on public.selections
  for all to authenticated using (public.is_staff()) with check (public.is_staff());

create policy "selection options: read" on public.selection_options
  for select to authenticated using (
    exists (select 1 from public.selections s
            where s.id = selection_id and public.can_view_project(s.project_id))
  );
create policy "selection options: staff write" on public.selection_options
  for all to authenticated using (public.is_staff()) with check (public.is_staff());

-- documents: clients see client-visible docs (and their own uploads) in their projects
create policy "documents: read" on public.documents
  for select to authenticated using (
    public.is_staff() or (
      public.is_project_member(project_id)
      and (client_visible or uploaded_by = (select auth.uid()))
    )
  );
create policy "documents: client upload" on public.documents
  for insert to authenticated with check (
    public.is_staff() or (
      public.is_project_member(project_id)
      and uploaded_by = (select auth.uid())
      and kind in ('selection', 'photo', 'other')
      and split_part(storage_path, '/', 2) = 'uploads'
      and (selection_id is null or exists (
        select 1 from public.selections s
        where s.id = selection_id and s.project_id = documents.project_id
          and s.status in ('requested', 'revision_requested')
      ))
    )
  );
create policy "documents: delete own or staff" on public.documents
  for delete to authenticated using (public.is_staff() or uploaded_by = (select auth.uid()));
create policy "documents: staff update" on public.documents
  for update to authenticated using (public.is_staff()) with check (public.is_staff());

-- quote_requests: written only by edge functions (service role); staff manage them
create policy "quotes: staff read" on public.quote_requests
  for select to authenticated using (public.is_staff());
create policy "quotes: staff update" on public.quote_requests
  for update to authenticated using (public.is_staff()) with check (public.is_staff());
create policy "quotes: staff delete" on public.quote_requests
  for delete to authenticated using (public.is_staff());

-------------------------------------------------------------------------------
-- RPCs
-------------------------------------------------------------------------------

-- A client answers a selection request. Clients can't update selections directly,
-- so they can never mark their own selection approved.
create function public.submit_selection(p_selection_id uuid, p_note text, p_option_id uuid default null)
returns public.selections
language plpgsql security definer set search_path = '' as $$
declare
  sel public.selections;
begin
  select * into sel from public.selections where id = p_selection_id for update;
  if sel.id is null or not public.can_view_project(sel.project_id) then
    raise exception 'Selection not found' using errcode = 'P0002';
  end if;
  if sel.status not in ('requested', 'revision_requested') then
    raise exception 'This selection is no longer accepting responses' using errcode = 'P0001';
  end if;
  if p_option_id is not null and not exists (
    select 1 from public.selection_options where id = p_option_id and selection_id = p_selection_id
  ) then
    raise exception 'Invalid option' using errcode = 'P0001';
  end if;

  update public.selections
     set status = 'submitted',
         client_note = p_note,
         chosen_option_id = p_option_id,
         submitted_at = now()
   where id = p_selection_id
  returning * into sel;
  return sel;
end;
$$;

-- Staff approve a submitted selection or send it back with feedback.
create function public.decide_selection(p_selection_id uuid, p_approve boolean, p_staff_note text default null)
returns public.selections
language plpgsql security definer set search_path = '' as $$
declare
  sel public.selections;
begin
  if not public.is_staff() then
    raise exception 'Only staff can review selections' using errcode = '42501';
  end if;
  update public.selections
     set status = case when p_approve then 'approved'::public.selection_status
                       else 'revision_requested'::public.selection_status end,
         staff_note = p_staff_note,
         decided_at = now()
   where id = p_selection_id
  returning * into sel;
  return sel;
end;
$$;

-- Only the owner can promote/demote staff.
create function public.set_user_role(p_user_id uuid, p_role public.user_role)
returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_owner() then
    raise exception 'Only the owner can change roles' using errcode = '42501';
  end if;
  if p_user_id = auth.uid() and p_role <> 'owner' then
    raise exception 'You cannot remove your own owner role' using errcode = 'P0001';
  end if;
  update public.profiles set role = p_role where id = p_user_id;
end;
$$;

-- Staff and each client can rotate their calendar-feed token if a link leaks.
create function public.rotate_feed_token() returns uuid
language sql security definer set search_path = '' as $$
  update public.profiles set feed_token = gen_random_uuid()
  where id = auth.uid()
  returning feed_token;
$$;

revoke execute on function public.submit_selection, public.decide_selection,
  public.set_user_role, public.rotate_feed_token from anon, public;
grant execute on function public.submit_selection, public.decide_selection,
  public.set_user_role, public.rotate_feed_token to authenticated;

-------------------------------------------------------------------------------
-- Storage
-------------------------------------------------------------------------------
-- project-files layout:
--   {project_id}/uploads/...  client or staff uploads (tracked in documents)
--   {project_id}/docs/...     staff uploads (tracked in documents)
--   {project_id}/options/...  selection option images (visible to project members)
insert into storage.buckets (id, name, public, file_size_limit)
values ('project-files', 'project-files', false, 52428800),
       ('quote-uploads', 'quote-uploads', false, 52428800);

create policy "project files: read" on storage.objects
  for select to authenticated using (
    bucket_id = 'project-files' and (
      public.is_staff() or (
        public.is_project_member(public.path_project_id(name)) and (
          (storage.foldername(name))[2] = 'options'
          or exists (select 1 from public.documents d where d.storage_path = storage.objects.name)
        )
      )
    )
  );

create policy "project files: upload" on storage.objects
  for insert to authenticated with check (
    bucket_id = 'project-files' and (
      public.is_staff() or (
        public.is_project_member(public.path_project_id(name))
        and (storage.foldername(name))[2] = 'uploads'
      )
    )
  );

create policy "project files: delete" on storage.objects
  for delete to authenticated using (
    bucket_id = 'project-files' and (public.is_staff() or owner_id = (select auth.uid())::text)
  );

create policy "project files: staff update" on storage.objects
  for update to authenticated using (bucket_id = 'project-files' and public.is_staff());

create policy "quote uploads: staff read" on storage.objects
  for select to authenticated using (bucket_id = 'quote-uploads' and public.is_staff());
create policy "quote uploads: staff delete" on storage.objects
  for delete to authenticated using (bucket_id = 'quote-uploads' and public.is_staff());
