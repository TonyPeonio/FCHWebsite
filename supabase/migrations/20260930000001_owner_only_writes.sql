-- Staff are view-only: they can see every project, event, selection, file, and quote,
-- but only owners can create, change, or delete anything. (The secretary who manages the
-- calendar gets an owner account.)

-- projects
drop policy "projects: staff write" on public.projects;
create policy "projects: owner write" on public.projects
  for all to authenticated using (public.is_owner()) with check (public.is_owner());

-- project_members
drop policy "members: staff write" on public.project_members;
create policy "members: owner write" on public.project_members
  for all to authenticated using (public.is_owner()) with check (public.is_owner());

-- events and their project tags
drop policy "events: staff write" on public.events;
create policy "events: owner write" on public.events
  for all to authenticated using (public.is_owner()) with check (public.is_owner());

drop policy "event tags: staff write" on public.event_projects;
create policy "event tags: owner write" on public.event_projects
  for all to authenticated using (public.is_owner()) with check (public.is_owner());

-- selections
drop policy "selections: staff write" on public.selections;
create policy "selections: owner write" on public.selections
  for all to authenticated using (public.is_owner()) with check (public.is_owner());

drop policy "selection options: staff write" on public.selection_options;
create policy "selection options: owner write" on public.selection_options
  for all to authenticated using (public.is_owner()) with check (public.is_owner());

-- documents: clients keep their upload rights; the staff shortcut becomes owner-only
drop policy "documents: client upload" on public.documents;
create policy "documents: upload" on public.documents
  for insert to authenticated with check (
    public.is_owner() or (
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

drop policy "documents: delete own or staff" on public.documents;
create policy "documents: delete own or owner" on public.documents
  for delete to authenticated using (public.is_owner() or uploaded_by = (select auth.uid()));

drop policy "documents: staff update" on public.documents;
create policy "documents: owner update" on public.documents
  for update to authenticated using (public.is_owner()) with check (public.is_owner());

-- quote requests: staff can read, only owners change status/notes or delete
drop policy "quotes: staff update" on public.quote_requests;
create policy "quotes: owner update" on public.quote_requests
  for update to authenticated using (public.is_owner()) with check (public.is_owner());

drop policy "quotes: staff delete" on public.quote_requests;
create policy "quotes: owner delete" on public.quote_requests
  for delete to authenticated using (public.is_owner());

-- profiles: only owners edit other people's names/phones
drop policy "profiles: staff update" on public.profiles;
create policy "profiles: owner update" on public.profiles
  for update to authenticated using (public.is_owner()) with check (public.is_owner());

-- storage: staff can still download everything (read policy unchanged)
drop policy "project files: upload" on storage.objects;
create policy "project files: upload" on storage.objects
  for insert to authenticated with check (
    bucket_id = 'project-files' and (
      public.is_owner() or (
        public.is_project_member(public.path_project_id(name))
        and (storage.foldername(name))[2] = 'uploads'
      )
    )
  );

drop policy "project files: delete" on storage.objects;
create policy "project files: delete" on storage.objects
  for delete to authenticated using (
    bucket_id = 'project-files' and (public.is_owner() or owner_id = (select auth.uid())::text)
  );

drop policy "project files: staff update" on storage.objects;
create policy "project files: owner update" on storage.objects
  for update to authenticated using (bucket_id = 'project-files' and public.is_owner());

drop policy "quote uploads: staff delete" on storage.objects;
create policy "quote uploads: owner delete" on storage.objects
  for delete to authenticated using (bucket_id = 'quote-uploads' and public.is_owner());

-- Approving/returning selections is owner-only.
create or replace function public.decide_selection(p_selection_id uuid, p_approve boolean, p_staff_note text default null)
returns public.selections
language plpgsql security definer set search_path = '' as $$
declare
  sel public.selections;
begin
  if not public.is_owner() then
    raise exception 'Only the owner can review selections' using errcode = '42501';
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
