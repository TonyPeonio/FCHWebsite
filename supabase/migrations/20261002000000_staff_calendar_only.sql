-- Staff see only the master calendar: every event (including staff-only ones) and, for labeling
-- them, each project's name and color. Projects, selections, photos and files, website inquiries,
-- and other people's profiles become owner-only (clients keep access to their own projects).

-- Projects, selections and selection options all read through this.
create or replace function public.can_view_project(pid uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select public.is_owner() or public.is_project_member(pid);
$$;

drop policy "documents: read" on public.documents;
create policy "documents: read" on public.documents
  for select to authenticated using (
    case when project_id is null then public.is_owner()
    else public.is_owner() or (
      public.is_project_member(project_id)
      and (client_visible or uploaded_by = (select auth.uid()))
    ) end
  );

drop policy "profiles: read self or staff" on public.profiles;
create policy "profiles: read self or owner" on public.profiles
  for select to authenticated using (id = (select auth.uid()) or public.is_owner());

drop policy "members: read own or staff" on public.project_members;
create policy "members: read own or owner" on public.project_members
  for select to authenticated using (user_id = (select auth.uid()) or public.is_owner());

drop policy "quotes: staff read" on public.quote_requests;
create policy "quotes: owner read" on public.quote_requests
  for select to authenticated using (public.is_owner());

drop policy "project files: read" on storage.objects;
create policy "project files: read" on storage.objects
  for select to authenticated using (
    bucket_id = 'project-files' and (
      case when (storage.foldername(name))[1] = 'library' then public.is_owner()
      else public.is_owner() or (
        public.is_project_member(public.path_project_id(name)) and (
          (storage.foldername(name))[2] = 'options'
          or exists (
            select 1 from public.documents d
            where d.storage_path = storage.objects.name or d.thumb_path = storage.objects.name
          )
        )
      ) end
    )
  );

drop policy "quote uploads: staff read" on storage.objects;
create policy "quote uploads: owner read" on storage.objects
  for select to authenticated using (bucket_id = 'quote-uploads' and public.is_owner());

-- Just enough about projects to label calendar events: everything for staff and owners, and a
-- client's own projects.
create function public.calendar_projects()
returns table (id uuid, name text, color text)
language sql stable security definer set search_path = '' as $$
  select p.id, p.name, p.color from public.projects p
  where public.is_staff() or public.is_project_member(p.id)
  order by p.name;
$$;
revoke execute on function public.calendar_projects() from public, anon;
grant execute on function public.calendar_projects() to authenticated;
