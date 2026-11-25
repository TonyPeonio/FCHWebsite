-- Home-page content the owner edits in the portal (Website page): hours, contact details, section
-- text, and the three section photos (file paths under site/ in R2). Missing keys fall back to what
-- index.html already shows. Visitors read it through the public site-content function, so only the
-- owner touches the table directly.
create table public.site_content (
  id          int primary key default 1 check (id = 1),
  content     jsonb not null default '{}' check (jsonb_typeof(content) = 'object' and pg_column_size(content) < 50000),
  updated_at  timestamptz not null default now()
);
insert into public.site_content (id) values (1);

alter table public.site_content enable row level security;
create policy "site content: owner read" on public.site_content
  for select to authenticated using (public.is_owner());
create policy "site content: owner update" on public.site_content
  for update to authenticated using (public.is_owner()) with check (public.is_owner());

create trigger site_content_touch before update on public.site_content
  for each row execute function public.touch_updated_at();
