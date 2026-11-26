-- Only the owner decides which photos appear on the public website. The upload rule let a client
-- add a file to their own project already marked "show on website"; once that project was
-- completed, it would have appeared in the public Our Work gallery. Client uploads now always
-- start off the website (the owner can still add them afterwards).
drop policy "documents: upload" on public.documents;
create policy "documents: upload" on public.documents
  for insert to authenticated with check (
    public.is_owner() or (
      public.is_project_member(project_id)
      and uploaded_by = (select auth.uid())
      and kind in ('selection', 'photo', 'other')
      and split_part(storage_path, '/', 2) = 'uploads'
      and not show_on_website
      and (selection_id is null or exists (
        select 1 from public.selections s
        where s.id = selection_id and s.project_id = documents.project_id
          and s.status in ('requested', 'revision_requested')
      ))
    )
  );
