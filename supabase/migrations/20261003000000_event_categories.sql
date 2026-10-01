-- Calendar event categories the owner can add to and remove from (previously a fixed list in the
-- portal). Events keep storing the category name as text, so removing a category doesn't change
-- events that already use it.
create table public.event_categories (
  id          bigint generated always as identity primary key, -- also the display order
  name        text not null check (length(trim(name)) between 1 and 40),
  created_at  timestamptz not null default now()
);
create unique index event_categories_name_key on public.event_categories (lower(trim(name)));

insert into public.event_categories (name) values
  ('Site work'), ('Foundation'), ('Framing'), ('Roofing'), ('Plumbing'), ('Electrical'), ('HVAC'),
  ('Insulation'), ('Drywall'), ('Finish work'), ('Inspection'), ('Delivery'), ('Meeting'),
  ('Demolition'), ('Office'), ('Internal');

alter table public.event_categories enable row level security;
create policy "event categories: read" on public.event_categories
  for select to authenticated using (true);
create policy "event categories: owner add" on public.event_categories
  for insert to authenticated with check (public.is_owner());
create policy "event categories: owner remove" on public.event_categories
  for delete to authenticated using (public.is_owner());
