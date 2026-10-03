-- Files move from Supabase Storage to Cloudflare R2 (see supabase/functions/_shared/r2.ts). R2 has
-- no row-level security, so the `files` function asks these functions who may do what. They hold
-- the same rules as the storage.objects policies. They run as the caller (not security definer), so
-- `documents` row-level security applies to the lookups just as it did inside those policies.

-- Of `paths`, the ones the caller may download from `area` ('project-files' or 'quote-uploads').
create function public.readable_files(area text, paths text[])
returns setof text
language sql stable set search_path = '' as $$
  select p from unnest(paths) as p
  where case area
    when 'quote-uploads' then public.is_owner()
    when 'project-files' then
      case when split_part(p, '/', 1) = 'library' then public.is_owner()
      else public.is_owner() or (
        public.is_project_member(public.path_project_id(p)) and (
          (split_part(p, '/', 2) = 'options' and split_part(p, '/', 3) <> '')
          or exists (select 1 from public.documents d where d.storage_path = p or d.thumb_path = p)
        )
      ) end
    else false
  end;
$$;

-- Of `paths`, the ones the caller may upload to project-files: the owner anywhere, clients only to
-- an uploads/ folder of their own projects.
create function public.uploadable_files(paths text[])
returns setof text
language sql stable set search_path = '' as $$
  select p from unnest(paths) as p
  where public.is_owner() or (
    public.is_project_member(public.path_project_id(p))
    and split_part(p, '/', 2) = 'uploads' and split_part(p, '/', 3) <> ''
  );
$$;

-- Of `paths`, the ones the caller may delete from project-files: the owner anything; a client only
-- files in their projects' uploads/ folders that no longer belong to a document (they delete their
-- document first, which row-level security already limits to their own uploads).
create function public.deletable_files(paths text[])
returns setof text
language plpgsql stable security definer set search_path = '' as $$
begin
  if public.is_owner() then
    return query select p from unnest(paths) as p;
  else
    return query
      select p from public.uploadable_files(paths) as p
      where not exists (select 1 from public.documents d where d.storage_path = p or d.thumb_path = p);
  end if;
end;
$$;

revoke execute on function public.readable_files(text, text[]) from public, anon;
revoke execute on function public.uploadable_files(text[]) from public, anon;
revoke execute on function public.deletable_files(text[]) from public, anon;
grant execute on function public.readable_files(text, text[]) to authenticated;
grant execute on function public.uploadable_files(text[]) to authenticated;
grant execute on function public.deletable_files(text[]) to authenticated;

-- R2 includes 10 GB free, then charges per GB, so the "limit" is now the free allowance by default.
alter table public.usage_limits alter column storage_limit_mb set default 10240;
update public.usage_limits set storage_limit_mb = 10240 where storage_limit_mb = 1024;

-- Database size only now; file sizes come from R2 through the `files` function.
create or replace function public.space_used()
returns json
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.is_owner() then
    raise exception 'Only the owner can see space used' using errcode = '42501';
  end if;
  return json_build_object('database_bytes', pg_database_size(current_database()));
end;
$$;
