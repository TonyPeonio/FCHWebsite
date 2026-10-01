-- Calendar events no longer have categories.
drop table public.event_categories;
alter table public.events drop column category;
