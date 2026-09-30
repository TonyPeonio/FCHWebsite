-- Project categories and completion dates, the owner's photo dump, thumbnails, and choosing which
-- photos of finished projects appear on the public website.

create type public.project_category as enum (
  'new_construction', 'shop', 'remodel', 'adu', 'multi_family', 'commercial'
);

alter table public.projects
  add column category     public.project_category,
  add column city         text,
  add column completed_on date;

-- Photo dump: photos not yet assigned to a project live under library/ with no project.
alter table public.documents
  alter column project_id drop not null,
  drop constraint documents_check,
  add constraint documents_path_matches_project check (
    (project_id is null and split_part(storage_path, '/', 1) = 'library')
    or split_part(storage_path, '/', 1) = project_id::text
  ),
  add column show_on_website boolean not null default false,
  add column thumb_path      text unique;

-- Photo-dump rows are the owner's alone; project rows keep the existing rules.
drop policy "documents: read" on public.documents;
create policy "documents: read" on public.documents
  for select to authenticated using (
    case when project_id is null then public.is_owner()
    else public.is_staff() or (
      public.is_project_member(project_id)
      and (client_visible or uploaded_by = (select auth.uid()))
    ) end
  );

-- Same for files; a thumbnail is readable by whoever can read its photo's row.
drop policy "project files: read" on storage.objects;
create policy "project files: read" on storage.objects
  for select to authenticated using (
    bucket_id = 'project-files' and (
      case when (storage.foldername(name))[1] = 'library' then public.is_owner()
      else public.is_staff() or (
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
